'use server'

import { redirect } from 'next/navigation'
import { auth } from '../auth.js'
import { prisma } from './prisma.js'
import { generateJoinCode } from './joinCode.js'
import { computeNextAttainment } from './attainment.js'
import { CoachingApiError, getGeminiFeedback } from './coaching.js'
import { checkGuard } from './guard.js'
import { GENRES, GRADES } from './curriculum.js'

async function requireTeacher() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return session.user
}

export async function createActivity(formData) {
  const teacher = await requireTeacher()

  const material = formData.get('material')?.toString().trim()
  const grade = formData.get('grade')?.toString().trim()
  const genre = formData.get('genre')?.toString().trim()
  const targetLength = Number(formData.get('targetLength'))

  if (!material || !Number.isFinite(targetLength) || targetLength <= 0) {
    throw new Error('소재와 목표 글자 수를 모두 올바르게 입력해주세요.')
  }
  if (!GRADES.some((g) => g.value === grade)) {
    throw new Error('학년을 다시 선택해주세요.')
  }
  if (!GENRES.includes(genre)) {
    throw new Error('글의 종류를 다시 선택해주세요.')
  }

  const title = `${genre} - ${material}`

  let activity
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      activity = await prisma.activity.create({
        data: {
          teacherId: teacher.id,
          title,
          topic: material,
          grade,
          genre,
          targetLength,
          joinCode: generateJoinCode(),
        },
      })
      break
    } catch (err) {
      if (err?.code === 'P2002') continue // join code collision, retry
      throw err
    }
  }
  if (!activity) throw new Error('참여 코드를 생성하지 못했어요. 다시 시도해주세요.')

  redirect(`/dashboard/${activity.id}`)
}

export async function joinActivity(_prevState, formData) {
  const joinCode = formData.get('joinCode')?.toString().trim().toUpperCase()
  const studentName = formData.get('studentName')?.toString().trim()

  if (!studentName) {
    return { error: '이름을 입력해주세요.' }
  }

  const activity = await prisma.activity.findUnique({ where: { joinCode } })
  if (!activity) {
    return { error: '활동을 찾을 수 없어요. 코드를 다시 확인해주세요.' }
  }

  const submission = await prisma.submission.upsert({
    where: { activityId_studentName: { activityId: activity.id, studentName } },
    update: {},
    create: { activityId: activity.id, studentName },
  })

  redirect(`/write/${submission.id}`)
}

export async function saveDraft(submissionId, writing) {
  await prisma.submission.update({
    where: { id: submissionId },
    data: { writing },
  })
}

export async function requestCoaching(submissionId, writing) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { activity: true },
  })
  if (!submission) throw new Error('제출 정보를 찾을 수 없어요.')

  const isFirstRound = submission.feedback === null
  if (isFirstRound && writing.length < submission.activity.targetLength) {
    return { error: '아직 목표 글자 수에 도달하지 않았어요.' }
  }

  const guard = checkGuard(writing)
  if (guard.flagged) {
    const feedback = { flagged: true, reason: guard.reason }
    const attainment = 0
    const rounds = [
      ...submission.rounds,
      { writing, flagged: true, flagReason: guard.reason, attainmentAfter: attainment },
    ]

    // Deliberately leave lastSubmittedWriting/lastImprovements untouched so the
    // next legitimate revision is still compared against the last real round,
    // not against this flagged text.
    await prisma.submission.update({
      where: { id: submissionId },
      data: { writing, feedback, attainment, rounds },
    })

    return { feedback, attainment, rounds }
  }

  let result
  try {
    result = await getGeminiFeedback({
      topic: submission.activity.topic,
      writing,
      previousWriting: submission.lastSubmittedWriting,
      previousImprovements: submission.lastImprovements,
      genre: submission.activity.genre,
    })
  } catch (err) {
    if (err instanceof CoachingApiError) {
      return { error: err.status === 502 ? '네트워크 오류가 발생했어요. 다시 시도해주세요.' : err.message }
    }
    throw err
  }

  const attainment = computeNextAttainment(submission.attainment, result.addressed ?? null)
  const feedback = { strength: result.strength, improvements: result.improvements }
  const rounds = [
    ...submission.rounds,
    {
      writing,
      strength: result.strength,
      improvements: result.improvements,
      addressed: result.addressed ?? null,
      attainmentAfter: attainment,
    },
  ]

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      writing,
      feedback,
      attainment,
      lastSubmittedWriting: writing,
      lastImprovements: result.improvements,
      rounds,
    },
  })

  return { feedback, attainment, rounds }
}
