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
// 한 번에 고를 수 있는 미션은 2개까지다(10/20 수업: 3개 다 골랐다가 다
// 놓치는 일이 되풀이됐다). 서버(checkSelection)도 같은 상한을 쓴다.
export const MAX_PICKED_MISSIONS = 2

export function getMissionPick({ rounds, isFirstRound, selectedIds }) {
  const missions = getVisibleMissions((rounds ?? []).findLast((round) => !round.flagged))
  const mustPick = !isFirstRound && missions.some((mission) => mission.id)
  return {
    missions,
    mustPick,
    needsPick: mustPick && selectedIds.length === 0,
    isPickFull: mustPick && selectedIds.length >= MAX_PICKED_MISSIONS,
  }
}

export const UNCHANGED_WRITING_MESSAGE = '고친 곳이 없어요. 미션을 보고 글을 고친 다음 다시 코칭 받아요.'

// 마지막으로 코칭받은 글(반려되지 않은 마지막 회차 = 서버의 lastSubmittedWriting)과
// 지금 글이 같은가. 공백 덩어리는 한 칸으로 보고 앞뒤 공백은 무시한다 —
// 줄바꿈·띄어쓰기 수만 바꾼 글은 "안 고친 글"이다. 단, 붙어 있던 낱말 사이에
// 새로 띄어 쓴 것은 고친 것으로 친다. 코칭받은 글이 없으면(첫 회차) false.
export function isUnchangedWriting(previousWriting, writing) {
  if (typeof previousWriting !== 'string') return false
  const normalize = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()
  return normalize(previousWriting) === normalize(writing)
}

// 학생 화면에서 비교할 "마지막으로 코칭받은 글".
export function getLastCoachedWriting(rounds) {
  return (rounds ?? []).findLast((round) => !round.flagged)?.writing ?? null
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
