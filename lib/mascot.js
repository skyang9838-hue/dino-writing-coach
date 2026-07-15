// Maps the current attainment percentage to a dino expression (an image in
// public/dino/) and a short encouragement line, for the floating mascot on
// the write screen's attainment track. Thresholds mirror the natural
// progression of lib/attainment.js (40% start, +10% per fixed mission).
export function getMascotState(attainment) {
  if (attainment === null) {
    return { face: 'face-default', message: '글을 다 쓰면 코칭을 받을 수 있어요!' }
  }
  if (attainment >= 100) {
    return { face: 'face-love', message: `${attainment}% 달성! 완벽해요! 🎉` }
  }
  if (attainment >= 70) {
    return { face: 'face-good', message: `${attainment}% 달성! 정말 잘하고 있어요!` }
  }
  if (attainment >= 40) {
    return { face: 'face-think', message: `${attainment}% 달성! 조금만 더 다듬어볼까요?` }
  }
  return { face: 'face-default', message: `${attainment}% 달성! 다시 화이팅!` }
}
