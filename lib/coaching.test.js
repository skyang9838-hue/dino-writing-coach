import { describe, expect, it, vi } from 'vitest'
import { INTERVIEW_REPORT_RUBRICS } from './curriculum.js'
import {
  buildFirstRoundPrompt,
  buildInterviewAssessmentPrompt,
  buildInterviewMissionPrompt,
  buildRetryPrompt,
  buildRevisionPrompt,
  callGeminiJson,
  CoachingApiError,
  getInterviewReportFeedback,
  INTERVIEW_ASSESSMENT_SCHEMA,
  INTERVIEW_MISSION_SCHEMA,
  normalizeInterviewAssessment,
  sanitizeInterviewMissionResult,
  validateInterviewAssessment,
  validateInterviewMissionResult,
} from './coaching.js'

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
  return INTERVIEW_REPORT_RUBRICS.flatMap((rubric) =>
    rubric.criteria.map((criterion) => ({
      rubricId: rubric.id,
      criterionId: criterion.id,
      status: overrides[criterion.id] ?? 'met',
    })),
  )
}

describe('buildInterviewAssessmentPrompt', () => {
  it('includes the rubric hierarchy, observable anchors, and current writing without asking for scores', () => {
    const prompt = buildInterviewAssessmentPrompt({
      topic: '우리 동네에서 오래 일한 분',
      writing: '나는 할아버지께 옛날 시장에 대해 여쭈었다.',
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })

    expect(prompt).toContain('면담의 목적과 대상이 분명하게 드러난다')
    expect(prompt).toContain('면담을 통해 얻은 정보를 구체적으로 전달한다')
    expect(prompt).toContain('이유, 과정, 사례, 상황 중 하나 이상')
    expect(prompt).toContain('나는 할아버지께 옛날 시장에 대해 여쭈었다.')
    expect(prompt).toContain('점수나 등급을 매기지 마')
    expect(prompt).toContain('맞춤법이나 문장이 미숙해도')
    expect(prompt).toContain('criterionId에는 아래에 적힌 영문 ID를 그대로 복사')
    expect(prompt).toContain('면담 대상을 밝혔다는 사실만으로 purpose를 met으로 판정하지 마')
    expect(prompt).toContain('뒤에 나온 면담 내용을 보고 목적을 거꾸로 추측하지 마')
    expect(prompt).toContain('무엇을 알아보려 했는지가 글 어디에든 직접 쓰여 있으면 purpose는 met')
    expect(prompt).toContain('무엇을 또는 왜 또는 어떻게 물었는지가 직접 드러나도 purpose는 met')
    expect(prompt).toContain('면담 주제만 드러나면 purpose는 partial')
    expect(prompt).toContain('새롭게 알게 된 사실은 있지만 단순히 나열만 했으면 fact-detail은 partial')
    expect(prompt).toContain('opening은 목적, 대상, 준비 과정 세 가지가 모두 앞부분에 있어야 met')
    expect(prompt).toContain('질문 작성, 자료 조사, 약속 잡기처럼 면담 전에 한 준비 행동')
    expect(prompt).toContain('면담 목적을 쓰거나 질문했다는 사실만으로 준비 과정을 추측하지 마')
    expect(prompt).toContain('opening, body, closing에 필요한 내용이 글에 있지만 위치만 맞지 않으면 partial')
    expect(prompt).toContain('closing은 생각이나 느낌이 글의 끝부분에 있어야 met')
    expect(prompt).toContain('끝부분에 구체적인 깨달음이나 생각이 한 문장이라도 있으면 closing은 met')
    expect(prompt).toContain('면담 활동이나 준비에 관한 느낌만 끝에 있으면 closing은 partial')
    expect(prompt).toContain("'해 보고 싶었다'처럼 구체적인 변화나 다짐")
    expect(prompt).toContain('질문과 답이 드러나면 “면담”이라는 낱말이 없어도')
    expect(prompt).toContain('짧은 한 문장 안에 이유나 과정이 분명하면 fact-detail은 met')
    expect(prompt).toContain('준비 행동이 하나도 없으면 opening은 반드시 partial')
    expect(prompt).toContain('느낀 점 뒤에 다시 면담 사실이 나오면 closing은 partial')
  })

  it('includes prior mission criteria and explicit changes for a revision', () => {
    const prompt = buildInterviewAssessmentPrompt({
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
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })

    expect(prompt).toContain('새 사실에 까닭이 하나 추가되었는가')
    expect(prompt).toContain('새로 쓴 부분')
    expect(prompt).toContain('지운 부분')
    expect(prompt).toContain('done')
    expect(prompt).toContain('partial')
    expect(prompt).not.toContain('attempted')
    expect(prompt).toContain('not-done')
    expect(prompt).toContain('확인 기준에서 요구한 내용이 새로 추가되었으면 짧아도 done')
    expect(prompt).toContain('루브릭 7개는 현재 학생 글 전체를 기준으로 판정')
    expect(prompt).toContain('변화 부분만 보고 기존 내용을 미충족으로 판정하지 마')
  })
})

describe('INTERVIEW_ASSESSMENT_SCHEMA', () => {
  it('constrains rubric and criterion IDs to the exact application IDs', () => {
    const itemProperties = INTERVIEW_ASSESSMENT_SCHEMA.properties.criteria.items.properties
    const priorStatus = INTERVIEW_ASSESSMENT_SCHEMA
      .properties.priorMissions.items.properties.status
    expect(itemProperties.rubricId.enum).toEqual([
      'purpose-and-subject',
      'information',
      'structure',
    ])
    expect(itemProperties.criterionId.enum).toEqual([
      'purpose',
      'interviewee',
      'new-fact',
      'fact-detail',
      'opening',
      'body',
      'closing',
    ])
    expect(priorStatus.enum).toEqual(['done', 'partial', 'not-done'])
  })
})

describe('INTERVIEW_MISSION_SCHEMA', () => {
  it('requires each mission to identify its server-selected target by index only', () => {
    const strengthProperties = INTERVIEW_MISSION_SCHEMA.properties.strength.properties
    const itemProperties = INTERVIEW_MISSION_SCHEMA.properties.missions.items.properties
    expect(strengthProperties.rubricId.enum).toEqual([
      'purpose-and-subject',
      'information',
      'structure',
      'effort',
    ])
    expect(strengthProperties.criterionId.enum).toEqual([
      'purpose',
      'interviewee',
      'new-fact',
      'fact-detail',
      'opening',
      'body',
      'closing',
      'effort',
    ])
    expect(itemProperties.targetIndex).toEqual({ type: 'number', enum: [1, 2] })
    expect(itemProperties.rubricIds).toBeUndefined()
    expect(itemProperties.criterionIds).toBeUndefined()
    expect(INTERVIEW_MISSION_SCHEMA.properties.missions.items.required).toContain('targetIndex')
    expect(INTERVIEW_MISSION_SCHEMA.properties.missions.items.required).not.toContain('rubricIds')
    expect(INTERVIEW_MISSION_SCHEMA.properties.missions.items.required).not.toContain('criterionIds')
    expect(INTERVIEW_MISSION_SCHEMA.properties.missions.minItems).toBe(2)
    expect(INTERVIEW_MISSION_SCHEMA.properties.missions.maxItems).toBe(2)
    expect(INTERVIEW_MISSION_SCHEMA.properties.complete).toBeUndefined()
    expect(INTERVIEW_MISSION_SCHEMA.required).not.toContain('complete')
  })
})

describe('validateInterviewAssessment', () => {
  it('accepts exactly one valid assessment for every criterion', () => {
    expect(() => validateInterviewAssessment({
      meaningless: false,
      criteria: completeAssessments({ 'fact-detail': 'partial' }),
      priorMissions: [],
    }, INTERVIEW_REPORT_RUBRICS)).not.toThrow()
  })

  it('rejects missing, duplicate, unknown, and invalid criterion entries', () => {
    const valid = completeAssessments()

    expect(() => validateInterviewAssessment({
      meaningless: false,
      criteria: valid.slice(1),
      priorMissions: [],
    }, INTERVIEW_REPORT_RUBRICS)).toThrow('모든 채점기준')

    expect(() => validateInterviewAssessment({
      meaningless: false,
      criteria: [...valid.slice(0, -1), valid[0]],
      priorMissions: [],
    }, INTERVIEW_REPORT_RUBRICS)).toThrow('중복')

    expect(() => validateInterviewAssessment({
      meaningless: false,
      criteria: valid.map((entry, index) => index === 0 ? { ...entry, criterionId: 'made-up' } : entry),
      priorMissions: [],
    }, INTERVIEW_REPORT_RUBRICS)).toThrow('알 수 없는')

    expect(() => validateInterviewAssessment({
      meaningless: false,
      criteria: valid.map((entry, index) => index === 0 ? { ...entry, status: 'almost' } : entry),
      priorMissions: [],
    }, INTERVIEW_REPORT_RUBRICS)).toThrow('판정 상태')
  })

  it('rejects fact-detail met when new-fact is unmet', () => {
    expect(() => validateInterviewAssessment({
      meaningless: false,
      criteria: completeAssessments({ 'new-fact': 'unmet', 'fact-detail': 'met' }),
      priorMissions: [],
    }, INTERVIEW_REPORT_RUBRICS)).toThrow('논리')
  })

  it('rejects structure and detail statuses that contradict their prerequisite content', () => {
    for (const overrides of [
      { purpose: 'partial', opening: 'met' },
      { interviewee: 'unmet', opening: 'met' },
      { 'new-fact': 'met', 'fact-detail': 'unmet' },
      { 'new-fact': 'partial', body: 'unmet' },
    ]) {
      expect(() => validateInterviewAssessment({
        meaningless: false,
        criteria: completeAssessments(overrides),
        priorMissions: [],
      }, INTERVIEW_REPORT_RUBRICS)).toThrow('논리')
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
    expect(() => validateInterviewAssessment(
      result,
      INTERVIEW_REPORT_RUBRICS,
      [{ id: 'old-1' }, { id: 'old-2' }],
    )).toThrow('지난 수정미션 ID')
  })
})

describe('normalizeInterviewAssessment', () => {
  it('downgrades an impossible opening met status to partial', () => {
    const result = {
      meaningless: false,
      criteria: completeAssessments({ purpose: 'partial', opening: 'met' }),
      priorMissions: [],
    }

    const normalized = normalizeInterviewAssessment(result)

    expect(normalized.criteria.find(({ criterionId }) => criterionId === 'opening').status)
      .toBe('partial')
    expect(normalized.criteria.find(({ criterionId }) => criterionId === 'purpose').status)
      .toBe('partial')
  })
})

describe('buildInterviewMissionPrompt', () => {
  const selectedTargets = [
    {
      rubricIds: ['information'],
      criterionIds: ['new-fact', 'fact-detail'],
      missionSeed: '새 사실 하나와 그 사실을 뒷받침하는 정보를 덧붙이도록 안내',
    },
    {
      rubricIds: ['structure'],
      criterionIds: ['closing'],
      refinement: true,
      missionSeed: '느낀 점을 본문의 면담 사실과 더 분명히 연결하도록 안내',
    },
  ]

  it('requires a dynamic actionable mission without inventing or writing the answer', () => {
    const prompt = buildInterviewMissionPrompt({
      writing: '나는 엄마를 면담했다. 엄마는 어릴 때 달리기를 좋아했다고 했다.',
      assessments: completeAssessments({ 'new-fact': 'partial', 'fact-detail': 'unmet' }),
      selectedTargets,
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })

    expect(prompt).toContain('새 사실 하나와 그 사실을 뒷받침하는 정보를 덧붙이도록 안내')
    expect(prompt).toContain('학생 글에 실제로 나온 내용')
    expect(prompt).toContain('완성 문장이나 모범답안을 대신 쓰지 마')
    expect(prompt).toContain('학생 글에 없는 면담 내용이나 사실을 만들어내지 마')
    expect(prompt).toContain("'예를 들어' 뒤에 학생이 베낄 문장을 제시하지 마")
    expect(prompt).toContain('title은 반드시')
    expect(prompt).toContain("명사형 '-기'")
    expect(prompt).toContain('자세히 쓰기')
    expect(prompt).toContain('어디를')
    expect(prompt).toContain('어떻게')
    expect(prompt).toContain('body가 수정 대상이면 이미 쓴 새 사실 문장을 도입과 마무리 사이로 옮기거나 모으는 행동')
    expect(prompt).toContain('new-fact 또는 fact-detail이 수정 대상이면 면담에서 들은 이유·과정·상황을 확인할 질문')
    expect(prompt).toContain('항상 정확히 2개')
    expect(prompt).not.toContain('수정 대상이 없으면')
    expect(prompt).toContain('Each item MUST include targetIndex')
    expect(prompt).toContain('Use each targetIndex exactly once')
    expect(prompt).toContain('Array order may be either order because targetIndex determines the mapping')
    expect(prompt).toContain('Do not return rubricIds or criterionIds')
    expect(prompt).not.toContain('complete')
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

describe('getInterviewReportFeedback', () => {
  it('regenerates fresh missions for an unchanged revision while forcing prior missions not-done', async () => {
    const previousMissions = [{ id: 'old-1' }, { id: 'old-2' }]
    const callJson = vi.fn()
      .mockResolvedValueOnce({
        meaningless: false,
        criteria: completeAssessments({ closing: 'unmet' }),
        priorMissions: [
          { missionId: 'old-1', status: 'done' },
          { missionId: 'old-2', status: 'partial' },
        ],
      })
      .mockResolvedValueOnce({
        strength: { rubricId: 'purpose-and-subject', criterionId: 'purpose', text: 'A clear purpose is present.' },
        missions: [{ id: 'fresh-1' }, { id: 'fresh-2' }],
      })

    const result = await getInterviewReportFeedback({
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
    expect(result.missions.map((mission) => mission.id)).toEqual(['fresh-1', 'fresh-2'])
    expect(result.missions).not.toEqual(previousMissions)
  })
})

describe('sanitizeInterviewMissionResult', () => {
  it('removes a trailing copyable example while preserving the actionable instruction', () => {
    const sanitized = sanitizeInterviewMissionResult({
      missions: [{
        title: '까닭 덧붙이기',
        instruction: "형이 축구를 시작한 까닭을 면담에서 들은 내용으로 덧붙여 보세요. 예를 들어, '친구들이 권해서 시작했다'라고 써 보세요.",
      }],
    })

    expect(sanitized.missions[0].instruction).toBe(
      '형이 축구를 시작한 까닭을 면담에서 들은 내용으로 덧붙여 보세요.',
    )
  })

  it('leaves an example-only instruction empty so validation still rejects it', () => {
    const sanitized = sanitizeInterviewMissionResult({
      missions: [{
        title: '까닭 덧붙이기',
        instruction: "예를 들어, '친구들이 권해서 시작했다'라고 써 보세요.",
      }],
    })

    expect(sanitized.missions[0].instruction).toBe('')
  })

  it('removes a trailing invitation to invent an unheard interview answer', () => {
    const sanitized = sanitizeInterviewMissionResult({
      missions: [{
        title: '까닭 덧붙이기',
        instruction: '면담에서 들은 까닭을 사실 뒤에 덧붙여 보세요. 만약 듣지 못했다면 이유를 생각해서 덧붙여도 됩니다.',
      }],
    })

    expect(sanitized.missions[0].instruction).toBe(
      '면담에서 들은 까닭을 사실 뒤에 덧붙여 보세요.',
    )
  })

  it('replaces an invented quoted model sentence with a generic writing location', () => {
    const sanitized = sanitizeInterviewMissionResult({
      missions: [{
        title: '느낀 점 덧붙이기',
        instruction: "글 끝의 '나는 소방관이 세상에서 가장 멋지다고 확신했다.'는 문장 뒤에 느낀 점을 덧붙여 보세요.",
      }],
    }, '면담을 마치고 소방관은 멋지다고 느꼈다.')

    expect(sanitized.missions[0].instruction).not.toContain('세상에서 가장 멋지다고')
    expect(sanitized.missions[0].instruction).toContain('학생 글의 관련 문장')
  })

  it('removes the attached comparison particle when replacing an invented quote', () => {
    const sanitized = sanitizeInterviewMissionResult({
      missions: [{
        title: '들은 내용 덧붙이기',
        instruction: "'소방관은 매일 사다리를 점검한다'와 같이 면담에서 들은 과정을 덧붙여 보세요.",
      }],
    }, '나는 소방관을 면담했다.')

    expect(sanitized.missions[0].instruction).toBe(
      '학생 글의 관련 내용을 바탕으로 면담에서 들은 과정을 덧붙여 보세요.',
    )
    expect(sanitized.missions[0].instruction).not.toContain('내용 와 같이')
  })

  it('replaces a vague title and removes a vague sentence only when a concrete action remains', () => {
    const selectedTargets = [{
      rubricIds: ['structure'],
      criterionIds: ['closing'],
    }]
    const sanitized = sanitizeInterviewMissionResult({
      missions: [{
        title: '느낀 점 자세히 쓰기',
        instruction: '그 느낌을 더 자세히 써 보세요. 어떤 점이 왜 멋진지 까닭을 덧붙여 보세요.',
      }],
    }, '', selectedTargets)

    expect(sanitized.missions[0].title).toBe('느낀 점에 까닭 덧붙이기')
    expect(sanitized.missions[0].instruction).toBe(
      '어떤 점이 왜 멋진지 까닭을 덧붙여 보세요.',
    )

    const vagueOnly = sanitizeInterviewMissionResult({
      missions: [{
        title: '느낀 점 자세히 쓰기',
        instruction: '그 느낌을 더 자세히 써 보세요.',
      }],
    }, '', selectedTargets)
    expect(vagueOnly.missions[0].instruction).toBe('')
  })

  it('reorders swapped model missions by targetIndex and attaches server-selected IDs', () => {
    const selectedTargets = [
      {
        rubricIds: ['information'],
        criterionIds: ['new-fact', 'fact-detail'],
      },
      {
        rubricIds: ['structure'],
        criterionIds: ['closing'],
      },
    ]
    const sanitized = sanitizeInterviewMissionResult({
      missions: [
        {
          targetIndex: 2,
          rubricIds: ['information'],
          criterionIds: ['new-fact'],
          instruction: '새 사실에 면담에서 들은 이유를 덧붙여 보세요.',
        },
        {
          targetIndex: 1,
          rubricIds: ['structure'],
          criterionIds: ['body'],
          instruction: '느낀 점을 본문의 면담 사실과 연결해 보세요.',
        },
      ],
    }, '', selectedTargets)

    expect(sanitized.missions.map((mission) => ({
      rubricIds: mission.rubricIds,
      criterionIds: mission.criterionIds,
    }))).toEqual(selectedTargets)
    expect(sanitized.missions.map((mission) => mission.instruction)).toEqual([
      '느낀 점을 본문의 면담 사실과 연결해 보세요.',
      '새 사실에 면담에서 들은 이유를 덧붙여 보세요.',
    ])
    expect(sanitized.missions.map((mission) => mission.targetIndex)).toEqual([undefined, undefined])
    expect(sanitized.missions[0]).not.toHaveProperty('targetIndex')
  })

  it.each([
    { missions: [{ targetIndex: 1 }, { targetIndex: 1 }] },
    { missions: [{ targetIndex: 1 }, {}] },
    { missions: [{ targetIndex: 1 }, { targetIndex: 3 }] },
  ])('rejects duplicate, missing, or out-of-range targetIndex values', ({ missions }) => {
    const selectedTargets = [
      { rubricIds: ['information'], criterionIds: ['new-fact', 'fact-detail'] },
      { rubricIds: ['structure'], criterionIds: ['closing'] },
    ]

    expect(() => sanitizeInterviewMissionResult({ missions }, '', selectedTargets)).toThrow('targetIndex')
  })
})

describe('validateInterviewMissionResult', () => {
  const selectedTargets = [
    {
      rubricIds: ['information'],
      criterionIds: ['new-fact', 'fact-detail'],
      missionSeed: '새 사실과 뒷받침 정보 안내',
    },
    {
      rubricIds: ['structure'],
      criterionIds: ['closing'],
      refinement: true,
      missionSeed: '느낀 점을 면담 사실과 연결하도록 안내',
    },
  ]

  const validResult = {
    strength: {
      rubricId: 'purpose-and-subject',
      criterionId: 'interviewee',
      text: '엄마를 면담했다고 밝혀서 누구와 이야기했는지 바로 알 수 있어.',
    },
    missions: [
      {
        id: 'mission-1',
        rubricIds: ['information'],
        criterionIds: ['new-fact', 'fact-detail'],
        title: '새롭게 안 사실에 까닭 덧붙이기',
        instruction: '엄마가 달리기를 좋아했다는 내용 뒤에, 언제부터 또는 왜 좋아했는지 면담에서 들은 내용을 하나 덧붙여 보세요.',
        criterion: '달리기를 좋아하게 된 때나 까닭이 면담 내용으로 하나 추가되었는가',
      },
      {
        id: 'mission-2',
        rubricIds: ['structure'],
        criterionIds: ['closing'],
        title: '느낀 점과 면담 사실 연결하기',
        instruction: '글 끝의 느낀 점에 엄마에게 들은 내용 중 연결되는 사실을 하나 골라 표시해 보세요.',
        criterion: '느낀 점이 본문의 면담 사실 하나와 연결되었는가',
      },
    ],
  }

  it('accepts an actionable mission mapped to the selected target', () => {
    expect(() => validateInterviewMissionResult(validResult, selectedTargets)).not.toThrow()
  })

  it('rejects too many missions and target mismatches', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        ...validResult.missions,
        { ...validResult.missions[0], id: 'mission-3' },
      ],
    }, selectedTargets)).toThrow('개수')

    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        {
          ...validResult.missions[0],
          rubricIds: ['structure'],
          criterionIds: ['body'],
        },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('선택된 수정 대상')
  })

  it('accepts a natural Korean action-noun title ending in 기', () => {
    expect(() => validateInterviewMissionResult(validResult, selectedTargets)).not.toThrow()
  })

  it('rejects a title that is not an action noun and vague-only advice', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        { ...validResult.missions[0], title: '까닭을 덧붙여 보세요' },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('행동 명사형')

    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        {
          ...validResult.missions[0],
          title: '자세히 쓰기',
          instruction: '내용을 더 자세히 써 보세요.',
        },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('금지된 막연한 표현')
  })

  it('rejects forbidden vague writing phrases even when a topic is mentioned', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        {
          ...validResult.missions[0],
          title: '새롭게 알게 된 사실 자세히 쓰기',
          instruction: '학교 지킴이 선생님이 하는 일을 더 자세히 써주세요.',
        },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('금지된 막연한 표현')
  })

  it('rejects a non-action title ending in 기 and a mission without an actionable verb', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        {
          ...validResult.missions[0],
          title: '면담 이야기',
        },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('행동 명사형')

    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        {
          ...validResult.missions[0],
          instruction: '엄마가 달리기를 좋아했다는 부분을 중심으로 생각해 보세요.',
        },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('실행 동작')
  })

  it('requires the strength to reference a criterion assessed as met', () => {
    const assessments = completeAssessments({ interviewee: 'partial' })
    expect(() => validateInterviewMissionResult(
      validResult,
      selectedTargets,
      { assessments },
    )).toThrow('잘한 점')
  })

  it('uses the explicit effort fallback when no criterion is met', () => {
    const assessments = completeAssessments({
      purpose: 'unmet',
      interviewee: 'unmet',
      'new-fact': 'unmet',
      'fact-detail': 'unmet',
      opening: 'unmet',
      body: 'unmet',
      closing: 'unmet',
    })
    expect(() => validateInterviewMissionResult(
      {
        ...validResult,
        strength: { rubricId: 'effort', criterionId: 'effort', text: '글을 끝까지 썼어요.' },
      },
      selectedTargets,
      { assessments },
    )).not.toThrow()
    expect(() => validateInterviewMissionResult(
      validResult,
      selectedTargets,
      { assessments },
    )).toThrow('노력')
  })

  it('rejects blank or duplicate mission IDs', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        { ...validResult.missions[0], id: '   ' },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('ID')

    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        validResult.missions[0],
        {
          ...validResult.missions[1],
          id: validResult.missions[0].id,
        },
      ],
    }, selectedTargets)).toThrow('ID')
  })

  it('rejects an empty hidden criterion and fewer than two missions', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        { ...validResult.missions[0], criterion: '' },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('확인 기준')

    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [validResult.missions[0]],
    }, selectedTargets)).toThrow('개수')
  })

  it('rejects a copyable example sentence that invents interview content', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        {
          ...validResult.missions[0],
          instruction: "예를 들어, '친구들이 축구를 하고 싶어 해서 시작했다'와 같이 써 보세요.",
        },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('베낄 예시 문장')
  })

  it('rejects quoted interview content that is not grounded in the student writing', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        {
          ...validResult.missions[0],
          instruction: "엄마가 '전국 대회에서 우승했다'는 사실 뒤에 그때의 느낌을 덧붙여 보세요.",
        },
        validResult.missions[1],
      ],
    }, selectedTargets, {
      writing: '엄마는 어릴 때 달리기를 좋아했다고 말했다.',
    })).toThrow('학생 글에 없는 인용 내용')
  })

  it('rejects an instruction that asks the student to invent an unheard answer', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [
        {
          ...validResult.missions[0],
          instruction: '면담에서 듣지 못했다면 이유를 생각해서 덧붙여 보세요.',
        },
        validResult.missions[1],
      ],
    }, selectedTargets)).toThrow('면담 사실을 지어내도록')
  })
})
