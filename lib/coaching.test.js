import { describe, expect, it } from 'vitest'
import { INTERVIEW_REPORT_RUBRICS } from './curriculum.js'
import {
  buildFirstRoundPrompt,
  buildInterviewAssessmentPrompt,
  buildInterviewMissionPrompt,
  buildRevisionPrompt,
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
    expect(prompt).toContain('attempted')
    expect(prompt).toContain('not-done')
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
})

describe('buildInterviewMissionPrompt', () => {
  const selectedTargets = [{
    rubricIds: ['information'],
    criterionIds: ['new-fact', 'fact-detail'],
    missionSeed: '새 사실 하나와 그 사실을 뒷받침하는 정보를 덧붙이도록 안내',
  }]

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
    expect(prompt).toContain('title은 반드시')
    expect(prompt).toContain('~하기')
    expect(prompt).toContain('자세히 쓰기')
    expect(prompt).toContain('어디를')
    expect(prompt).toContain('어떻게')
  })
})

describe('validateInterviewMissionResult', () => {
  const selectedTargets = [{
    rubricIds: ['information'],
    criterionIds: ['new-fact', 'fact-detail'],
    missionSeed: '새 사실과 뒷받침 정보 안내',
  }]

  const validResult = {
    strength: {
      rubricId: 'purpose-and-subject',
      criterionId: 'interviewee',
      text: '엄마를 면담했다고 밝혀서 누구와 이야기했는지 바로 알 수 있어.',
    },
    missions: [{
      id: 'mission-1',
      rubricIds: ['information'],
      criterionIds: ['new-fact', 'fact-detail'],
      title: '새롭게 안 사실에 까닭 추가하기',
      instruction: '엄마가 달리기를 좋아했다는 내용 뒤에, 언제부터 또는 왜 좋아했는지 면담에서 들은 내용을 하나 덧붙여 보세요.',
      criterion: '달리기를 좋아하게 된 때나 까닭이 면담 내용으로 하나 추가되었는가',
    }],
    complete: false,
  }

  it('accepts an actionable mission mapped to the selected target', () => {
    expect(() => validateInterviewMissionResult(validResult, selectedTargets)).not.toThrow()
  })

  it('rejects too many missions and target mismatches', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [validResult.missions[0], { ...validResult.missions[0], id: 'mission-2' }],
    }, selectedTargets)).toThrow('개수')

    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [{
        ...validResult.missions[0],
        rubricIds: ['structure'],
        criterionIds: ['closing'],
      }],
    }, selectedTargets)).toThrow('선택된 수정 대상')
  })

  it('rejects a title that does not end in 하기 and vague-only advice', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [{ ...validResult.missions[0], title: '까닭을 덧붙여 보세요' }],
    }, selectedTargets)).toThrow('하기')

    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [{
        ...validResult.missions[0],
        title: '자세히 쓰기',
        instruction: '내용을 더 자세히 써 보세요.',
      }],
    }, selectedTargets)).toThrow('행동할 방법')
  })

  it('rejects an empty hidden criterion and inconsistent completion', () => {
    expect(() => validateInterviewMissionResult({
      ...validResult,
      missions: [{ ...validResult.missions[0], criterion: '' }],
    }, selectedTargets)).toThrow('확인 기준')

    expect(() => validateInterviewMissionResult({
      ...validResult,
      complete: true,
    }, selectedTargets)).toThrow('완성')
  })
})
