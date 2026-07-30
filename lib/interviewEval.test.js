import { describe, expect, it } from 'vitest'
import {
  aggregateEvalResults,
  evaluateThresholds,
  parseEvalArgs,
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
    expect(violations).toContain('제목이 행동 명사형으로 끝나지 않음')
    expect(violations).toContain('행동 방법이 없는 모호한 미션')
    expect(violations).toContain('다음 라운드 확인 기준 누락')
  })

  it('reports a copyable example sentence as a mission violation', () => {
    expect(scoreMissionCase({
      allowedMissionCriterionSets: [[['new-fact']]],
    }, {
      missions: [{
        criterionIds: ['new-fact'],
        title: '새 사실 덧붙이기',
        instruction: "예를 들어, '친구들이 권해서 시작했다'라고 써 보세요.",
        criterion: '새 사실이 추가되었는가',
      }],
    })).toContain('학생이 베낄 예시 문장')
  })

  it('checks prior mission statuses and rejects non-action mission wording', () => {
    const violations = scoreMissionCase({
      allowedMissionCriterionSets: [[['closing']]],
      expectedPriorMissionStatuses: [{ missionId: 'old-1', status: 'not-done' }],
    }, {
      priorMissions: [{ missionId: 'made-up', status: 'done' }],
      missions: [{
        criterionIds: ['closing'],
        title: '면담 이야기',
        instruction: '면담 뒤의 생각을 중심으로 생각해 보세요.',
        criterion: '느낀 점이 추가되었는가',
      }],
    })

    expect(violations).toContain('지난 수정미션 판정 불일치')
    expect(violations).toContain('제목이 행동 명사형으로 끝나지 않음')
    expect(violations).toContain('실행 동작이 없는 미션')
  })
})

describe('parseEvalArgs', () => {
  it('parses the set and run count with safe defaults', () => {
    expect(parseEvalArgs([])).toEqual({ set: 'dev', runs: 1 })
    expect(parseEvalArgs(['--set', 'validation', '--runs', '3'])).toEqual({
      set: 'validation',
      runs: 3,
    })
  })

  it('rejects unknown sets and invalid run counts', () => {
    expect(() => parseEvalArgs(['--set', 'train'])).toThrow('평가셋')
    expect(() => parseEvalArgs(['--runs', '0'])).toThrow('실행 횟수')
    expect(() => parseEvalArgs(['--runs', 'nine'])).toThrow('실행 횟수')
  })
})

describe('aggregateEvalResults', () => {
  it('aggregates agreement, schema, stability, and violations', () => {
    const metrics = aggregateEvalResults([
      {
        caseId: 'case-1',
        run: 1,
        assessment: {
          matches: 6,
          total: 7,
          meaninglessMatch: true,
          hallucinatedMet: 0,
          contradictions: 0,
          schemaValid: true,
        },
        signature: 'same',
        missionViolations: [],
      },
      {
        caseId: 'case-1',
        run: 2,
        assessment: {
          matches: 7,
          total: 7,
          meaninglessMatch: true,
          hallucinatedMet: 0,
          contradictions: 0,
          schemaValid: true,
        },
        signature: 'same',
        missionViolations: [],
      },
    ])

    expect(metrics).toMatchObject({
      agreement: 13 / 14,
      schemaRate: 1,
      stability: 1,
      meaninglessRate: 1,
      hallucinatedMet: 0,
      contradictions: 0,
      missionViolations: 0,
    })
  })
})

describe('evaluateThresholds', () => {
  const passing = {
    agreement: 0.92,
    schemaRate: 1,
    stability: 1,
    meaninglessRate: 1,
    hallucinatedMet: 0,
    contradictions: 0,
    missionViolations: 0,
  }

  it('passes development and validation metrics at their exact thresholds', () => {
    expect(evaluateThresholds(passing, { set: 'dev', runs: 3 })).toEqual([])
    expect(evaluateThresholds({ ...passing, agreement: 0.85 }, {
      set: 'validation',
      runs: 1,
    })).toEqual([])
  })

  it('lists every failed mandatory threshold', () => {
    expect(evaluateThresholds({
      agreement: 0.8,
      schemaRate: 0.9,
      stability: 0.8,
      meaninglessRate: 0.5,
      hallucinatedMet: 1,
      contradictions: 1,
      missionViolations: 2,
    }, { set: 'dev', runs: 3 })).toEqual([
      '판정 일치율',
      'JSON 스키마 성공률',
      '3회 판정 안정성',
      '무의미 글 판별',
      '글에 없는 충족 추측',
      '논리 모순',
      '수정미션 위반',
    ])
  })
})
