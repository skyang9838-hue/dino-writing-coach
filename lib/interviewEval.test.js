import { describe, expect, it } from 'vitest'
import {
  scoreAssessmentCase,
  scoreMissionCase,
} from './interviewEval.js'

const expected = {
  meaningless: false,
  criteria: [
    { criterionId: 'purpose', status: 'met' },
    { criterionId: 'interviewee', status: 'met' },
    { criterionId: 'new-fact', status: 'partial' },
    { criterionId: 'fact-detail', status: 'unmet' },
  ],
}

describe('scoreAssessmentCase', () => {
  it('counts exact agreement and schema success', () => {
    expect(scoreAssessmentCase(expected, {
      meaningless: false,
      criteria: [
        { criterionId: 'purpose', status: 'met' },
        { criterionId: 'interviewee', status: 'partial' },
        { criterionId: 'new-fact', status: 'partial' },
        { criterionId: 'fact-detail', status: 'unmet' },
      ],
    })).toEqual({
      matches: 3,
      total: 4,
      meaninglessMatch: true,
      hallucinatedMet: 0,
      contradictions: 0,
      schemaValid: true,
    })
  })

  it('detects hallucinated met, contradiction, and malformed criterion sets', () => {
    const scored = scoreAssessmentCase(expected, {
      meaningless: false,
      criteria: [
        { criterionId: 'purpose', status: 'met' },
        { criterionId: 'interviewee', status: 'met' },
        { criterionId: 'new-fact', status: 'unmet' },
        { criterionId: 'fact-detail', status: 'met' },
      ],
    })

    expect(scored.hallucinatedMet).toBe(1)
    expect(scored.contradictions).toBe(1)

    expect(scoreAssessmentCase(expected, {
      meaningless: false,
      criteria: [{ criterionId: 'purpose', status: 'met' }],
    }).schemaValid).toBe(false)
  })
})

describe('scoreMissionCase', () => {
  const fixture = {
    allowedMissionCriterionSets: [
      [['new-fact', 'fact-detail']],
      [['new-fact', 'fact-detail'], ['closing']],
    ],
  }

  it('accepts actionable missions from an allowed criterion set', () => {
    expect(scoreMissionCase(fixture, {
      missions: [{
        criterionIds: ['new-fact', 'fact-detail'],
        title: '새 사실에 까닭 추가하기',
        instruction: '새롭게 알게 된 사실 뒤에 면담에서 들은 까닭을 하나 덧붙여 보세요.',
        criterion: '새 사실에 면담에서 들은 까닭이 하나 추가되었는가',
      }],
    })).toEqual([])
  })

  it('reports unknown targets, duplicates, invalid titles, vague advice, and missing criteria', () => {
    const violations = scoreMissionCase(fixture, {
      missions: [
        {
          criterionIds: ['purpose'],
          title: '자세히 쓰기',
          instruction: '내용을 더 자세히 써 보세요.',
          criterion: '',
        },
        {
          criterionIds: ['purpose'],
          title: '고쳐 보세요',
          instruction: '내용을 보충하세요.',
          criterion: '내용이 추가되었는가',
        },
      ],
    })

    expect(violations).toContain('허용되지 않은 수정 대상 조합')
    expect(violations).toContain('중복 수정미션')
    expect(violations).toContain('제목이 ~하기로 끝나지 않음')
    expect(violations).toContain('행동 방법이 없는 모호한 미션')
    expect(violations).toContain('다음 라운드 확인 기준 누락')
  })
})
