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

  // 아래 네 개는 실제 교실에서 나온 두 가지 반대 방향의 실패를 고정한다.
  // 스페이스만 눌러 분량을 채우는 아이는 잡아야 하고, 엔터 대신 스페이스를
  // 길게 눌러 문단을 나누는 아이는 통과시켜야 한다.
  it('flags whitespace-only text long enough to fake a target length', () => {
    expect(checkGuard(' '.repeat(400))).toEqual({ flagged: true, reason: 'nonsense' })
    expect(checkGuard('\n'.repeat(400))).toEqual({ flagged: true, reason: 'nonsense' })
  })

  it('flags a long run of consecutive spaces inside otherwise normal writing', () => {
    const text = '오늘은 학교에서 친구들과 재미있게 놀았다.' + ' '.repeat(40) + '내일도 놀고 싶다.'
    expect(checkGuard(text)).toEqual({ flagged: true, reason: 'nonsense' })
  })

  it('does not flag a student who presses space instead of enter between sentences', () => {
    const gap = ' '.repeat(12)
    const text = `오늘은 즐거웠다.${gap}내일도 가고 싶다.${gap}정말 신났다.${gap}또 오고 싶다.`
    expect(checkGuard(text)).toEqual({ flagged: false, reason: null })
  })

  it('does not flag shorter space gaps between sentences', () => {
    const gap = ' '.repeat(5)
    const text = `오늘은 즐거웠다.${gap}내일도 가고 싶다.${gap}정말 신났다.`
    expect(checkGuard(text)).toEqual({ flagged: false, reason: null })
  })
})
