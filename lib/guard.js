// Rule-based nonsense detection: jamo mashing and spacebar/space padding used
// to fake reaching the target character count. Deliberately conservative
// (favors false negatives) since legitimate writing often repeats characters
// for effect (하하하, ㅋㅋㅋ, !!!, 두근두근두근).
export const JAMO_RUN_MIN_LENGTH = 8
export const REPEATED_CHAR_MIN_LENGTH = 12
export const MIN_LENGTH_FOR_RATIO_CHECKS = 20
export const JAMO_RATIO_THRESHOLD = 0.3
export const WHITESPACE_RATIO_THRESHOLD = 0.5

// Hangul Compatibility Jamo block: standalone ㄱ-ㅣ, never appears inside a
// complete syllable (those live in the separate AC00-D7A3 block).
const JAMO_CHAR_REGEX = /[ㄱ-ㅣ]/g
const JAMO_RUN_REGEX = new RegExp(`[\\u3131-\\u3163]{${JAMO_RUN_MIN_LENGTH},}`)
const REPEATED_CHAR_REGEX = new RegExp(`(\\S)( ?\\1){${REPEATED_CHAR_MIN_LENGTH - 1},}`)

function jamoRatio(nonSpace) {
  if (!nonSpace.length) return 0
  return (nonSpace.match(JAMO_CHAR_REGEX) ?? []).length / nonSpace.length
}

function whitespaceRatio(text) {
  const whitespaceCount = (text.match(/\s/g) ?? []).length
  return whitespaceCount / text.length
}

function isNonsense(text) {
  if (JAMO_RUN_REGEX.test(text)) return true
  if (REPEATED_CHAR_REGEX.test(text)) return true
  if (text.length >= MIN_LENGTH_FOR_RATIO_CHECKS) {
    if (whitespaceRatio(text) >= WHITESPACE_RATIO_THRESHOLD) return true
    if (jamoRatio(text.replace(/\s/g, '')) >= JAMO_RATIO_THRESHOLD) return true
  }
  return false
}

export function checkGuard(text) {
  const raw = text ?? ''
  // Check the untrimmed text so trailing space-padding (used to fake
  // reaching the target character count) isn't stripped away first.
  if (!raw.trim()) return { flagged: false, reason: null }
  if (isNonsense(raw)) return { flagged: true, reason: 'nonsense' }
  return { flagged: false, reason: null }
}
