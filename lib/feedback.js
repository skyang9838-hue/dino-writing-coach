export function getVisibleMissions(feedback) {
  if (Array.isArray(feedback?.missions)) {
    return feedback.missions.map((mission) => ({
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
  if (status === 'attempted') return '🔄'
  return '❌'
}
