import { describe, expect, it } from 'vitest'
import { containsProfanity } from './profanity.js'

describe('containsProfanity', () => {
  it('does not flag normal Korean writing', () => {
    expect(containsProfanity('오늘은 학교에서 친구들과 재미있게 놀았다.')).toBe(false)
  })

  it('does not flag empty text', () => {
    expect(containsProfanity('')).toBe(false)
  })

  it('flags a listed profanity word appearing as a substring of a sentence', () => {
    expect(containsProfanity('이 게임 진짜 시발 재밌다')).toBe(true)
  })

  it('flags a listed profanity word even without surrounding spaces', () => {
    expect(containsProfanity('완전병신같은상황이었다')).toBe(true)
  })
})
