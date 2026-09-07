import { describe, expect, it } from 'vitest'
import { ratchetAssessments } from './assessmentRatchet.js'

const at = (criterionId, status) => ({ rubricId: 'r1', criterionId, status })

describe('ratchetAssessments', () => {
  it('returns the current assessments unchanged when there is no previous round', () => {
    const current = [at('a', 'met'), at('b', 'unmet')]
    expect(ratchetAssessments(current, null)).toEqual(current)
    expect(ratchetAssessments(current, undefined)).toEqual(current)
    expect(ratchetAssessments(current, [])).toEqual(current)
  })

  // 이것이 이 파일의 존재 이유다. 글이 조금 바뀌었다고 이미 충족한 기준이
  // 미충족으로 되돌아가면, 학생은 자기가 지운 적 없는 것이 사라졌다고 본다.
  it('never lets a met criterion fall back', () => {
    const previous = [at('a', 'met'), at('b', 'met')]
    const current = [at('a', 'unmet'), at('b', 'partial')]
    expect(ratchetAssessments(current, previous)).toEqual([at('a', 'met'), at('b', 'met')])
  })

  it('never lets a partial criterion fall to unmet', () => {
    expect(ratchetAssessments([at('a', 'unmet')], [at('a', 'partial')]))
      .toEqual([at('a', 'partial')])
  })

  it('lets a criterion rise', () => {
    expect(ratchetAssessments([at('a', 'met')], [at('a', 'unmet')])).toEqual([at('a', 'met')])
    expect(ratchetAssessments([at('a', 'partial')], [at('a', 'unmet')])).toEqual([at('a', 'partial')])
    expect(ratchetAssessments([at('a', 'met')], [at('a', 'partial')])).toEqual([at('a', 'met')])
  })

  it('keeps the order and shape of the current assessments', () => {
    const current = [at('b', 'unmet'), at('a', 'unmet'), at('c', 'met')]
    const previous = [at('a', 'met'), at('b', 'met'), at('c', 'met')]
    expect(ratchetAssessments(current, previous).map((a) => a.criterionId)).toEqual(['b', 'a', 'c'])
  })

  // 단원의 기준이 바뀌면 양쪽 목록이 어긋난다. 새 기준은 그대로 들어오고,
  // 사라진 옛 기준은 되살아나지 않아야 한다.
  it('ignores criteria that only one side has', () => {
    const current = [at('a', 'unmet'), at('new', 'partial')]
    const previous = [at('a', 'met'), at('gone', 'met')]
    expect(ratchetAssessments(current, previous)).toEqual([at('a', 'met'), at('new', 'partial')])
  })

  // criterionId는 단원 안에서 고유하지만, 매칭 키에 rubricId를 함께 넣어
  // 다른 루브릭의 같은 이름이 서로를 끌어올리지 않게 한다.
  it('matches on rubricId and criterionId together', () => {
    const current = [{ rubricId: 'r2', criterionId: 'a', status: 'unmet' }]
    const previous = [{ rubricId: 'r1', criterionId: 'a', status: 'met' }]
    expect(ratchetAssessments(current, previous)).toEqual(current)
  })
})
