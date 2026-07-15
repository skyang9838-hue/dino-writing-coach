'use server'

import { redirect } from 'next/navigation'
import { auth } from '../auth.js'
import { prisma } from './prisma.js'
import { generateJoinCode } from './joinCode.js'
import { computeNextAttainment } from './attainment.js'
import { CoachingApiError, getGeminiFeedback } from './coaching.js'
import { checkGuard } from './guard.js'
import { containsProfanity } from './profanity.js'
import { getUnitById } from './curriculum.js'

// Shared by the rule-based guard (lib/guard.js), the AI's own meaningless-content
// judgment (lib/coaching.js), and a teacher's profanity rejection — all three can
// flag a round. `attainment` is passed explicitly: nonsense/meaningless callers
// force it to 0, while a teacher rejection leaves it unchanged (score untouched).
// Deliberately doesn't touch lastSubmittedWriting/lastImprovements so the next
// legitimate revision is still compared against the last real round.
async function flagRound(submission, writing, reason, attainment) {
  const feedback = { flagged: true, reason }
  const rounds = [...submission.rounds, { writing, flagged: true, flagReason: reason, attainmentAfter: attainment }]

  await prisma.submission.update({
    where: { id: submission.id },
    data: { writing, feedback, attainment, rounds },
  })

  return { feedback, attainment, rounds }
}

// The actual Gemini coaching call plus the resulting attainment/feedback/rounds
// update — shared by a normal requestCoaching submission and a teacher's
// approval of a previously profanity-flagged round.
async function runCoachingRound(submission, writing) {
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

  if (result.meaningless) {
    return flagRound(submission, writing, 'nonsense', 0)
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
    where: { id: submission.id },
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

async function requireTeacher() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return session.user
}

export async function createActivity(formData) {
  const teacher = await requireTeacher()

  const unitId = formData.get('unitId')?.toString().trim()
  const topic = formData.get('topic')?.toString().trim() || null
  const instructions = formData.get('instructions')?.toString().trim() || null
  const targetLength = Number(formData.get('targetLength'))

  const unit = getUnitById(unitId)
  if (!unit) {
    throw new Error('활동을 다시 선택해주세요.')
  }
  if (!Number.isFinite(targetLength) || targetLength <= 0) {
    throw new Error('목표 글자 수를 올바르게 입력해주세요.')
  }

  const title = topic ? `${unit.title} · ${topic}` : unit.title

  let activity
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      activity = await prisma.activity.create({
        data: {
          teacherId: teacher.id,
          title,
          topic,
          instructions,
          unitId: unit.id,
          grade: '초5-6학년군',
          genre: unit.genre,
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

  if (submission.feedback?.pending) {
    return { feedback: submission.feedback, attainment: submission.attainment, rounds: submission.rounds }
  }

  const isFirstRound = submission.feedback === null
  if (isFirstRound && writing.length < submission.activity.targetLength) {
    return { error: '아직 목표 글자 수에 도달하지 않았어요.' }
  }

  const guard = checkGuard(writing)
  if (guard.flagged) {
    return flagRound(submission, writing, guard.reason, 0)
  }

  if (containsProfanity(writing)) {
    const feedback = { pending: true, reason: 'profanity' }
    await prisma.submission.update({ where: { id: submissionId }, data: { writing, feedback } })
    return { feedback, attainment: submission.attainment, rounds: submission.rounds }
  }

  return runCoachingRound(submission, writing)
}

export async function resolveProfanityReview(submissionId, decision) {
  const teacher = await requireTeacher()

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { activity: true },
  })
  if (!submission || submission.activity.teacherId !== teacher.id) {
    throw new Error('제출 정보를 찾을 수 없어요.')
  }
  if (!submission.feedback?.pending) {
    throw new Error('검토 대기 중인 글이 아니에요.')
  }

  if (decision === 'approve') {
    return runCoachingRound(submission, submission.writing)
  }
  return flagRound(submission, submission.writing, 'profanity', submission.attainment)
}
