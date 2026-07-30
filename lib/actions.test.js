import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  getGeminiFeedback: vi.fn(),
  getInterviewReportFeedback: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('../auth.js', () => ({ auth: vi.fn() }))
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
    getInterviewReportFeedback: mocks.getInterviewReportFeedback,
  }
})

import { requestCoaching } from './actions.js'

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

describe('requestCoaching genre orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.update.mockResolvedValue({})
  })

  it('uses the interview-report pipeline and persists dynamic missions and assessments', async () => {
    mocks.findUnique.mockResolvedValue(submission('면담 보고서'))
    mocks.getInterviewReportFeedback.mockResolvedValue({
      meaningless: false,
      assessments,
      priorMissions: [],
      strength: { text: '면담 대상을 분명히 밝혔어요.' },
      missions,
    })

    const result = await requestCoaching('submission-1', '면담 보고서 본문')

    expect(mocks.getInterviewReportFeedback).toHaveBeenCalledOnce()
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
    expect(mocks.getInterviewReportFeedback).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastImprovements: ['느낌을 덧붙여 보세요.', '마무리를 써 보세요.'],
      }),
    }))
  })

  it('does not persist anything when interview mission generation fails', async () => {
    mocks.findUnique.mockResolvedValue(submission('면담 보고서'))
    mocks.getInterviewReportFeedback.mockRejectedValue(new Error('mission stage failed'))

    await expect(requestCoaching('submission-1', '면담 보고서 본문'))
      .rejects.toThrow('mission stage failed')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
