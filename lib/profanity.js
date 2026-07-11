// Starter list of unambiguous Korean profanity/slang — deliberately small and
// conservative. Words with real, common non-profane meanings (e.g. 걸레
// "rag", 죽어 as in "dying" in a nature/story context, 미친 as a casual
// intensifier) are intentionally excluded to avoid false positives on normal
// student writing. This list is meant to be reviewed and extended by the
// teacher/developer, not treated as exhaustive.
export const PROFANITY_WORDS = [
  '시발',
  '씨발',
  '씨발놈',
  '씨발년',
  'ㅅㅂ',
  'ㅆㅂ',
  '개새끼',
  '개색기',
  '개새꺄',
  '병신',
  'ㅄ',
  '좆같',
  '좆까',
  '지랄',
  '존나',
  '존나게',
  '닥쳐',
  '닥치라고',
]

export function containsProfanity(text) {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return false
  return PROFANITY_WORDS.some((word) => trimmed.includes(word))
}
