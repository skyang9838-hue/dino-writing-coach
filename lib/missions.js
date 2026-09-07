import { STATUS_ORDER } from './assessmentRatchet.js'

const VALID_STATUSES = new Set(['met', 'partial', 'unmet'])

// 채점기준이 아니라 글 자체를 손보는 대상. 어느 단원에도 속하지 않으므로
// 단원 데이터가 아니라 여기에 있다. 두 항목이 서로 다른 일을 시켜야 미션이
// 겹치지 않고, id가 달라야 대상-미션 짝짓기가 성립한다.
export const POLISH_RUBRIC_ID = 'polish'
export const POLISH_TARGETS = [
  {
    rubricIds: [POLISH_RUBRIC_ID],
    criterionIds: ['polish-spelling'],
    polish: true,
    missionSeed: '학생 글에서 맞춤법이나 띄어쓰기가 틀린 곳을 하나 짚어 바르게 고치도록 안내',
  },
  {
    rubricIds: [POLISH_RUBRIC_ID],
    criterionIds: ['polish-wording'],
    polish: true,
    missionSeed: '학생 글에서 어색하거나 같은 말이 되풀이되는 문장을 하나 골라 자연스럽게 다듬도록 안내',
  },
]

function buildCriterionIndex(rubrics) {
  return new Map(rubrics.flatMap((rubric) =>
    rubric.criteria.map((criterion) => [
      criterion.id,
      { ...criterion, rubricId: rubric.id },
    ]),
  ))
}

function targetKey(criterionIds) {
  return [...criterionIds].sort().join('|')
}

function wasUsedInBothRecentRounds(target, priorRounds) {
  const recentRounds = priorRounds.slice(-2)
  if (recentRounds.length < 2) return false

  const key = targetKey(target.criterionIds)
  return recentRounds.every((round) =>
    (round.missions ?? []).some((mission) => targetKey(mission.criterionIds ?? []) === key),
  )
}

// There used to be a mergePair here that folded new-fact + fact-detail and
// purpose + interviewee into single missions, because asking a student to fix
// those separately produced two missions that said nearly the same thing. The
// four criteria they were merged into are now single criteria, so there is no
// pair left to merge. rubricIds/criterionIds stay arrays (of length one) —
// saved rounds, normalizedTargetKey and wasUsedInBothRecentRounds all read
// them as arrays.

export function selectMissionTargets({ assessments, rubrics, priorRounds = [] }) {
  const criterionIndex = buildCriterionIndex(rubrics)
  const candidates = new Map()

  for (const assessment of assessments) {
    const criterion = criterionIndex.get(assessment.criterionId)
    if (!criterion || criterion.rubricId !== assessment.rubricId) {
      throw new Error(`알 수 없는 채점기준: ${assessment.criterionId}`)
    }
    if (!VALID_STATUSES.has(assessment.status)) {
      throw new Error(`알 수 없는 판정 상태: ${assessment.status}`)
    }
    if (candidates.has(assessment.criterionId)) {
      throw new Error(`중복된 채점기준: ${assessment.criterionId}`)
    }
    if (assessment.status !== 'met') {
      candidates.set(assessment.criterionId, {
        rubricId: assessment.rubricId,
        criterionId: assessment.criterionId,
        status: assessment.status,
        priority: criterion.priority,
        missionSeed: criterion.missionSeed,
      })
    }
  }

  // The old prerequisite gates (drop `body` when there is no new fact yet,
  // drop `opening` when neither purpose nor interviewee is there) went with
  // the criteria they gated. Nothing among the four depends on another.

  const targets = []
  for (const candidate of candidates.values()) {
    targets.push({
      rubricIds: [candidate.rubricId],
      criterionIds: [candidate.criterionId],
      status: candidate.status,
      priority: candidate.priority,
      missionSeed: candidate.missionSeed,
    })
  }

  const weakTargets = targets
    .map((target) => ({
      ...target,
      polish: false,
      repeatedTwice: wasUsedInBothRecentRounds(target, priorRounds),
    }))
    .sort((left, right) =>
      STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
      || Number(left.repeatedTwice) - Number(right.repeatedTwice)
      || left.priority - right.priority,
    )
    .slice(0, 2)

  // 모자란 기준으로 두 자리를 못 채우면 남는 자리는 글다듬기가 가져간다.
  // 예전에는 이미 충족한 기준을 refinementSeed로 한 번 더 시켰는데, 학생
  // 눈에는 그게 "이미 한 걸 또 하라"는 말이었다. 채점기준으로 더 시킬 것이
  // 없다는 건 글 자체를 다듬을 때가 됐다는 뜻이다.
  //
  // 두 타깃의 id가 서로 달라야 한다 — validateMissionResult가 대상 키로
  // 미션을 짝짓기 때문에 키가 같으면 두 번째 미션이 통째로 거절된다.
  return [...weakTargets, ...POLISH_TARGETS]
    .slice(0, 2)
    .map(({ status: _status, priority: _priority, repeatedTwice: _repeated, ...target }) => target)
}
