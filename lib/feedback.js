export function getVisibleMissions(feedback) {
  if (Array.isArray(feedback?.missions)) {
    return feedback.missions.map((mission) => ({
      id: mission.id ?? null,
      title: mission.title || null,
      instruction: mission.instruction,
    }))
  }
  if (Array.isArray(feedback?.improvements)) {
    return feedback.improvements.map((instruction) => ({
      title: null,
      instruction,
    }))
  }
  return []
}

export function getMissionStatusSymbol(status) {
  if (status === 'done' || status === true) return '✅'
  if (status === 'partial' || status === 'attempted') return '🔄'
  return '❌'
}

// 학생 화면에서 고를 미션과 "다시 코칭 받기" 조건. 고를 미션은 마지막으로
// 반려되지 않은 회차의 것이다(반려 뒤에도 서버는 그 미션으로 판정한다).
// id 있는 미션(채점기준 코칭)이 있을 때만 1개 이상 골라야 한다. 일반 코치
// (id 없음)와 미션이 0개인 회차는 고르지 않고 바로 다시 코칭받는다.
export function getMissionPick({ rounds, isFirstRound, selectedIds }) {
  const missions = getVisibleMissions((rounds ?? []).findLast((round) => !round.flagged))
  const mustPick = !isFirstRound && missions.some((mission) => mission.id)
  return { missions, mustPick, needsPick: mustPick && selectedIds.length === 0 }
}

// 이전 버전 보기의 "지난 미션 반영 확인" 줄. 이번 회차에 고른 미션
// (selectedMissionIds)이 있으면 그것만 — 고르지 않은 미션은 판정이 없다.
export function getPriorMissionChecks(previousRound, round) {
  const chosen = round?.selectedMissionIds?.length ? new Set(round.selectedMissionIds) : null
  return getVisibleMissions(previousRound).flatMap((mission, index) => {
    const missionId = previousRound.missions?.[index]?.id ?? null
    if (chosen && !chosen.has(missionId)) return []
    const status =
      round?.priorMissionStatuses?.find((prior) => prior.missionId === missionId)?.status ??
      round?.addressed?.[index]
    return [{ key: missionId ?? index, title: mission.title, instruction: mission.instruction, status }]
  })
}
