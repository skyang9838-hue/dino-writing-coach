// 판정은 회차마다 백지에서 다시 매겨진다 — 판정 프롬프트는 지난 회차의
// 결과를 받지 않고, 스키마가 매번 전 기준을 다시 판정하도록 강제한다. 그래서
// 학생이 건드리지도 않은 기준이 글의 다른 곳이 바뀌었다는 이유로 뒤집히는
// 일이 실제로 일어났다(2026-08-02, 같은 267자 글이 두 번 다르게 읽혔다).
//
// 여기서 한 방향으로만 움직이게 잠근다: 한 번 올라간 판정은 내려오지 않는다.
// 모델이 실제로 뭐라고 했는지는 라운드의 rawAssessments에 따로 남는다.
export const STATUS_ORDER = { unmet: 0, partial: 1, met: 2 }

const keyOf = (assessment) => `${assessment.rubricId}::${assessment.criterionId}`

export function ratchetAssessments(current, previous) {
  if (!previous?.length) return current

  const previousByKey = new Map(previous.map((assessment) => [keyOf(assessment), assessment.status]))

  return current.map((assessment) => {
    const previousStatus = previousByKey.get(keyOf(assessment))
    if (previousStatus === undefined) return assessment

    const rose = (STATUS_ORDER[assessment.status] ?? 0) >= (STATUS_ORDER[previousStatus] ?? 0)
    return rose ? assessment : { ...assessment, status: previousStatus }
  })
}
