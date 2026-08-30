const VALID_STATUSES = new Set(['met', 'partial', 'unmet'])
const STATUS_ORDER = { unmet: 0, partial: 1, met: 2 }
const REFINEMENT_SEEDS = {
  'purpose-and-target': '이미 밝힌 면담 목적과 대상이 본문의 핵심 면담 내용과 더 분명히 이어지도록 표현을 다듬게 안내',
  preparation: '이미 쓴 준비 과정이 면담에서 실제로 물은 내용과 자연스럽게 이어지도록 다듬게 안내',
  'learned-facts': '이미 설명한 새 사실에 면담에서 실제로 들은 이유·과정·상황의 연결을 더 선명하게 만들도록 안내',
  reflection: '이미 쓴 느낀 점이 본문의 구체적인 면담 사실과 직접 이어지도록 마무리를 다듬게 안내',
}

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
      refinement: false,
      repeatedTwice: wasUsedInBothRecentRounds(target, priorRounds),
    }))
    .sort((left, right) =>
      STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
      || Number(left.repeatedTwice) - Number(right.repeatedTwice)
      || left.priority - right.priority,
    )
    .slice(0, 2)

  const selectedCriterionIds = new Set(
    weakTargets.flatMap((target) => target.criterionIds),
  )
  const refinementTargets = assessments
    .filter((assessment) =>
      assessment.status === 'met'
      && !selectedCriterionIds.has(assessment.criterionId),
    )
    .map((assessment) => {
      const criterion = criterionIndex.get(assessment.criterionId)
      const target = {
        rubricIds: [assessment.rubricId],
        criterionIds: [assessment.criterionId],
        status: 'met',
        priority: criterion.priority,
        refinement: true,
        missionSeed: REFINEMENT_SEEDS[assessment.criterionId],
      }
      return {
        ...target,
        repeatedTwice: wasUsedInBothRecentRounds(target, priorRounds),
      }
    })
    .sort((left, right) =>
      Number(left.repeatedTwice) - Number(right.repeatedTwice)
      || left.priority - right.priority,
    )

  return [...weakTargets, ...refinementTargets]
    .slice(0, 2)
    .map(({ status: _status, priority: _priority, repeatedTwice: _repeated, ...target }) => target)
}
