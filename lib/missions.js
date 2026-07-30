const VALID_STATUSES = new Set(['met', 'partial', 'unmet'])
const STATUS_ORDER = { unmet: 0, partial: 1, met: 2 }

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

function mergePair(candidates, firstId, secondId, missionSeed) {
  const first = candidates.get(firstId)
  const second = candidates.get(secondId)
  if (!first || !second) return null

  candidates.delete(firstId)
  candidates.delete(secondId)
  return {
    rubricIds: [...new Set([first.rubricId, second.rubricId])],
    criterionIds: [firstId, secondId],
    status: STATUS_ORDER[first.status] <= STATUS_ORDER[second.status] ? first.status : second.status,
    priority: Math.min(first.priority, second.priority),
    missionSeed,
  }
}

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

  if (candidates.get('new-fact')?.status === 'unmet') {
    candidates.delete('body')
  }
  if (
    candidates.get('purpose')?.status === 'unmet'
    && candidates.get('interviewee')?.status === 'unmet'
  ) {
    candidates.delete('opening')
  }

  const targets = []
  const informationTarget = mergePair(
    candidates,
    'new-fact',
    'fact-detail',
    '면담에서 새롭게 알게 된 사실 하나를 고르고, 그 사실의 이유·과정·사례·상황 중 하나를 덧붙이도록 안내',
  )
  if (informationTarget) targets.push(informationTarget)

  const introductionTarget = mergePair(
    candidates,
    'purpose',
    'interviewee',
    '면담한 사람이 누구인지 밝히고, 그 사람에게서 무엇을 알아보려 했는지 이어서 안내',
  )
  if (introductionTarget) targets.push(introductionTarget)

  for (const candidate of candidates.values()) {
    targets.push({
      rubricIds: [candidate.rubricId],
      criterionIds: [candidate.criterionId],
      status: candidate.status,
      priority: candidate.priority,
      missionSeed: candidate.missionSeed,
    })
  }

  return targets
    .map((target) => ({
      ...target,
      repeatedTwice: wasUsedInBothRecentRounds(target, priorRounds),
    }))
    .sort((left, right) =>
      STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
      || Number(left.repeatedTwice) - Number(right.repeatedTwice)
      || left.priority - right.priority,
    )
    .slice(0, 2)
    .map(({ status: _status, priority: _priority, repeatedTwice: _repeated, ...target }) => target)
}
