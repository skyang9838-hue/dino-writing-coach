import { describe, expect, it } from 'vitest'
import { INTERVIEW_REPORT_UNIT_ID } from './curriculum.js'
import { getChunkRows, getMissionRows, getTrend } from './revisionBoard.js'

const assessments = (statuses) =>
  ['purpose-and-target', 'preparation', 'learned-facts', 'reflection'].map(
    (criterionId, index) => ({
      rubricId: 'interview-procedure',
      criterionId,
      status: statuses[index],
    }),
  )

const ALL_MET = assessments(['met', 'met', 'met', 'met'])

describe('getTrend', () => {
  it('has no trend to show on the first round', () => {
    expect(getTrend(undefined, 'met')).toBeNull()
    expect(getTrend(null, 'unmet')).toBeNull()
  })

  it('ranks unmet below partial below met', () => {
    expect(getTrend('unmet', 'partial')).toBe('up')
    expect(getTrend('partial', 'met')).toBe('up')
    expect(getTrend('unmet', 'met')).toBe('up')
    expect(getTrend('met', 'partial')).toBe('down')
    expect(getTrend('partial', 'unmet')).toBe('down')
    expect(getTrend('met', 'met')).toBe('same')
  })

  it('returns null when either status is unrecognised', () => {
    expect(getTrend('met', 'bogus')).toBeNull()
    expect(getTrend('bogus', 'met')).toBeNull()
  })
})

describe('getChunkRows', () => {
  const rowsOf = (chunks) => chunks.flatMap((chunk) => chunk.rows)

  it('groups the criteria by chunk, in the curriculum order', () => {
    const chunks = getChunkRows(INTERVIEW_REPORT_UNIT_ID, { assessments: ALL_MET }, null)

    expect(chunks.map((chunk) => [chunk.id, chunk.rows.length])).toEqual([
      ['interview-procedure', 4],
      ['audience-and-medium', 2],
    ])
    expect(chunks[0].label).toBe('면담의 절차')
    expect(chunks[0].rows.map((row) => row.id)).toEqual([
      'purpose-and-target',
      'preparation',
      'learned-facts',
      'reflection',
    ])
    expect(chunks[0].rows[0].label).toBe('목적·대상이 드러난다')
    expect(chunks[0].rows.every((row) => row.status === 'met')).toBe(true)
  })

  // The board is read-only and stores no teacher verdict, so these rows carry
  // no status to show — not now and not after the next round either.
  it('leaves teacher-judged rows blank without consulting the assessments', () => {
    const chunks = getChunkRows(
      INTERVIEW_REPORT_UNIT_ID,
      { assessments: [...ALL_MET, { rubricId: 'audience-and-medium', criterionId: 'audience', status: 'met' }] },
      { assessments: [...ALL_MET, { rubricId: 'audience-and-medium', criterionId: 'audience', status: 'unmet' }] },
    )

    expect(chunks[1].rows).toEqual([
      { id: 'audience', label: '상대를 고려했는가?', evaluator: 'teacher', status: null, trend: null },
      { id: 'medium', label: '매체를 고려했는가?', evaluator: 'teacher', status: null, trend: null },
    ])
  })

  it('leaves the trend empty on the first round', () => {
    const chunks = getChunkRows(INTERVIEW_REPORT_UNIT_ID, { assessments: ALL_MET }, null)

    expect(rowsOf(chunks).every((row) => row.trend === null)).toBe(true)
  })

  it('compares each criterion against the same criterion in the previous round', () => {
    const previousRound = { assessments: assessments(['unmet', 'met', 'partial', 'met']) }
    const round = { assessments: assessments(['partial', 'met', 'met', 'unmet']) }

    const chunks = getChunkRows(INTERVIEW_REPORT_UNIT_ID, round, previousRound)

    expect(chunks[0].rows.map((row) => row.trend)).toEqual(['up', 'same', 'up', 'down'])
  })

  it('returns no chunks for a unit without criteria', () => {
    expect(getChunkRows('g6s1-unit5', { assessments: ALL_MET }, null)).toEqual([])
  })

  it('returns no chunks when the activity has no unit at all', () => {
    expect(getChunkRows(null, { assessments: ALL_MET }, null)).toEqual([])
  })

  it('returns no chunks for a round saved before the rubric pipeline existed', () => {
    expect(getChunkRows(INTERVIEW_REPORT_UNIT_ID, { writing: '어제 면담을 했다.' }, null)).toEqual([])
  })

  // Rounds saved under the old seven criteria still open; their verdicts just
  // have nowhere to land, which is what the blank column means.
  it('marks a criterion the assessment never covered as unknown rather than dropping the row', () => {
    const round = { assessments: ALL_MET.filter((item) => item.criterionId !== 'reflection') }
    const chunks = getChunkRows(INTERVIEW_REPORT_UNIT_ID, round, null)

    expect(chunks[0].rows).toHaveLength(4)
    expect(chunks[0].rows.at(-1)).toMatchObject({ id: 'reflection', status: null, trend: null })
  })

  it('shows nothing for a round assessed under the old criterion ids', () => {
    const legacyRound = {
      assessments: [
        { rubricId: 'structure', criterionId: 'closing', status: 'met' },
        { rubricId: 'information', criterionId: 'new-fact', status: 'met' },
      ],
    }
    const chunks = getChunkRows(INTERVIEW_REPORT_UNIT_ID, legacyRound, null)

    expect(chunks[0].rows.every((row) => row.status === null)).toBe(true)
  })
})

describe('getMissionRows', () => {
  const round = {
    missions: [
      { id: 'm1', title: '면담 준비 과정 쓰기', instruction: '준비 과정을 한 문장 더 써보자.' },
      { id: 'm2', title: '느낀 점 구체적으로 쓰기', instruction: '느낀 점에 까닭을 붙여보자.' },
    ],
  }

  it('reads each mission result from the round that judged it', () => {
    const nextRound = {
      priorMissionStatuses: [
        { missionId: 'm2', status: 'not-done' },
        { missionId: 'm1', status: 'done' },
      ],
    }

    expect(getMissionRows(round, nextRound)).toEqual([
      { title: '면담 준비 과정 쓰기', instruction: '준비 과정을 한 문장 더 써보자.', status: 'done' },
      { title: '느낀 점 구체적으로 쓰기', instruction: '느낀 점에 까닭을 붙여보자.', status: 'not-done' },
    ])
  })

  it('leaves the latest round pending — nothing has judged it yet', () => {
    expect(getMissionRows(round, null).map((row) => row.status)).toEqual(['pending', 'pending'])
  })

  it('stays pending when the next round did not judge that mission', () => {
    const nextRound = { priorMissionStatuses: [{ missionId: 'm1', status: 'partial' }] }

    expect(getMissionRows(round, nextRound).map((row) => row.status)).toEqual(['partial', 'pending'])
  })

  it('falls back to the legacy improvements array and its positional statuses', () => {
    const legacyRound = { improvements: ['첫 문단을 다듬자.', '느낀 점을 덧붙이자.'] }
    const nextRound = { addressed: [true, false] }

    expect(getMissionRows(legacyRound, nextRound)).toEqual([
      { title: null, instruction: '첫 문단을 다듬자.', status: 'done' },
      { title: null, instruction: '느낀 점을 덧붙이자.', status: 'not-done' },
    ])
  })

  it('returns nothing for a round with no missions', () => {
    expect(getMissionRows({ writing: '어제 면담을 했다.' }, null)).toEqual([])
  })
})

// The 기사문 unit is the first with criteria the AI judges but the board must
// not show a verdict for. The judgement is in round.assessments — the missions
// were written from it — and the board still has to print — there, because on
// those criteria the teacher's call is the one that counts.
describe('getChunkRows with advisory criteria', () => {
  const ARTICLE_UNIT = 'g6s2-unit5'
  const articleAssessments = [
    { rubricId: 'reader-content', criterionId: 'newsworthy-topic', status: 'met' },
    { rubricId: 'reader-content', criterionId: 'headline', status: 'unmet' },
    { rubricId: 'medium-form', criterionId: 'article-structure', status: 'partial' },
    { rubricId: 'medium-form', criterionId: 'five-w-one-h', status: 'unmet' },
    { rubricId: 'medium-form', criterionId: 'fact-delivery', status: 'met' },
  ]

  const rowFor = (chunks, id) =>
    chunks.flatMap((chunk) => chunk.rows).find((row) => row.id === id)

  it('withholds the verdict the AI made for an advisory criterion', () => {
    const chunks = getChunkRows(ARTICLE_UNIT, { assessments: articleAssessments }, null)

    expect(rowFor(chunks, 'newsworthy-topic')).toEqual({
      id: 'newsworthy-topic',
      label: '기삿거리가 관심을 끈다',
      evaluator: 'teacher-ai-feedback',
      status: null,
      trend: null,
    })
    expect(rowFor(chunks, 'fact-delivery').status).toBeNull()
  })

  it('shows no change arrow for an advisory criterion even when it moved', () => {
    const previous = {
      assessments: articleAssessments.map((assessment) =>
        assessment.criterionId === 'headline' ? { ...assessment, status: 'met' } : assessment,
      ),
    }
    const chunks = getChunkRows(ARTICLE_UNIT, { assessments: articleAssessments }, previous)

    expect(rowFor(chunks, 'headline').trend).toBeNull()
  })

  it('still shows the verdict and the change for a plain AI criterion', () => {
    const previous = {
      assessments: articleAssessments.map((assessment) =>
        assessment.criterionId === 'article-structure'
          ? { ...assessment, status: 'unmet' }
          : assessment,
      ),
    }
    const chunks = getChunkRows(ARTICLE_UNIT, { assessments: articleAssessments }, previous)

    expect(rowFor(chunks, 'article-structure')).toMatchObject({
      evaluator: 'ai',
      status: 'partial',
      trend: 'up',
    })
  })

  it('lists every criterion the unit has, teacher-only ones included', () => {
    const chunks = getChunkRows(ARTICLE_UNIT, { assessments: articleAssessments }, null)

    expect(chunks.map((chunk) => [chunk.label, chunk.rows.length])).toEqual([
      ['독자 고려하여 내용 생성하기', 3],
      ['매체 고려하여 표현하며 글쓰기', 3],
    ])
    expect(rowFor(chunks, 'plain-expression')).toMatchObject({
      evaluator: 'teacher',
      status: null,
    })
  })

  // 6단원은 채점기준을 청크로 나누지 않았다. 화면이 붙일 제목이 없다는 뜻이다.
  it('hands the board a null label for a unit whose criteria are not chunked', () => {
    const chunks = getChunkRows(
      'g6s2-unit6',
      { assessments: [{ rubricId: 'story-rewrite', criterionId: 'own-experience', status: 'met' }] },
      null,
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0].label).toBeNull()
    expect(chunks[0].rows).toHaveLength(6)
  })
})
