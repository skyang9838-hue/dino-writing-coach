import { describe, expect, it } from 'vitest'
import {
  ATTAINMENT_START,
  computeNextAttainment,
  computeRubricAttainment,
} from './attainment.js'

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

    const revisionCount = 1000
    let attainment = computeNextAttainment(null, null)
    for (let revision = 0; revision < revisionCount; revision += 1) {
      attainment = computeNextAttainment(attainment, [true, true])
    }
    expect(attainment).toBe(ATTAINMENT_START + revisionCount * 20)
  })

  it('falls back to ATTAINMENT_START as the base when currentAttainment is null but addressed is present', () => {
    expect(computeNextAttainment(null, [true, true])).toBe(60)
  })
})

describe('computeRubricAttainment', () => {
  it('averages met, partial, and unmet as 1, 0.5, and 0', () => {
    expect(computeRubricAttainment([
      { status: 'met' },
      { status: 'partial' },
      { status: 'unmet' },
    ])).toBe(50)
  })

  it('rounds to the nearest whole percentage and rejects invalid input', () => {
    expect(computeRubricAttainment([
      { status: 'met' },
      { status: 'partial' },
      { status: 'partial' },
    ])).toBe(67)
    expect(() => computeRubricAttainment([])).toThrow('판정')
    expect(() => computeRubricAttainment([{ status: 'almost' }])).toThrow('상태')
  })
})
