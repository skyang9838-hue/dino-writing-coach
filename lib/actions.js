'use server'

import { redirect } from 'next/navigation'
import { auth } from '../auth.js'
import { prisma } from './prisma.js'
import { isAdmin } from './admin.js'
import { generateJoinCode } from './joinCode.js'
import { computeNextAttainment } from './attainment.js'
import {
  CoachingApiError,
  getGeminiFeedback,
  getRubricCoachingFeedback,
  getUnitCoachingSpec,
} from './coaching.js'
import { checkGuard } from './guard.js'
import { containsProfanity } from './profanity.js'
import {
  INTERVIEW_REPORT_GENRE,
  INTERVIEW_REPORT_UNIT_ID,
  getUnitById,
} from './curriculum.js'
import { MAX_PICKED_MISSIONS, UNCHANGED_WRITING_MESSAGE, isUnchangedWriting } from './feedback.js'
import {
  buildInterviewRoundState,
  summarizeWritingChanges,
} from './interviewRound.js'

// 무의미한 글은 아무 흔적도 남기지 않는다 — 규칙 가드(lib/guard.js)가 잡았든
// 모델이 meaningless로 판정했든 마찬가지다. DB를 건드리지 않으므로 회차를
// 먹지 않고, 도달도도 그대로이며, feedback이 null로 남아 첫 회차의 목표
// 글자 수 게이트가 계속 살아 있다(예전에는 flagged 회차가 저장되는 바람에
// 한 번 장난치면 그 게이트가 영영 풀렸다).
//
// 글 자체를 여기서 저장하지 않아도 잃는 것은 없다 — saveDraft가 이미 타이핑
// 800ms 뒤마다 writing을 저장하고 있다.
function discardNonsenseRound(submission) {
  return {
    feedback: { flagged: true, reason: 'nonsense' },
    attainment: submission.attainment,
    rounds: submission.rounds,
  }
}

// 교사가 부적절한 표현으로 반려한 회차는 기록에 남긴다. 사람이 내린 판단이고
// 나중에 되짚을 근거가 필요하다. `attainment`를 그대로 넘겨받아 마지막으로
// 의미 있었던 누적값을 보존한다.
// Deliberately doesn't touch lastSubmittedWriting/lastImprovements so the next
// legitimate revision is still compared against the last real round.
async function flagRejectedRound(submission, writing, attainment) {
  const feedback = { flagged: true, reason: 'profanity' }
  const rounds = [...submission.rounds, { writing, flagged: true, flagReason: 'profanity', attainmentAfter: attainment }]

  await prisma.submission.update({
    where: { id: submission.id },
    data: { writing, feedback, attainment, rounds },
  })

  return { feedback, attainment, rounds }
}

// Which unit's criteria this submission gets coached against, or null for the
// generic coach.
//
// The genre fallback is not just for the nullable `Activity.unitId`. Activities
// created against the old 1학기 unit list still carry ids like `g6s1-unit7`,
// which no longer resolve to anything — and one of those could be an interview
// report, which was routed by genre back when it was made. Falling through to
// the genre keeps every activity that used to get rubric coaching getting it.
function resolveCoachingSpec(activity) {
  const fromUnit = activity.unitId ? getUnitCoachingSpec(activity.unitId) : null
  if (fromUnit) return fromUnit

  return activity.genre === INTERVIEW_REPORT_GENRE
    ? getUnitCoachingSpec(INTERVIEW_REPORT_UNIT_ID)
    : null
}

// Gemini가 실패하면 학생 화면에 띄울 문구로 바꾼다. 다른 오류는 그대로 던진다.
function coachingErrorResult(err) {
  if (!(err instanceof CoachingApiError)) throw err
  return { error: err.status === 502 ? '네트워크 오류가 발생했어요. 다시 시도해주세요.' : err.message }
}

// 학생이 고른 지난 미션만 판정한다. 고르지 않은 미션은 그 회차로 끝난다.
async function runRubricRound(submission, writing, spec, selectedMissionIds) {
  const lastMissions = Array.isArray(submission.lastImprovements) ? submission.lastImprovements : []
  const chosen = new Set(selectedMissionIds)
  let result
  try {
    result = await getRubricCoachingFeedback({
      spec,
      topic: submission.activity.topic,
      writing,
      previousWriting: submission.lastSubmittedWriting,
      previousMissions: lastMissions.filter((mission) => chosen.has(mission?.id)),
      priorRounds: submission.rounds,
      changes: summarizeWritingChanges(submission.lastSubmittedWriting, writing),
    })
  } catch (err) {
    return coachingErrorResult(err)
  }

  if (result.meaningless) {
    return discardNonsenseRound(submission)
  }

  const state = buildInterviewRoundState({ submission, writing, result, selectedMissionIds })
  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      writing,
      feedback: state.feedback,
      attainment: state.attainment,
      lastSubmittedWriting: writing,
      lastImprovements: state.lastImprovements,
      rounds: state.rounds,
    },
  })

  return {
    feedback: state.feedback,
    attainment: state.attainment,
    rounds: state.rounds,
  }
}

// The actual Gemini coaching call plus the resulting attainment/feedback/rounds
// update — shared by a normal requestCoaching submission and a teacher's
// approval of a previously profanity-flagged round.
async function runCoachingRound(submission, writing, selectedMissionIds = []) {
  const spec = resolveCoachingSpec(submission.activity)
  if (spec) {
    return runRubricRound(submission, writing, spec, selectedMissionIds)
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
    return coachingErrorResult(err)
  }

  if (result.meaningless) {
    return discardNonsenseRound(submission)
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

// 선생님이 활동을 지우면 학생 글도 같이 지워진다(Cascade). 쓰던 학생에게는 이 안내가 뜬다.
const ACTIVITY_CLOSED = '선생님이 활동을 닫았어요.'

export async function saveDraft(submissionId, writing) {
  // updateMany: a deleted activity takes the submission with it, and autosave
  // shouldn't throw for that.
  await prisma.submission.updateMany({
    where: { id: submissionId },
    data: { writing },
  })
}

// 채점기준 코칭에서 지난 미션에 id가 있으면, 고른 미션이 1~2개이고 모두
// 지난 미션 안에 있어야 한다. 미션이 0개였던 회차(모두 충족)는 고를 게 없다.
// 일반 코치(id 없는 문자열 미션)는 고르지 않는다.
function checkSelection(submission, selectedMissionIds) {
  if (!resolveCoachingSpec(submission.activity)) return null
  const lastIds = (Array.isArray(submission.lastImprovements) ? submission.lastImprovements : [])
    .map((mission) => mission?.id)
    .filter(Boolean)
  if (!lastIds.length) return null
  if (!Array.isArray(selectedMissionIds) || !selectedMissionIds.length) {
    return '해 볼 미션을 하나 이상 골라 주세요.'
  }
  if (selectedMissionIds.length > MAX_PICKED_MISSIONS) {
    return `미션은 ${MAX_PICKED_MISSIONS}개까지 고를 수 있어요.`
  }
  if (new Set(selectedMissionIds).size !== selectedMissionIds.length
    || selectedMissionIds.some((id) => !lastIds.includes(id))) {
    return '고른 미션을 다시 확인해 주세요.'
  }
  return null
}

export async function requestCoaching(submissionId, writing, selectedMissionIds = []) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { activity: true },
  })
  if (!submission) return { error: ACTIVITY_CLOSED }

  if (submission.feedback?.pending) {
    return { feedback: submission.feedback, attainment: submission.attainment, rounds: submission.rounds }
  }

  const isFirstRound = submission.feedback === null
  if (isFirstRound && writing.length < submission.activity.targetLength) {
    return { error: '아직 목표 글자 수에 도달하지 않았어요.' }
  }

  // 지난번 코칭받은 글에서 고친 곳이 없으면 Gemini를 부르지 않는다
  // (10/20 수업: 재코칭 88번 중 12번이 똑같은 글이었다). 대기·반려 회차는
  // lastSubmittedWriting을 바꾸지 않으므로 늘 마지막 정상 회차와 비교한다.
  if (!isFirstRound && isUnchangedWriting(submission.lastSubmittedWriting, writing)) {
    return { error: UNCHANGED_WRITING_MESSAGE }
  }

  const selectionError = checkSelection(submission, selectedMissionIds)
  if (selectionError) return { error: selectionError }

  const guard = checkGuard(writing)
  if (guard.flagged) {
    return discardNonsenseRound(submission)
  }

  if (containsProfanity(writing)) {
    // 선생님이 승인하면 이 선택으로 이어서 코칭한다.
    const feedback = { pending: true, reason: 'profanity', selectedMissionIds }
    await prisma.submission.update({ where: { id: submissionId }, data: { writing, feedback } })
    return { feedback, attainment: submission.attainment, rounds: submission.rounds }
  }

  return runCoachingRound(submission, writing, selectedMissionIds)
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
    // 배포 전에 걸린 대기 글에는 선택이 없다. 그때는 예전처럼 전부 판정한다.
    const selected = submission.feedback.selectedMissionIds
      ?? (Array.isArray(submission.lastImprovements) ? submission.lastImprovements : []).map((mission) => mission?.id).filter(Boolean)
    return runCoachingRound(submission, submission.writing, selected)
  }
  return flagRejectedRound(submission, submission.writing, submission.attainment)
}

// The owner or an admin may delete an activity (lib/admin.js).
async function requireActivityManager(activityId) {
  const teacher = await requireTeacher()
  const activity = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!activity || (activity.teacherId !== teacher.id && !isAdmin(teacher.email))) {
    throw new Error('활동을 찾을 수 없어요.')
  }
}

export async function deleteActivity(activityId) {
  await requireActivityManager(activityId)
  await prisma.activity.delete({ where: { id: activityId } })
}
