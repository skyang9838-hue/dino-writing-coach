import { describe, expect, it } from 'vitest'
import {
  buildInterviewRoundState,
  summarizeWritingChanges,
} from './interviewRound.js'

const assessments = [
  { rubricId: 'purpose-and-subject', criterionId: 'purpose', status: 'met' },
  { rubricId: 'purpose-and-subject', criterionId: 'interviewee', status: 'met' },
  { rubricId: 'information', criterionId: 'new-fact', status: 'partial' },
  { rubricId: 'information', criterionId: 'fact-detail', status: 'unmet' },
  { rubricId: 'structure', criterionId: 'opening', status: 'met' },
  { rubricId: 'structure', criterionId: 'body', status: 'partial' },
  { rubricId: 'structure', criterionId: 'closing', status: 'unmet' },
]

const missions = [{
  id: 'mission-1',
  rubricIds: ['information'],
  criterionIds: ['new-fact', 'fact-detail'],
  title: '새 사실에 까닭 추가하기',
  instruction: '새롭게 알게 된 사실 뒤에 면담에서 들은 까닭을 하나 덧붙여 보세요.',
  criterion: '새 사실에 면담에서 들은 까닭이 하나 추가되었는가',
}]

describe('summarizeWritingChanges', () => {
  it('separates added and removed text for the revision prompt', () => {
    expect(summarizeWritingChanges(
      '엄마는 달리기를 좋아했다.',
      '엄마는 어릴 때부터 달리기를 좋아했다.',
    )).toEqual({
      added: '어릴 때부터 ',
      removed: '',
    })
  })

  it('returns empty changes when there is no previous writing', () => {
    expect(summarizeWritingChanges(null, '첫 글')).toEqual({ added: '', removed: '' })
  })
})

describe('buildInterviewRoundState', () => {
  it('builds compatible feedback and stores actual and monotonic attainment', () => {
    const state = buildInterviewRoundState({
      submission: {
        attainment: 80,
        rounds: [{ writing: '이전 글', attainmentAfter: 80 }],
      },
      writing: '현재 글',
      result: {
        assessments,
        priorMissions: [{ missionId: 'old-1', status: 'attempted' }],
        strength: {
          rubricId: 'purpose-and-subject',
          criterionId: 'interviewee',
          text: '면담 대상이 누구인지 분명하게 밝혔어.',
        },
        missions,
        complete: false,
      },
    })

    expect(state.actualAttainment).toBe(57)
    expect(state.attainment).toBe(80)
    expect(state.feedback).toEqual({
      strength: '면담 대상이 누구인지 분명하게 밝혔어.',
      missions,
      assessments,
      complete: false,
      priorMissionStatuses: [{ missionId: 'old-1', status: 'attempted' }],
    })
    expect(state.rounds.at(-1)).toMatchObject({
      writing: '현재 글',
      strength: '면담 대상이 누구인지 분명하게 밝혔어.',
      missions,
      assessments,
      actualAttainment: 57,
      attainmentAfter: 80,
    })
    expect(state.lastImprovements).toBe(missions)
  })

  it('uses actual attainment when it is higher than the previous student display', () => {
    const state = buildInterviewRoundState({
      submission: { attainment: 20, rounds: [] },
      writing: '현재 글',
      result: {
        assessments: assessments.map((entry) => ({ ...entry, status: 'met' })),
        priorMissions: [],
        strength: {
          rubricId: 'information',
          criterionId: 'new-fact',
          text: '새롭게 알게 된 사실을 잘 밝혔어.',
        },
        missions: [],
        complete: true,
      },
    })

    expect(state.actualAttainment).toBe(100)
    expect(state.attainment).toBe(100)
    expect(state.feedback.complete).toBe(true)
  })
})
