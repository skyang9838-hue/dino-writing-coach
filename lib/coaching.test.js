import { describe, expect, it, vi } from 'vitest'
import { GRADE6_SEMESTER2_UNITS, INTERVIEW_REPORT_UNIT_ID } from './curriculum.js'
import {
  buildAssessmentPrompt,
  buildFirstRoundPrompt,
  buildMissionPrompt,
  buildRetryPrompt,
  buildRevisionPrompt,
  callGeminiJson,
  CoachingApiError,
  getRubricCoachingFeedback,
  getUnitCoachingSpec,
  RUBRIC_MODEL,
  validateAssessment,
  validateMissionResult,
} from './coaching.js'

// Everything below coaches the interview report: it is the one unit whose
// prompts have actually been run against Gemini. lib/curriculum.test.js is
// where the other units' data is checked, and the prompt builders are unit
// agnostic, so exercising them through one spec covers the rest.
const SPEC = getUnitCoachingSpec(INTERVIEW_REPORT_UNIT_ID)
const INTERVIEW_RUBRICS = SPEC.rubrics
const CHUNK = 'interview-procedure'

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

  it('asks the model to judge whether the writing is meaningless', () => {
    const prompt = buildFirstRoundPrompt('가을 소풍', '오늘은 소풍을 갔다.')
    expect(prompt).toContain('meaningless')
    expect(prompt).toContain('의미가 통하지 않는')
  })

  it('falls back to free-topic phrasing when no topic is given', () => {
    const prompt = buildFirstRoundPrompt(null, '오늘은 소풍을 갔다.')
    expect(prompt).toContain('자유 주제로')
    expect(prompt).not.toContain('"null"')
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

  it('asks the model to judge whether the revised writing is meaningless', () => {
    const prompt = buildRevisionPrompt(
      '가을 소풍',
      '옛날 글',
      ['문단을 나눠보세요', '결론을 추가하세요'],
      '새로운 글',
    )
    expect(prompt).toContain('meaningless')
    expect(prompt).toContain('의미가 통하지 않는')
  })

  it('falls back to free-topic phrasing when no topic is given', () => {
    const prompt = buildRevisionPrompt(
      null,
      '옛날 글',
      ['문단을 나눠보세요', '결론을 추가하세요'],
      '새로운 글',
    )
    expect(prompt).toContain('자유 주제로')
    expect(prompt).not.toContain('"null"')
  })
})

function completeAssessments(overrides = {}) {
  return INTERVIEW_RUBRICS.flatMap((rubric) =>
    rubric.criteria.map((criterion) => ({
      rubricId: rubric.id,
      criterionId: criterion.id,
      status: overrides[criterion.id] ?? 'met',
    })),
  )
}

describe('buildAssessmentPrompt', () => {
  it('includes the rubric hierarchy, observable anchors, and current writing without asking for scores', () => {
    const prompt = buildAssessmentPrompt({
      topic: '우리 동네에서 오래 일한 분',
      writing: '나는 할아버지께 옛날 시장에 대해 여쭈었다.',
      spec: SPEC,
    })

    expect(prompt).toContain('면담의 절차')
    expect(prompt).toContain('면담의 목적과 대상을 밝혔다')
    expect(prompt).toContain('이유, 과정, 사례, 상황 중 하나 이상')
    expect(prompt).toContain('나는 할아버지께 옛날 시장에 대해 여쭈었다.')
    expect(prompt).toContain('점수나 등급을 매기지 마')
    expect(prompt).toContain('맞춤법이나 문장이 미숙해도')
    expect(prompt).toContain('criterionId에는 아래에 적힌 영문 ID를 그대로 복사')
    expect(prompt).toContain('뒤에 나온 면담 내용을 보고 목적을 거꾸로 추측하지 마')
    expect(prompt).toContain('무엇을 알아보려 했는지와 면담 대상이 누구인지가 둘 다 드러나야 met')
    expect(prompt).toContain('이름, 관계, 직업, 역할 중 하나라도 있으면 밝힌 것으로 인정')
    expect(prompt).toContain('무엇을 또는 왜 또는 어떻게 물었는지가 직접 드러나면 목적을 밝힌 것으로 인정')
    expect(prompt).toContain('새롭게 알게 된 사실은 있지만 단순히 나열만 했으면 learned-facts는 partial')
    expect(prompt).toContain('짧은 한 문장 안에 이유나 과정이 분명하면 learned-facts는 met')
    expect(prompt).toContain('질문 만들기, 자료 조사, 약속 잡기처럼 면담 전에 한 준비 행동')
    expect(prompt).toContain('면담 목적을 쓰거나 질문했다는 사실만으로 준비 과정을 추측하지 마')
    expect(prompt).toContain('구체적인 깨달음이나 생각이 한 문장이라도 있으면 reflection은 met')
    expect(prompt).toContain('면담 활동이나 준비에 관한 느낌만 있으면 reflection은 partial')
    expect(prompt).toContain("'해 보고 싶었다'처럼 구체적인 변화나 다짐")
    expect(prompt).toContain('질문과 답이 드러나면 “면담”이라는 낱말이 없어도')
  })

  // The criteria judge whether content is present, not where it sits. Asking
  // the model about placement is what the old 앞-가운데-뒤 criteria did, and
  // reintroducing it here would contradict the rubric the teacher sees.
  it('never asks the model to judge where in the writing something sits', () => {
    const prompt = buildAssessmentPrompt({
      writing: '나는 할아버지께 여쭈었다.',
      spec: SPEC,
    })

    expect(prompt).toContain('내용이 글의 어느 위치에 있는지는 따지지 마')
    expect(prompt).not.toContain('앞부분')
    expect(prompt).not.toContain('끝부분')
    expect(prompt).not.toContain('가운데')
  })

  // The teacher-judged chunk must not appear anywhere in what the model reads.
  it('says nothing about the teacher-judged criteria', () => {
    const prompt = buildAssessmentPrompt({
      writing: '나는 할아버지께 여쭈었다.',
      spec: SPEC,
    })

    expect(prompt).not.toContain('상대와 매체')
    expect(prompt).not.toContain('audience')
    expect(prompt).not.toContain('medium')
  })

  it('includes prior mission criteria and explicit changes for a revision', () => {
    const prompt = buildAssessmentPrompt({
      topic: null,
      writing: '고친 글',
      previousWriting: '예전 글',
      previousMissions: [{
        id: 'mission-1',
        title: '까닭 덧붙이기',
        instruction: '면담에서 들은 까닭을 덧붙여 보세요.',
        criterion: '새 사실에 까닭이 하나 추가되었는가',
      }],
      changes: { added: '새로 쓴 부분', removed: '지운 부분' },
      spec: SPEC,
    })

    expect(prompt).toContain('새 사실에 까닭이 하나 추가되었는가')
    expect(prompt).toContain('새로 쓴 부분')
    expect(prompt).toContain('지운 부분')
    expect(prompt).toContain('done')
    expect(prompt).toContain('partial')
    expect(prompt).not.toContain('attempted')
    expect(prompt).toContain('not-done')
    expect(prompt).toContain('문장이 짧거나 표현이 서툴러도 미션이 요구한 행동을 했으면 done')
    expect(prompt).toContain('채점기준 4개는 현재 학생 글 전체를 기준으로 판정')
    expect(prompt).toContain('변화 부분만 보고 기존 내용을 미충족으로 판정하지 마')
  })
})

describe('the assessment schema built from a unit', () => {
  it('constrains rubric and criterion IDs to the exact application IDs', () => {
    const itemProperties = SPEC.assessmentSchema.properties.criteria.items.properties
    const priorStatus = SPEC.assessmentSchema
      .properties.priorMissions.items.properties.status
    expect(itemProperties.rubricId.enum).toEqual(['interview-procedure'])
    expect(itemProperties.criterionId.enum).toEqual([
      'purpose-and-target',
      'preparation',
      'learned-facts',
      'reflection',
    ])
    expect(priorStatus.enum).toEqual(['done', 'partial', 'not-done'])
  })

  // The count and the enums are written out by hand, so they can drift from
  // the curriculum. This is the check that catches that: a criterion added or
  // regrouped without updating the schema makes Gemini's reply unusable.
  it('matches the unit criteria the pipeline actually judges', () => {
    const itemProperties = SPEC.assessmentSchema.properties.criteria.items.properties
    const criteria = INTERVIEW_RUBRICS.flatMap((rubric) => rubric.criteria)

    expect(itemProperties.rubricId.enum).toEqual(INTERVIEW_RUBRICS.map((rubric) => rubric.id))
    expect(itemProperties.criterionId.enum).toEqual(criteria.map((criterion) => criterion.id))
    expect(SPEC.assessmentSchema.properties.criteria.minItems).toBe(criteria.length)
    expect(SPEC.assessmentSchema.properties.criteria.maxItems).toBe(criteria.length)
  })
})

describe('the mission schema built from a unit', () => {
  it('asks for three missions, each naming one of the unit criteria', () => {
    const strengthProperties = SPEC.missionSchema.properties.strength.properties
    const missions = SPEC.missionSchema.properties.missions
    const ids = ['purpose-and-target', 'preparation', 'learned-facts', 'reflection']
    expect(strengthProperties.criterionId.enum).toEqual([...ids, 'effort'])
    expect(missions.items.properties.criterionId.enum).toEqual(ids)
    expect(missions.items.required).toContain('criterionId')
    expect(missions.items.properties.targetIndex).toBeUndefined()
    expect(missions.minItems).toBe(3)
    expect(missions.maxItems).toBe(3)
  })
})

describe('Gemini responseSchema compatibility', () => {
  // The Gemini generateContent API only accepts `enum` on string-typed fields.
  // A numeric enum makes the whole request fail with HTTP 400 INVALID_ARGUMENT,
  // which surfaces to students as a generic network error.
  const collectEnumViolations = (node, path = '$') => {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap((item, index) => collectEnumViolations(item, `${path}[${index}]`))

    const violations = []
    if (Array.isArray(node.enum)) {
      if (node.type !== 'string') {
        violations.push(`${path}: enum requires type "string" but got "${node.type}"`)
      }
      for (const value of node.enum) {
        if (typeof value !== 'string') {
          violations.push(`${path}: enum value ${JSON.stringify(value)} is not a string`)
        }
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'enum') continue
      violations.push(...collectEnumViolations(value, `${path}.${key}`))
    }
    return violations
  }

  it.each([
    ['the assessment schema', SPEC.assessmentSchema],
    ['the mission schema', SPEC.missionSchema],
  ])('%s only uses enum on string fields', (_name, schema) => {
    expect(collectEnumViolations(schema)).toEqual([])
  })
})

describe('validateAssessment', () => {
  it('accepts exactly one valid assessment for every criterion', () => {
    expect(() => validateAssessment({
      meaningless: false,
      criteria: completeAssessments({ 'learned-facts': 'partial' }),
      priorMissions: [],
    }, INTERVIEW_RUBRICS)).not.toThrow()
  })

  it('rejects missing, duplicate, unknown, and invalid criterion entries', () => {
    const valid = completeAssessments()

    expect(() => validateAssessment({
      meaningless: false,
      criteria: valid.slice(1),
      priorMissions: [],
    }, INTERVIEW_RUBRICS)).toThrow('모든 채점기준')

    expect(() => validateAssessment({
      meaningless: false,
      criteria: [...valid.slice(0, -1), valid[0]],
      priorMissions: [],
    }, INTERVIEW_RUBRICS)).toThrow('중복')

    expect(() => validateAssessment({
      meaningless: false,
      criteria: valid.map((entry, index) => index === 0 ? { ...entry, criterionId: 'made-up' } : entry),
      priorMissions: [],
    }, INTERVIEW_RUBRICS)).toThrow('알 수 없는')

    expect(() => validateAssessment({
      meaningless: false,
      criteria: valid.map((entry, index) => index === 0 ? { ...entry, status: 'almost' } : entry),
      priorMissions: [],
    }, INTERVIEW_RUBRICS)).toThrow('판정 상태')
  })

  // The seven old criteria could contradict each other — a 구체적 설명 without
  // a 새 사실, an 앞부분 without the 목적 it was supposed to hold — so the
  // validator rejected those pairs and a normalize step downgraded one of
  // them. The four criteria each judge a different part of the interview
  // procedure and none implies another, so every combination is now legal.
  // If a future unit's criteria do depend on each other, that check comes back.
  it('accepts every combination of statuses across the four criteria', () => {
    const statuses = ['met', 'partial', 'unmet']
    const ids = INTERVIEW_RUBRICS.flatMap((rubric) =>
      rubric.criteria.map((criterion) => criterion.id))

    for (const first of statuses) {
      for (const second of statuses) {
        const overrides = Object.fromEntries(
          ids.map((id, index) => [id, index % 2 === 0 ? first : second]),
        )
        expect(() => validateAssessment({
          meaningless: false,
          criteria: completeAssessments(overrides),
          priorMissions: [],
        }, INTERVIEW_RUBRICS)).not.toThrow()
      }
    }
  })

  it('requires prior mission statuses to match the expected mission IDs exactly', () => {
    const result = {
      meaningless: false,
      criteria: completeAssessments(),
      priorMissions: [
        { missionId: 'old-1', status: 'done' },
        { missionId: 'made-up', status: 'not-done' },
      ],
    }
    expect(() => validateAssessment(
      result,
      INTERVIEW_RUBRICS,
      [{ id: 'old-1' }, { id: 'old-2' }],
    )).toThrow('지난 수정미션 ID')
  })
})

describe('buildMissionPrompt', () => {
  const writing = '나는 엄마를 면담했다. 엄마는 어릴 때 달리기를 좋아했다고 했다.'

  it('lets the model pick three missions from the criteria with each verdict and mission seed', () => {
    const prompt = buildMissionPrompt({
      writing,
      assessments: completeAssessments({ 'learned-facts': 'partial', reflection: 'unmet' }),
      spec: SPEC,
    })

    expect(prompt).toContain(writing)
    expect(prompt).toContain('criterionId=learned-facts')
    expect(prompt).toContain('판정: partial')
    expect(prompt).toContain('판정: unmet')
    expect(prompt).toContain(SPEC.rubrics[0].criteria[0].missionSeed)
    expect(prompt).toContain('무조건 unmet부터 고르지 마')
    expect(prompt).toContain('수정미션은 정확히 3개')
    expect(prompt).toContain('완성 문장이나 모범답안을 대신 쓰지 마')
    expect(prompt).toContain('학생 글에 없는 면담 내용이나 사실을 만들어내지 마')
    expect(prompt).toContain("'예를 들어' 뒤에 학생이 베낄 문장을 제시하지 마")
    expect(prompt).toContain("명사형 '-기'")
    expect(prompt).toContain('preparation이 수정 대상이면 면담 전에 실제로 한 준비 행동을 떠올릴 질문')
    // 글다듬기 미션과 지난 미션 넘기기는 없앴다.
    expect(prompt).not.toContain('글다듬기')
    expect(prompt).not.toContain('지난 수정미션')
    expect(prompt).not.toContain('targetIndex')
  })

  it('switches to stretch missions when every criterion is met', () => {
    const prompt = buildMissionPrompt({ writing, assessments: completeAssessments(), spec: SPEC })
    expect(prompt).toContain('[심화 미션]')
    expect(prompt).toContain('새로운 평가 기준을 만들지 마')
    expect(prompt).toContain('수정미션은 정확히 3개')
    expect(buildMissionPrompt({ writing, assessments: completeAssessments(), spec: SPEC, allMetMissions: 'B' }))
      .toContain('0~3개')
  })
})

describe('buildRetryPrompt', () => {
  it('keeps the original instructions and tells Gemini the exact validation error', () => {
    const retryPrompt = buildRetryPrompt(
      '원래 프롬프트',
      new Error('학생이 베낄 예시 문장을 제시함'),
    )

    expect(retryPrompt).toContain('원래 프롬프트')
    expect(retryPrompt).toContain('이전 응답 오류')
    expect(retryPrompt).toContain('학생이 베낄 예시 문장을 제시함')
    expect(retryPrompt).toContain('오류만 바로잡아 JSON을 다시 생성')
  })
})

describe('callGeminiJson', () => {
  it('retries a malformed model response and then validates the next response', async () => {
    let calls = 0
    const result = await callGeminiJson({
      prompt: '원래 프롬프트',
      schema: {},
      temperature: 0,
      request: async () => {
        calls += 1
        if (calls === 1) throw new CoachingApiError('디노 응답을 이해하지 못했어요.', 502)
        return { ok: true }
      },
      validate: (value) => {
        if (!value.ok) throw new Error('잘못된 응답')
      },
    })

    expect(result).toEqual({ ok: true })
    expect(calls).toBe(2)
  })

  it('does not retry a missing API key configuration error', async () => {
    let calls = 0
    await expect(callGeminiJson({
      prompt: '원래 프롬프트',
      schema: {},
      temperature: 0,
      request: async () => {
        calls += 1
        throw new CoachingApiError('서버에 API 키가 설정되어 있지 않아요.', 500)
      },
      validate: () => {},
    })).rejects.toMatchObject({ status: 500 })
    expect(calls).toBe(1)
  })
})

describe('getRubricCoachingFeedback', () => {
  const missionResponse = {
    strength: { criterionId: 'purpose-and-target', text: '목적이 분명해요.' },
    missions: [
      { id: 'fresh-1', criterionId: 'reflection', title: 't', instruction: 'i', criterion: 'c' },
      { id: 'fresh-2', criterionId: 'learned-facts', title: 't', instruction: 'i', criterion: 'c' },
      { id: 'fresh-3', criterionId: 'preparation', title: 't', instruction: 'i', criterion: 'c' },
    ],
  }

  it('regenerates fresh missions for an unchanged revision while forcing prior missions not-done', async () => {
    const previousMissions = [{ id: 'old-1' }, { id: 'old-2' }]
    const callJson = vi.fn()
      .mockResolvedValueOnce({
        meaningless: false,
        criteria: completeAssessments({ reflection: 'unmet' }),
        priorMissions: [
          { missionId: 'old-1', status: 'done' },
          { missionId: 'old-2', status: 'partial' },
        ],
      })
      .mockResolvedValueOnce(missionResponse)

    const result = await getRubricCoachingFeedback({
      spec: SPEC,
      topic: 'Interview report',
      writing: 'Unchanged meaningful writing.',
      previousWriting: 'Unchanged meaningful writing.',
      previousMissions,
      callJson,
    })

    expect(callJson).toHaveBeenCalledTimes(2)
    expect(result.priorMissions).toEqual([
      { missionId: 'old-1', status: 'not-done' },
      { missionId: 'old-2', status: 'not-done' },
    ])
    expect(result.missions.map((mission) => mission.id)).toEqual(['fresh-1', 'fresh-2', 'fresh-3'])
  })

  // 저장 모양은 예전 그대로다. 보드와 옛 회차가 배열을 읽는다.
  it('stores the criterion the model chose as rubricIds/criterionIds arrays', async () => {
    const callJson = vi.fn()
      .mockResolvedValueOnce({ meaningless: false, criteria: completeAssessments({ reflection: 'unmet' }), priorMissions: [] })
      .mockResolvedValueOnce(missionResponse)

    const result = await getRubricCoachingFeedback({ spec: SPEC, writing: '글', callJson })

    expect(result.missions[0]).toMatchObject({ id: 'fresh-1', rubricIds: [CHUNK], criterionIds: ['reflection'] })
    expect(result.missions[0].criterionId).toBeUndefined()
  })

  it('calls the rubric model for every rubric call', async () => {
    const callJson = vi.fn()
      .mockResolvedValueOnce({ meaningless: false, criteria: completeAssessments(), priorMissions: [] })
      .mockResolvedValueOnce(missionResponse)

    await getRubricCoachingFeedback({ spec: SPEC, writing: '글', callJson })

    expect(RUBRIC_MODEL.model).toBe('gemini-3.8-flash')
    for (const [args] of callJson.mock.calls) expect(args.config).toBe(RUBRIC_MODEL)
  })

  // 실측으로 드러난 문제: 글자 하나 다르지 않은 재코칭에서 판정이 두 개 뒤집혀
  // 교사 보드에 향상 ↑ 과 하락 ▼ 화살표가 떴다. 학생은 아무것도 고치지 않았다.
  it('reuses the previous assessment when the writing did not change at all', async () => {
    const previousAssessments = completeAssessments({ reflection: 'partial', preparation: 'partial' })
    const callJson = vi.fn().mockResolvedValueOnce(missionResponse)

    const result = await getRubricCoachingFeedback({
      spec: SPEC,
      topic: '면담 보고서',
      writing: '고치지 않은 의미 있는 글이다.',
      previousWriting: '고치지 않은 의미 있는 글이다.',
      previousMissions: [{ id: 'old-1' }, { id: 'old-2' }],
      priorRounds: [{ assessments: previousAssessments }, { flagged: true }],
      callJson,
    })

    // 판정 호출을 건너뛰므로 미션 생성 한 번만 부른다. 반려 회차는 건너뛴다.
    expect(callJson).toHaveBeenCalledTimes(1)
    expect(result.assessments).toEqual(previousAssessments)
  })

  it('still asks for a fresh assessment when there is no prior round to reuse', async () => {
    const callJson = vi.fn()
      .mockResolvedValueOnce({ meaningless: false, criteria: completeAssessments({ reflection: 'unmet' }), priorMissions: [] })
      .mockResolvedValueOnce(missionResponse)

    await getRubricCoachingFeedback({
      spec: SPEC,
      topic: '면담 보고서',
      writing: '같은 글이다.',
      previousWriting: '같은 글이다.',
      previousMissions: [],
      priorRounds: [],
      callJson,
    })

    expect(callJson).toHaveBeenCalledTimes(2)
  })

  describe('a verdict that went down', () => {
    const previous = completeAssessments({ reflection: 'met', preparation: 'partial' })
    const current = completeAssessments({ reflection: 'partial', preparation: 'unmet', 'learned-facts': 'met' })
    const run = async (checks) => {
      const callJson = vi.fn()
        .mockResolvedValueOnce({ meaningless: false, criteria: current, priorMissions: [] })
        .mockResolvedValueOnce({ checks })
        .mockResolvedValueOnce(missionResponse)
      const result = await getRubricCoachingFeedback({
        spec: SPEC,
        writing: '고친 글',
        previousWriting: '예전 글',
        changes: { added: '고친', removed: '예전' },
        priorRounds: [{ assessments: previous }],
        callJson,
      })
      return { result, callJson }
    }
    const statusOf = (result, id) => result.assessments.find((item) => item.criterionId === id).status

    it('asks about the dropped criteria only', async () => {
      const { callJson } = await run([
        { criterionId: 'reflection', regressed: false },
        { criterionId: 'preparation', regressed: false },
      ])
      expect(callJson).toHaveBeenCalledTimes(3)
      const prompt = callJson.mock.calls[1][0].prompt
      expect(prompt).toContain('criterionId=reflection')
      expect(prompt).toContain('criterionId=preparation')
      expect(prompt).not.toContain('criterionId=learned-facts')
    })

    it('keeps the previous verdict when the check says it did not regress, and lets a real drop through', async () => {
      const { result } = await run([
        { criterionId: 'reflection', regressed: false },
        { criterionId: 'preparation', regressed: true },
      ])
      expect(statusOf(result, 'reflection')).toBe('met')
      expect(statusOf(result, 'preparation')).toBe('unmet')
      expect(result.rawAssessments).toEqual(current)
      expect(result.regressionChecks).toEqual(expect.arrayContaining([
        { criterionId: 'reflection', from: 'met', to: 'partial', regressed: false },
        { criterionId: 'preparation', from: 'partial', to: 'unmet', regressed: true },
      ]))
    })

    it('keeps the previous verdict when the check itself fails', async () => {
      const callJson = vi.fn()
        .mockResolvedValueOnce({ meaningless: false, criteria: current, priorMissions: [] })
        .mockRejectedValueOnce(new CoachingApiError('디노 응답을 이해하지 못했어요.', 502))
        .mockResolvedValueOnce(missionResponse)
      const result = await getRubricCoachingFeedback({
        spec: SPEC, writing: '고친 글', previousWriting: '예전 글', priorRounds: [{ assessments: previous }], callJson,
      })
      expect(statusOf(result, 'reflection')).toBe('met')
      expect(statusOf(result, 'preparation')).toBe('partial')
    })

    it('makes no extra call when nothing went down', async () => {
      const callJson = vi.fn()
        .mockResolvedValueOnce({ meaningless: false, criteria: previous, priorMissions: [] })
        .mockResolvedValueOnce(missionResponse)
      await getRubricCoachingFeedback({
        spec: SPEC, writing: '고친 글', previousWriting: '예전 글', priorRounds: [{ assessments: previous }], callJson,
      })
      expect(callJson).toHaveBeenCalledTimes(2)
    })
  })

  it("lets an all-met round return no missions under 'B'", async () => {
    const callJson = vi.fn()
      .mockResolvedValueOnce({ meaningless: false, criteria: completeAssessments(), priorMissions: [] })
      .mockResolvedValueOnce({ ...missionResponse, missions: [] })

    const result = await getRubricCoachingFeedback({ spec: SPEC, writing: '글', callJson, allMetMissions: 'B' })

    expect(callJson.mock.calls[1][0].schema.properties.missions.minItems).toBe(0)
    expect(result.missions).toEqual([])
  })
})

describe('validateMissionResult', () => {
  const assessments = completeAssessments({ 'learned-facts': 'partial', reflection: 'unmet' })
  const mission = (id, criterionId, overrides = {}) => ({
    id,
    criterionId,
    title: '새롭게 안 사실에 까닭 덧붙이기',
    instruction: '엄마가 달리기를 좋아했다는 내용 뒤에, 언제부터 또는 왜 좋아했는지 면담에서 들은 내용을 하나 덧붙여 보세요.',
    criterion: '달리기를 좋아하게 된 때나 까닭이 면담 내용으로 하나 추가되었는가',
    ...overrides,
  })
  const validResult = {
    strength: { criterionId: 'purpose-and-target', text: '엄마를 면담했다고 밝혀서 누구와 이야기했는지 바로 알 수 있어.' },
    missions: [
      mission('mission-1', 'learned-facts'),
      mission('mission-2', 'reflection', { title: '느낀 점과 면담 사실 연결하기' }),
      mission('mission-3', 'preparation', { title: '준비한 질문 밝히기' }),
    ],
  }
  const check = (result, options = {}) =>
    validateMissionResult(result, { assessments, rubrics: INTERVIEW_RUBRICS, ...options })
  const withFirst = (overrides) => ({
    ...validResult,
    missions: [{ ...validResult.missions[0], ...overrides }, ...validResult.missions.slice(1)],
  })

  it('accepts three missions on known criteria', () => {
    expect(() => check(validResult)).not.toThrow()
  })

  // 측정(스펙 5-1절)에서 재시도의 주원인이던 제목·동작 목록은 코드에서 뺐다.
  it('no longer rejects an action title or verb the old word lists did not know', () => {
    expect(() => check(withFirst({ title: '면담 장면 담기', instruction: '엄마가 웃으며 답한 장면을 글 가운데에 남겨 보세요.' })))
      .not.toThrow()
  })

  it('requires exactly three missions when something is still short', () => {
    expect(() => check({ ...validResult, missions: validResult.missions.slice(0, 2) })).toThrow('3개')
    expect(() => check({ ...validResult, missions: [...validResult.missions, mission('mission-4', 'reflection')] }))
      .toThrow('3개')
  })

  it('rejects an unknown criterion, blank or duplicate ids, and empty fields', () => {
    expect(() => check(withFirst({ criterionId: 'made-up' }))).toThrow('알 수 없는 채점기준')
    expect(() => check(withFirst({ id: '  ' }))).toThrow('ID')
    expect(() => check(withFirst({ id: 'mission-2' }))).toThrow('중복')
    expect(() => check(withFirst({ title: '' }))).toThrow('제목')
    expect(() => check(withFirst({ instruction: '' }))).toThrow('설명')
    expect(() => check(withFirst({ criterion: '' }))).toThrow('확인 기준')
  })

  it('requires the strength to point at a met criterion, or effort when none is met', () => {
    expect(() => check({ ...validResult, strength: { criterionId: 'reflection', text: '좋아요.' } }))
      .toThrow('실제 충족한')
    const noneMet = completeAssessments(Object.fromEntries(
      INTERVIEW_RUBRICS.flatMap((rubric) => rubric.criteria).map((criterion) => [criterion.id, 'unmet']),
    ))
    expect(() => check(validResult, { assessments: noneMet })).toThrow('노력 항목')
    expect(() => check({ ...validResult, strength: { criterionId: 'effort', text: '끝까지 썼어요.' } }, { assessments: noneMet }))
      .not.toThrow()
  })

  describe("checks 'B' (core) and 'C' (format only)", () => {
    const cases = [
      ['베낄 예시 문장', { instruction: "예를 들어, '친구들이 축구를 하고 싶어 해서 시작했다'와 같이 써 보세요." }],
      ['사실을 지어내도록', { instruction: '면담에서 듣지 못했다면 이유를 생각해서 덧붙여 보세요.' }],
      ['막연한 표현', { instruction: '시장 이야기를 자세히 써 보세요.' }],
    ]
    it.each(cases)('B rejects %s', (message, overrides) => {
      expect(() => check(withFirst(overrides), { checks: 'B' })).toThrow(message)
    })
    it.each(cases)('C lets %s through', (_message, overrides) => {
      expect(() => check(withFirst(overrides), { checks: 'C' })).not.toThrow()
    })
  })

  describe('when every criterion is met', () => {
    const allMet = completeAssessments()

    it("allows zero to three missions under 'B'", () => {
      for (const count of [0, 1, 3]) {
        expect(() => check({ ...validResult, missions: validResult.missions.slice(0, count) }, { assessments: allMet, allMetMissions: 'B' }))
          .not.toThrow()
      }
    })

    it("still requires three under 'A'", () => {
      expect(() => check({ ...validResult, missions: [] }, { assessments: allMet, allMetMissions: 'A' })).toThrow('3개')
    })
  })
})

// The pipeline is unit-driven now, so the guarantee that used to be checked
// against one hardcoded rubric has to hold for every unit: a criterion the
// curriculum marks as the teacher's alone must be unreachable from the
// assessment prompt, the response schemas and the mission prompt. If it can
// be named, the model can judge it, and the board would be showing a verdict
// on something the teacher was supposed to settle.
describe('the teacher-only firewall, unit by unit', () => {
  const unitsWithCriteria = GRADE6_SEMESTER2_UNITS.filter((unit) => unit.chunks)

  const teacherOnlyOf = (unit) =>
    unit.chunks.flatMap((chunk) =>
      chunk.criteria.filter((criterion) => criterion.evaluator === 'teacher'),
    )

  it.each(unitsWithCriteria.map((unit) => [unit.id, unit]))(
    '%s never names a teacher-only criterion anywhere the model can read',
    (unitId, unit) => {
      const spec = getUnitCoachingSpec(unitId)
      const surfaces = [
        buildAssessmentPrompt({ spec, topic: '주제', writing: '학생 글' }),
        buildMissionPrompt({ spec, writing: '학생 글', assessments: [] }),
        JSON.stringify(spec.assessmentSchema),
        JSON.stringify(spec.missionSchema),
      ].join('\n')

      const teacherOnly = teacherOnlyOf(unit)
      expect(teacherOnly.length).toBeGreaterThan(0)
      for (const criterion of teacherOnly) {
        expect(surfaces).not.toContain(criterion.id)
        expect(surfaces).not.toContain(criterion.label)
        expect(surfaces).not.toContain(criterion.shortLabel)
      }
    },
  )

  it.each(unitsWithCriteria.map((unit) => [unit.id, unit]))(
    '%s builds both schemas from exactly its AI-judged criteria',
    (unitId, unit) => {
      const spec = getUnitCoachingSpec(unitId)
      const expected = unit.chunks.flatMap((chunk) =>
        chunk.criteria
          .filter((criterion) => criterion.evaluator !== 'teacher')
          .map((criterion) => criterion.id),
      )
      const assessmentEnum =
        spec.assessmentSchema.properties.criteria.items.properties.criterionId.enum

      expect(assessmentEnum).toEqual(expected)
      expect(spec.assessmentSchema.properties.criteria.minItems).toBe(expected.length)
      expect(spec.assessmentSchema.properties.criteria.maxItems).toBe(expected.length)
      // The mission schema adds 'effort' for the round where nothing is met.
      expect(spec.missionSchema.properties.strength.properties.criterionId.enum)
        .toEqual([...expected, 'effort'])
    },
  )

  // The advisory criteria are the reason the firewall needed a second gate:
  // they DO reach the model, on purpose, so the board is what has to hold them
  // back. Checking they arrive here keeps the two gates from collapsing into
  // one and silently hiding them from the AI too.
  it('lets the advisory criteria through to the model', () => {
    const spec = getUnitCoachingSpec('g6s2-unit5')
    const prompt = buildAssessmentPrompt({ spec, topic: '주제', writing: '학생 글' })

    expect(prompt).toContain('newsworthy-topic')
    expect(prompt).toContain('headline')
    expect(prompt).toContain('fact-delivery')
  })

  it('counts the criteria in the prompt from the unit, not a constant', () => {
    expect(buildAssessmentPrompt({ spec: getUnitCoachingSpec('g6s2-unit5'), writing: '글' }))
      .toContain('채점기준 5개는')
    expect(buildAssessmentPrompt({ spec: getUnitCoachingSpec('g6s2-unit6'), writing: '글' }))
      .toContain('채점기준 3개는')
  })

  // 6단원은 청크가 없어 루브릭 이름이 null이다. 그 자리에 'null'이 찍히면
  // 프롬프트가 모델에게 없는 이름을 알려주는 셈이 된다.
  it('leaves out the group heading for a unit whose criteria are not chunked', () => {
    const prompt = buildAssessmentPrompt({
      spec: getUnitCoachingSpec('g6s2-unit6'),
      writing: '글',
    })

    expect(prompt).toContain('[rubricId=story-rewrite]\n- criterionId=own-experience')
    expect(prompt).not.toContain('null')
  })
})
