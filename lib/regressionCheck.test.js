import { describe, expect, it } from 'vitest'
import { getUnitCoachingSpec } from './coaching.js'
import { INTERVIEW_REPORT_UNIT_ID } from './curriculum.js'
import {
  applyRegressionChecks,
  buildRegressionCheckPrompt,
  buildRegressionCheckSchema,
  findDrops,
  validateRegressionChecks,
} from './regressionCheck.js'

const at = (criterionId, status) => ({ rubricId: 'r1', criterionId, status })

describe('findDrops', () => {
  it('finds nothing without a previous round', () => {
    expect(findDrops([at('a', 'unmet')], null)).toEqual([])
    expect(findDrops([at('a', 'unmet')], [])).toEqual([])
  })

  it('lists only the criteria that went down', () => {
    const previous = [at('a', 'met'), at('b', 'partial'), at('c', 'unmet'), at('d', 'met')]
    const current = [at('a', 'partial'), at('b', 'unmet'), at('c', 'met'), at('d', 'met')]
    expect(findDrops(current, previous)).toEqual([
      { criterionId: 'a', from: 'met', to: 'partial' },
      { criterionId: 'b', from: 'partial', to: 'unmet' },
    ])
  })

  // 단원의 기준이 바뀌면 양쪽 목록이 어긋난다. 한쪽에만 있는 기준은 비교하지 않는다.
  it('ignores criteria that only one side has', () => {
    expect(findDrops([at('new', 'unmet')], [at('gone', 'met')])).toEqual([])
  })
})

describe('applyRegressionChecks', () => {
  const current = [at('a', 'partial'), at('b', 'unmet'), at('c', 'met')]

  it('restores the previous verdict only where the check found no real regression', () => {
    expect(applyRegressionChecks(current, [
      { criterionId: 'a', from: 'met', to: 'partial', regressed: false },
      { criterionId: 'b', from: 'partial', to: 'unmet', regressed: true },
    ])).toEqual([at('a', 'met'), at('b', 'unmet'), at('c', 'met')])
  })

  it('returns the current verdicts untouched when there were no checks', () => {
    expect(applyRegressionChecks(current, [])).toBe(current)
  })
})

describe('the regression check call', () => {
  const spec = getUnitCoachingSpec(INTERVIEW_REPORT_UNIT_ID)
  const drops = [{ criterionId: 'reflection', from: 'met', to: 'partial' }]

  it('shows both versions and only the dropped criteria', () => {
    const prompt = buildRegressionCheckPrompt({
      spec,
      previousWriting: '예전 글',
      writing: '이번 글',
      changes: { added: '더한 말', removed: '' },
      drops,
    })
    expect(prompt).toContain('예전 글')
    expect(prompt).toContain('이번 글')
    expect(prompt).toContain('더한 말')
    expect(prompt).toContain('criterionId=reflection')
    expect(prompt).toContain('met → 이번 판정: partial')
    expect(prompt).not.toContain('criterionId=preparation')
  })

  it('accepts exactly one answer per dropped criterion', () => {
    expect(buildRegressionCheckSchema(drops).properties.checks.items.properties.criterionId.enum).toEqual(['reflection'])
    expect(() => validateRegressionChecks({ checks: [{ criterionId: 'reflection', regressed: false }] }, drops)).not.toThrow()
    expect(() => validateRegressionChecks({ checks: [] }, drops)).toThrow()
    expect(() => validateRegressionChecks({ checks: [{ criterionId: 'other', regressed: true }] }, drops)).toThrow()
    expect(() => validateRegressionChecks({ checks: [{ criterionId: 'reflection', regressed: 'yes' }] }, drops)).toThrow()
  })
})
