// Rule-based nonsense detection: jamo mashing and spacebar/space padding used
// to fake reaching the target character count. Deliberately conservative
// (favors false negatives) since legitimate writing often repeats characters
// for effect (하하하, ㅋㅋㅋ, !!!, 두근두근두근).
export const JAMO_RUN_MIN_LENGTH = 8
export const REPEATED_CHAR_MIN_LENGTH = 12
export const MIN_LENGTH_FOR_RATIO_CHECKS = 20
export const JAMO_RATIO_THRESHOLD = 0.3
export const WHITESPACE_RATIO_THRESHOLD = 0.5
// 엔터 대신 스페이스를 길게 눌러 문단을 나누는 아이가 실제로 있다. 그건
// 분량 채우기가 아니므로 통과시켜야 하고, 서른 칸을 내리 누르는 건 통과시킬
// 이유가 없다. 이 하나가 공백 도배 판정의 주력이다.
export const MAX_WHITESPACE_RUN = 30

// Hangul Compatibility Jamo block: standalone ㄱ-ㅣ, never appears inside a
// complete syllable (those live in the separate AC00-D7A3 block).
const JAMO_CHAR_REGEX = /[ㄱ-ㅣ]/g
const JAMO_RUN_REGEX = new RegExp(`[\\u3131-\\u3163]{${JAMO_RUN_MIN_LENGTH},}`)
const REPEATED_CHAR_REGEX = new RegExp(`(\\S)( ?\\1){${REPEATED_CHAR_MIN_LENGTH - 1},}`)
const WHITESPACE_RUN_REGEX = new RegExp(`\\s{${MAX_WHITESPACE_RUN},}`)

function jamoRatio(nonSpace) {
  if (!nonSpace.length) return 0
  return (nonSpace.match(JAMO_CHAR_REGEX) ?? []).length / nonSpace.length
}

// 이어진 공백을 한 칸으로 접고 나서 잰다. 접기 전 비율로 재면 문장 사이에
// 스페이스를 여러 번 누른 멀쩡한 글이 걸렸다 — 짧은 문장 넷을 열두 칸씩
// 띄운 글의 비율이 0.67이었다. 접으면 그런 글은 보통 글과 같은 0.2대로
// 내려오고, 글자마다 공백을 끼워 넣은 글은 그대로 0.5를 넘는다.
function whitespaceRatio(text) {
  const collapsed = text.replace(/\s+/g, ' ')
  if (!collapsed.length) return 0
  return (collapsed.match(/\s/g) ?? []).length / collapsed.length
}

function isNonsense(text) {
  if (JAMO_RUN_REGEX.test(text)) return true
  if (REPEATED_CHAR_REGEX.test(text)) return true
  if (WHITESPACE_RUN_REGEX.test(text)) return true
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
  //
  // 공백뿐인 글도 길면 잡는다. 예전에는 여기서 무조건 통과시켰는데,
  // requestCoaching의 목표 글자 수 검사가 공백을 포함한 writing.length를
  // 보기 때문에 스페이스 400개가 400자를 채운 글로 인정돼 Gemini까지 갔다.
  // 짧은 빈 입력은 그 길이 검사가 알아서 막으므로 그대로 통과시킨다.
  if (!raw.trim()) {
    return raw.length >= MIN_LENGTH_FOR_RATIO_CHECKS
      ? { flagged: true, reason: 'nonsense' }
      : { flagged: false, reason: null }
  }
  if (isNonsense(raw)) return { flagged: true, reason: 'nonsense' }
  return { flagged: false, reason: null }
}
