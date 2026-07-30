export const ATTAINMENT_START = 40
export const ATTAINMENT_PER_POINT = 10

// `addressed` is null/undefined on the first coaching round (no attainment yet
// to build on). On later rounds it's a boolean[] of which of the previous
// round's two improvement missions were fixed.
export function computeNextAttainment(currentAttainment, addressed) {
  if (!addressed) return ATTAINMENT_START
  const fixedCount = addressed.filter(Boolean).length
  return (currentAttainment ?? ATTAINMENT_START) + fixedCount * ATTAINMENT_PER_POINT
}

const RUBRIC_STATUS_POINTS = {
  met: 1,
  partial: 0.5,
  unmet: 0,
}

export function computeRubricAttainment(assessments) {
  if (!Array.isArray(assessments) || assessments.length === 0) {
    throw new Error('루브릭 판정이 하나 이상 필요함')
  }

  const points = assessments.map((assessment) => {
    const point = RUBRIC_STATUS_POINTS[assessment.status]
    if (point === undefined) {
      throw new Error(`알 수 없는 루브릭 판정 상태: ${assessment.status}`)
    }
    return point
  })

  return Math.round((points.reduce((sum, point) => sum + point, 0) / points.length) * 100)
}
