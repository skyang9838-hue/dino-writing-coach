import { describe, expect, it } from 'vitest'
import {
  aggregateEvalResults,
  evaluateThresholds,
  parseEvalArgs,
  scoreAssessmentCase,
  scoreMissionCase,
  scoreProgressionCase,
} from './interviewEval.js'

const expected = {
  meaningless: false,
  criteria: [
    { criterionId: 'purpose-and-target', status: 'met' },
    { criterionId: 'preparation', status: 'met' },
    { criterionId: 'learned-facts', status: 'partial' },
    { criterionId: 'reflection', status: 'unmet' },
  ],
}

describe('scoreAssessmentCase', () => {
  it('counts exact agreement and schema success', () => {
    expect(scoreAssessmentCase(expected, {
      meaningless: false,
      criteria: [
        { criterionId: 'purpose-and-target', status: 'met' },
        { criterionId: 'preparation', status: 'partial' },
        { criterionId: 'learned-facts', status: 'partial' },
        { criterionId: 'reflection', status: 'unmet' },
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

  // The contradiction count used to catch a 구체적 설명 claimed without a
  // 새 사실. The four criteria are independent, so no pair of statuses is
  // impossible any more and the count stays at 0 — the metric is still
  // reported and gated so it can be filled in again for a future unit.
  it('detects hallucinated met and malformed criterion sets, and finds no contradictions', () => {
    const scored = scoreAssessmentCase(expected, {
      meaningless: false,
      criteria: [
        { criterionId: 'purpose-and-target', status: 'met' },
        { criterionId: 'preparation', status: 'met' },
        { criterionId: 'learned-facts', status: 'unmet' },
        { criterionId: 'reflection', status: 'met' },
      ],
    })

    expect(scored.hallucinatedMet).toBe(1)
    expect(scored.contradictions).toBe(0)

    expect(scoreAssessmentCase(expected, {
      meaningless: false,
      criteria: [{ criterionId: 'purpose-and-target', status: 'met' }],
    }).schemaValid).toBe(false)
  })
})

describe('scoreMissionCase', () => {
  const mission = (id, criterionId, overrides = {}) => ({
    id,
    criterionIds: [criterionId],
    title: '새 사실에 까닭 추가하기',
    instruction: '새롭게 알게 된 사실 뒤에 면담에서 들은 까닭을 하나 덧붙여 보세요.',
    criterion: '새 사실에 면담에서 들은 까닭이 하나 추가되었는가',
    ...overrides,
  })
  const three = [mission('m1', 'learned-facts'), mission('m2', 'reflection'), mission('m3', 'learned-facts')]

  it('accepts three missions on known criteria, even two on the same criterion', () => {
    expect(scoreMissionCase({}, { missions: three })).toEqual([])
  })

  it('rejects a meaningful result without three missions or with a terminal state', () => {
    const violations = scoreMissionCase({}, { complete: true, missions: three.slice(0, 1) })

    expect(violations).toContain('수정미션 개수가 3개가 아님')
    expect(violations).toContain('종료 상태가 생성됨')
  })

  it('allows fewer missions when every criterion is met', () => {
    expect(scoreMissionCase({}, {
      assessments: [{ criterionId: 'reflection', status: 'met' }],
      missions: [],
    })).toEqual([])
  })

  it('reports unknown criteria, duplicate ids, vague advice, copyable examples, and missing fields', () => {
    const violations = scoreMissionCase({}, {
      missions: [
        mission('m1', 'made-up', { instruction: '내용을 더 자세히 써 보세요.', criterion: '' }),
        mission('m1', 'reflection', { instruction: "예를 들어, '친구들이 권해서 시작했다'라고 써 보세요." }),
        mission('m3', 'reflection', { title: '' }),
      ],
    })

    expect(violations).toContain('알 수 없는 채점기준')
    expect(violations).toContain('중복 수정미션 ID')
    expect(violations).toContain('행동 방법이 없는 모호한 미션')
    expect(violations).toContain('학생이 베낄 예시 문장')
    expect(violations).toContain('다음 라운드 확인 기준 누락')
    expect(violations).toContain('수정미션 제목 누락')
  })

  it('checks prior mission statuses', () => {
    const violations = scoreMissionCase({
      expectedPriorMissionStatuses: [{ missionId: 'old-1', status: 'not-done' }],
    }, {
      priorMissions: [{ missionId: 'made-up', status: 'done' }],
      missions: three,
    })

    expect(violations).toContain('지난 수정미션 판정 불일치')
  })
})

describe('parseEvalArgs', () => {
  it('parses the set and run count with safe defaults', () => {
    expect(parseEvalArgs([])).toEqual({ set: 'dev', runs: 1 })
    expect(parseEvalArgs(['--set', 'validation', '--runs', '3'])).toEqual({
      set: 'validation',
      runs: 3,
    })
    expect(parseEvalArgs(['--case', 'dev-context-only'])).toEqual({
      set: 'dev',
      runs: 1,
      caseId: 'dev-context-only',
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
          matches: 3,
          total: 4,
          meaninglessMatch: true,
          hallucinatedMet: 0,
          contradictions: 0,
          schemaValid: true,
        },
        signature: 'same',
        missionViolations: [],
        progressionFailures: [],
        meaningful: true,
        missionCount: 3,
        terminalState: false,
      },
      {
        caseId: 'case-1',
        run: 2,
        assessment: {
          matches: 4,
          total: 4,
          meaninglessMatch: true,
          hallucinatedMet: 0,
          contradictions: 0,
          schemaValid: true,
        },
        signature: 'same',
        missionViolations: [],
        progressionFailures: ['누적 달성도 불일치'],
        meaningful: true,
        missionCount: 3,
        terminalState: false,
      },
    ])

    expect(metrics).toMatchObject({
      agreement: 7 / 8,
      schemaRate: 1,
      stability: 1,
      meaninglessRate: 1,
      hallucinatedMet: 0,
      contradictions: 0,
      missionViolations: 0,
      progressionFailures: 1,
      threeMissionRate: 1,
      terminalStates: 0,
    })
  })
})

describe('scoreProgressionCase', () => {
  const meaningfulResult = {
    meaningless: false,
    assessments: [
      { criterionId: 'purpose-and-target', status: 'met' },
      { criterionId: 'preparation', status: 'met' },
      { criterionId: 'learned-facts', status: 'met' },
      { criterionId: 'reflection', status: 'met' },
    ],
    priorMissions: [],
    missions: [],
  }

  it('checks a first meaningful round against the independent 40 baseline', () => {
    expect(scoreProgressionCase({
      expected: { meaningless: false },
      writing: 'meaningful first round',
    }, meaningfulResult)).toEqual({
      actualAttainment: 40,
      expectedAttainment: 40,
      failures: [],
    })
  })

  it('adds 10 only for each done prior mission without a cap', () => {
    expect(scoreProgressionCase({
      expected: { meaningless: false },
      currentAttainment: 140,
      priorRounds: [{ writing: 'previous round' }],
      writing: 'meaningful revision',
    }, {
      ...meaningfulResult,
      priorMissions: [
        { missionId: 'one', status: 'done' },
        { missionId: 'two', status: 'partial' },
        { missionId: 'three', status: 'not-done' },
        { missionId: 'four', status: 'done' },
      ],
    })).toEqual({
      actualAttainment: 160,
      expectedAttainment: 160,
      failures: [],
    })
  })

  it('skips progression checking for meaningless fixtures', () => {
    expect(scoreProgressionCase({
      expected: { meaningless: true },
      writing: 'nonsense',
    }, meaningfulResult)).toBeNull()
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
    progressionFailures: 0,
    threeMissionRate: 1,
    terminalStates: 0,
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
      progressionFailures: 1,
      threeMissionRate: 0.5,
      terminalStates: 1,
    }, { set: 'dev', runs: 3 })).toEqual([
      '판정 일치율',
      'JSON 스키마 성공률',
      '3회 판정 안정성',
      '무의미 글 판별',
      '글에 없는 충족 추측',
      '논리 모순',
      '수정미션 위반',
      '누적 달성도',
      '수정미션 3개 생성률',
      '종료 상태',
    ])
  })
})
