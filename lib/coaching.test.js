import { describe, expect, it } from 'vitest'
import { buildFirstRoundPrompt, buildRevisionPrompt } from './coaching.js'

describe('buildFirstRoundPrompt', () => {
  it('embeds the topic and the full writing', () => {
    const prompt = buildFirstRoundPrompt('가을 소풍', '오늘은 소풍을 갔다.')
    expect(prompt).toContain('가을 소풍')
    expect(prompt).toContain('오늘은 소풍을 갔다.')
  })

  it('appends genre-specific coaching guidance when a known genre is given', () => {
    const prompt = buildFirstRoundPrompt('가을 소풍', '오늘은 소풍을 갔다.', '주장하는 글')
    expect(prompt).toContain('근거가 있는지')
  })

  it('omits genre guidance when no genre or an unknown genre is given', () => {
    const withoutGenre = buildFirstRoundPrompt('가을 소풍', '오늘은 소풍을 갔다.')
    const withUnknownGenre = buildFirstRoundPrompt('가을 소풍', '오늘은 소풍을 갔다.', '시')
    expect(withoutGenre).not.toContain('종류의 글이야')
    expect(withUnknownGenre).not.toContain('종류의 글이야')
  })
})

describe('buildRevisionPrompt', () => {
  it('embeds the previous writing, both prior improvements, and the revised writing', () => {
    const prompt = buildRevisionPrompt(
      '가을 소풍',
      '옛날 글',
      ['문단을 나눠보세요', '결론을 추가하세요'],
      '새로운 글',
    )
    expect(prompt).toContain('옛날 글')
    expect(prompt).toContain('문단을 나눠보세요')
    expect(prompt).toContain('결론을 추가하세요')
    expect(prompt).toContain('새로운 글')
  })

  it('appends genre-specific coaching guidance when a known genre is given', () => {
    const prompt = buildRevisionPrompt(
      '가을 소풍',
      '옛날 글',
      ['문단을 나눠보세요', '결론을 추가하세요'],
      '새로운 글',
      '일기',
    )
    expect(prompt).toContain('그때 느낀 감정')
  })
})
