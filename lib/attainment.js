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
