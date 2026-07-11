import { describe, expect, it } from 'vitest'
import { checkGuard } from './guard.js'

describe('checkGuard', () => {
  it('does not flag empty or whitespace-only text', () => {
    expect(checkGuard('')).toEqual({ flagged: false, reason: null })
    expect(checkGuard('   ')).toEqual({ flagged: false, reason: null })
  })

  it('does not flag normal Korean writing', () => {
    const text = '오늘은 학교에서 친구들과 재미있는 시간을 보냈다. 다음에도 또 놀고 싶다.'
    expect(checkGuard(text)).toEqual({ flagged: false, reason: null })
  })

  it('flags a long run of standalone jamo (keyboard mashing)', () => {
    expect(checkGuard('ㅁㄴㅇㄹㅁㄴㅇㄹ')).toEqual({ flagged: true, reason: 'nonsense' })
  })

  it('does not flag short casual jamo laughter', () => {
    expect(checkGuard('ㅋㅋㅋ 진짜 웃기다')).toEqual({ flagged: false, reason: null })
  })

  it('does not flag legitimate repeated-character expression', () => {
    expect(checkGuard('하하하하 정말 재미있었다')).toEqual({ flagged: false, reason: null })
    expect(checkGuard('심장이 두근두근두근 뛰었다!!!!')).toEqual({ flagged: false, reason: null })
  })

  it('flags a long run of the same repeated character', () => {
    expect(checkGuard('가가가가가가가가가가가가')).toEqual({ flagged: true, reason: 'nonsense' })
  })

  it('flags the same character repeated with single spaces between (spacebar padding)', () => {
    expect(checkGuard('가 가 가 가 가 가 가 가 가 가 가 가')).toEqual({ flagged: true, reason: 'nonsense' })
  })

  it('flags text padded mostly with spaces to reach a target length', () => {
    const text = '좋다' + ' '.repeat(40)
    expect(checkGuard(text)).toEqual({ flagged: true, reason: 'nonsense' })
  })

  it('flags a long text with a high ratio of standalone jamo spread throughout', () => {
    const text = 'ㅁㅁ나ㅇㅇ는ㄴㄴ오ㄹㄹ늘ㅁㄴ학ㅇㄹ교ㅁㄴ에ㅇㄹ서ㅁㄴ밥ㅇㄹ을'
    expect(checkGuard(text)).toEqual({ flagged: true, reason: 'nonsense' })
  })

  it('does not apply the jamo-ratio check to short text', () => {
    expect(checkGuard('ㅋㅋ')).toEqual({ flagged: false, reason: null })
  })
})
