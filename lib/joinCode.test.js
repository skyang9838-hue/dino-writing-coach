import { describe, expect, it } from 'vitest'
import { generateJoinCode } from './joinCode.js'

describe('generateJoinCode', () => {
  it('generates a 6-character code', () => {
    expect(generateJoinCode()).toHaveLength(6)
  })

  it('excludes visually ambiguous characters (0/O, 1/I/L)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode()
      expect(code).not.toMatch(/[0O1IL]/)
    }
  })

  it('produces different codes across calls (not deterministic)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateJoinCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
