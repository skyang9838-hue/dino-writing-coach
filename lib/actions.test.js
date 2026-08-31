import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  getGeminiFeedback: vi.fn(),
  getRubricCoachingFeedback: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('../auth.js', () => ({ auth: mocks.auth }))
vi.mock('./prisma.js', () => ({
  prisma: {
    submission: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}))
vi.mock('./coaching.js', () => {
  class CoachingApiError extends Error {
    constructor(message, status) {
      super(message)
      this.status = status
    }
  }
  return {
    CoachingApiError,
    getGeminiFeedback: mocks.getGeminiFeedback,
    getRubricCoachingFeedback: mocks.getRubricCoachingFeedback,
    // Stands in for the real spec lookup. actions.js only asks whether it got
    // a spec back, and the interview report is the only unit these tests
    // route through.
    getUnitCoachingSpec: (unitId) => (unitId === 'g6s2-unit2' ? { unitId, rubrics: [] } : null),
  }
})

import { requestCoaching, resolveProfanityReview } from './actions.js'
import { INTERVIEW_REPORT_GENRE, INTERVIEW_REPORT_UNIT_ID } from './curriculum.js'

const assessments = [
  { rubricId: 'purpose-and-subject', criterionId: 'purpose', status: 'met' },
  { rubricId: 'purpose-and-subject', criterionId: 'interviewee', status: 'met' },
  { rubricId: 'information', criterionId: 'new-fact', status: 'met' },
  { rubricId: 'information', criterionId: 'fact-detail', status: 'partial' },
  { rubricId: 'structure', criterionId: 'opening', status: 'partial' },
  { rubricId: 'structure', criterionId: 'body', status: 'met' },
  { rubricId: 'structure', criterionId: 'closing', status: 'partial' },
]

const mission = {
  id: 'mission-1',
  rubricIds: ['information'],
  criterionIds: ['fact-detail'],
  title: '새 사실에 까닭 덧붙이기',
  instruction: '새 사실 뒤에 면담에서 들은 까닭을 하나 덧붙여 보세요.',
  criterion: '새 사실에 까닭이 추가되었는가',
}
const missions = [
  mission,
  {
    id: 'mission-2',
    rubricIds: ['structure'],
    criterionIds: ['closing'],
    title: '느낀 점 연결하기',
    instruction: '느낀 점을 본문의 면담 사실 하나와 연결해 보세요.',
    criterion: '느낀 점이 본문의 면담 사실과 연결되었는가',
  },
]

function submission(genre) {
  return {
    id: 'submission-1',
    writing: '',
    feedback: null,
    attainment: 0,
    lastSubmittedWriting: null,
    lastImprovements: [],
    rounds: [],
    activity: {
      genre,
      topic: '우리 동네에서 일하는 사람',
      targetLength: 1,
    },
  }
}

describe('requestCoaching unit orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.update.mockResolvedValue({})
  })

  it('uses the interview-report pipeline and persists dynamic missions and assessments', async () => {
    mocks.findUnique.mockResolvedValue(submission('면담 보고서'))
    mocks.getRubricCoachingFeedback.mockResolvedValue({
      meaningless: false,
      assessments,
      priorMissions: [],
      strength: { text: '면담 대상을 분명히 밝혔어요.' },
      missions,
    })

    const result = await requestCoaching('submission-1', '면담 보고서 본문')

    expect(mocks.getRubricCoachingFeedback).toHaveBeenCalledOnce()
    expect(mocks.getGeminiFeedback).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastImprovements: missions,
        feedback: expect.objectContaining({
          missions,
          assessments,
        }),
      }),
    }))
    expect(result.feedback.missions).toEqual(missions)
  })

  // Routing is by unit now, not genre. The rubric pipeline used to be reachable
  // only by writing '면담 보고서' into activity.genre; any unit carrying AI
  // criteria reaches it, and the genre is only consulted when unitId is null.
  it('routes by the activity unit, whatever the genre says', async () => {
    mocks.findUnique.mockResolvedValue({
      ...submission('기사문'),
      activity: { ...submission('기사문').activity, unitId: INTERVIEW_REPORT_UNIT_ID },
    })
    mocks.getRubricCoachingFeedback.mockResolvedValue({
      meaningless: false,
      assessments,
      priorMissions: [],
      strength: { text: '사실을 잘 전했어요.' },
      missions,
    })

    await requestCoaching('submission-1', '기사문 본문')

    expect(mocks.getRubricCoachingFeedback).toHaveBeenCalledOnce()
    expect(mocks.getGeminiFeedback).not.toHaveBeenCalled()
  })

  // Real activities in the database still point at 1학기 unit ids that were
  // dropped when the list moved to 2학기. An interview report among them was
  // routed by genre when it was made, and has to keep working.
  it('keeps coaching an interview report whose unit id no longer exists', async () => {
    mocks.findUnique.mockResolvedValue({
      ...submission(INTERVIEW_REPORT_GENRE),
      activity: { ...submission(INTERVIEW_REPORT_GENRE).activity, unitId: 'g6s1-unit7' },
    })
    mocks.getRubricCoachingFeedback.mockResolvedValue({
      meaningless: false,
      assessments,
      priorMissions: [],
      strength: { text: '목적이 분명해요.' },
      missions,
    })

    await requestCoaching('submission-1', '면담 보고서 본문')

    expect(mocks.getRubricCoachingFeedback).toHaveBeenCalledOnce()
    expect(mocks.getGeminiFeedback).not.toHaveBeenCalled()
  })

  it('falls back to the generic coach for a unit with no criteria', async () => {
    mocks.findUnique.mockResolvedValue({
      ...submission('줄거리 요약'),
      activity: { ...submission('줄거리 요약').activity, unitId: 'g6s2-unit1' },
    })
    mocks.getGeminiFeedback.mockResolvedValue({
      meaningless: false,
      strength: '사건을 잘 골랐어요.',
      improvements: ['첫 번째', '두 번째'],
    })

    await requestCoaching('submission-1', '줄거리 본문')

    expect(mocks.getGeminiFeedback).toHaveBeenCalledOnce()
    expect(mocks.getRubricCoachingFeedback).not.toHaveBeenCalled()
  })

  it('preserves the last meaningful attainment through a meaningless interview round', async () => {
    const firstMissions = missions.map((mission, index) => ({ ...mission, id: `first-${index + 1}` }))
    const secondMissions = missions.map((mission, index) => ({ ...mission, id: `second-${index + 1}` }))
    const initial = {
      ...submission(INTERVIEW_REPORT_GENRE),
      feedback: { missions },
      attainment: 80,
      lastSubmittedWriting: 'previous meaningful writing',
      lastImprovements: missions,
    }
    mocks.findUnique.mockResolvedValueOnce(initial)
    mocks.getRubricCoachingFeedback
      .mockResolvedValueOnce({
        meaningless: false,
        assessments,
        priorMissions: [
          { missionId: 'mission-1', status: 'done' },
          { missionId: 'mission-2', status: 'partial' },
        ],
        strength: { text: 'A meaningful strength.' },
        missions: firstMissions,
      })
      .mockResolvedValueOnce({ meaningless: true })
      .mockResolvedValueOnce({
        meaningless: false,
        assessments,
        priorMissions: [
          { missionId: 'first-1', status: 'partial' },
          { missionId: 'first-2', status: 'not-done' },
        ],
        strength: { text: 'Another meaningful strength.' },
        missions: secondMissions,
      })

    const first = await requestCoaching('submission-1', 'first meaningful revision')
    mocks.findUnique.mockResolvedValueOnce({
      ...initial,
      attainment: first.attainment,
      lastSubmittedWriting: 'first meaningful revision',
      lastImprovements: firstMissions,
      rounds: first.rounds,
    })

    const meaningless = await requestCoaching('submission-1', 'meaningless revision')
    mocks.findUnique.mockResolvedValueOnce({
      ...initial,
      feedback: meaningless.feedback,
      attainment: meaningless.attainment,
      lastSubmittedWriting: 'first meaningful revision',
      lastImprovements: firstMissions,
      rounds: meaningless.rounds,
    })

    const resumed = await requestCoaching('submission-1', 'next meaningful revision')

    expect(first.attainment).toBe(90)
    expect(meaningless.feedback).toEqual({ flagged: true, reason: 'nonsense' })
    expect(meaningless.attainment).toBe(90)
    expect(resumed.attainment).toBe(90)
    expect(mocks.update.mock.calls.map(([call]) => call.data.attainment)).toEqual([90, 90, 90])
  })

  it('preserves attainment and skips Gemini when the rule guard flags a request', async () => {
    mocks.findUnique.mockResolvedValue({
      ...submission('일기'),
      attainment: 90,
      feedback: { strength: 'previous meaningful feedback' },
    })

    const result = await requestCoaching('submission-1', 'ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ')

    expect(result).toMatchObject({
      feedback: { flagged: true, reason: 'nonsense' },
      attainment: 90,
    })
    expect(mocks.getGeminiFeedback).not.toHaveBeenCalled()
    expect(mocks.getRubricCoachingFeedback).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ attainment: 90 }),
    }))
  })

  it('preserves attainment when a teacher rejects a profanity review', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'teacher-1' } })
    mocks.findUnique.mockResolvedValue({
      ...submission('일기'),
      writing: 'reviewed writing',
      attainment: 90,
      feedback: { pending: true, reason: 'profanity' },
      activity: {
        ...submission('일기').activity,
        teacherId: 'teacher-1',
      },
    })

    const result = await resolveProfanityReview('submission-1', 'reject')

    expect(result).toMatchObject({
      feedback: { flagged: true, reason: 'profanity' },
      attainment: 90,
    })
    expect(mocks.getGeminiFeedback).not.toHaveBeenCalled()
    expect(mocks.getRubricCoachingFeedback).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ attainment: 90 }),
    }))
  })

  it('preserves attainment when a non-interview Gemini round is meaningless', async () => {
    mocks.findUnique.mockResolvedValue({
      ...submission('일기'),
      attainment: 90,
      feedback: { strength: 'previous meaningful feedback' },
    })
    mocks.getGeminiFeedback.mockResolvedValue({ meaningless: true })

    const result = await requestCoaching('submission-1', 'meaningless diary revision')

    expect(result).toMatchObject({
      feedback: { flagged: true, reason: 'nonsense' },
      attainment: 90,
    })
    expect(mocks.getGeminiFeedback).toHaveBeenCalledOnce()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ attainment: 90 }),
    }))
  })

  it('keeps the legacy Gemini pipeline for other genres', async () => {
    mocks.findUnique.mockResolvedValue(submission('일기'))
    mocks.getGeminiFeedback.mockResolvedValue({
      meaningless: false,
      strength: '하루의 일을 밝혔어요.',
      improvements: ['느낌을 덧붙여 보세요.', '마무리를 써 보세요.'],
      addressed: null,
    })

    await requestCoaching('submission-1', '일기 본문')

    expect(mocks.getGeminiFeedback).toHaveBeenCalledOnce()
    expect(mocks.getRubricCoachingFeedback).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastImprovements: ['느낌을 덧붙여 보세요.', '마무리를 써 보세요.'],
      }),
    }))
  })

  it('does not persist anything when interview mission generation fails', async () => {
    mocks.findUnique.mockResolvedValue(submission('면담 보고서'))
    mocks.getRubricCoachingFeedback.mockRejectedValue(new Error('mission stage failed'))

    await expect(requestCoaching('submission-1', '면담 보고서 본문'))
      .rejects.toThrow('mission stage failed')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
