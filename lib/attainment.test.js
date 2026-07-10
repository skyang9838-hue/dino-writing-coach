import { describe, expect, it } from 'vitest'
import { ATTAINMENT_START, computeNextAttainment } from './attainment.js'

describe('computeNextAttainment', () => {
  it('starts at 40% on the first round (no addressed array yet)', () => {
    expect(computeNextAttainment(null, null)).toBe(ATTAINMENT_START)
    expect(computeNextAttainment(null, undefined)).toBe(ATTAINMENT_START)
  })

  it('adds 10% per fixed improvement on later rounds', () => {
    expect(computeNextAttainment(40, [true, true])).toBe(60)
    expect(computeNextAttainment(40, [true, false])).toBe(50)
    expect(computeNextAttainment(40, [false, false])).toBe(40)
  })

  it('has no upper cap and keeps compounding across rounds', () => {
    expect(computeNextAttainment(80, [true, true])).toBe(100)
    expect(computeNextAttainment(100, [true, true])).toBe(120)
    expect(computeNextAttainment(120, [true, true])).toBe(140)
  })

  it('falls back to ATTAINMENT_START as the base when currentAttainment is null but addressed is present', () => {
    expect(computeNextAttainment(null, [true, true])).toBe(60)
  })
})
