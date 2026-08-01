import { describe, expect, it } from 'vitest'
import { INTERVIEW_REPORT_GENRE } from './curriculum.js'
import { getMissionRows, getRubricRows, getTrend } from './revisionBoard.js'

const assessments = (statuses) =>
  [
    ['purpose', 'purpose-and-subject'],
    ['interviewee', 'purpose-and-subject'],
    ['new-fact', 'information'],
    ['fact-detail', 'information'],
    ['opening', 'structure'],
    ['body', 'structure'],
    ['closing', 'structure'],
  ].map(([criterionId, rubricId], index) => ({
    rubricId,
    criterionId,
    status: statuses[index],
  }))

const ALL_MET = assessments(['met', 'met', 'met', 'met', 'met', 'met', 'met'])

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

describe('getRubricRows', () => {
  it('lists all seven criteria in rubric order with their short labels', () => {
    const rows = getRubricRows(INTERVIEW_REPORT_GENRE, { assessments: ALL_MET }, null)

    expect(rows.map((row) => row.id)).toEqual([
      'purpose',
      'interviewee',
      'new-fact',
      'fact-detail',
      'opening',
      'body',
      'closing',
    ])
    expect(rows[0].label).toBe('면담 목적이 드러난다')
    expect(rows.every((row) => row.status === 'met')).toBe(true)
  })

  it('leaves the trend empty on the first round', () => {
    const rows = getRubricRows(INTERVIEW_REPORT_GENRE, { assessments: ALL_MET }, null)

    expect(rows.every((row) => row.trend === null)).toBe(true)
  })

  it('compares each criterion against the same criterion in the previous round', () => {
    const previousRound = {
      assessments: assessments(['unmet', 'met', 'partial', 'met', 'met', 'met', 'met']),
    }
    const round = {
      assessments: assessments(['partial', 'met', 'met', 'unmet', 'met', 'met', 'met']),
    }

    expect(getRubricRows(INTERVIEW_REPORT_GENRE, round, previousRound).map((row) => row.trend)).toEqual([
      'up',
      'same',
      'up',
      'down',
      'same',
      'same',
      'same',
    ])
  })

  it('returns no rows for a genre without a rubric', () => {
    expect(getRubricRows('일기', { assessments: ALL_MET }, null)).toEqual([])
  })

  it('returns no rows for a round saved before the rubric pipeline existed', () => {
    expect(getRubricRows(INTERVIEW_REPORT_GENRE, { writing: '어제 면담을 했다.' }, null)).toEqual([])
  })

  it('marks a criterion the assessment never covered as unknown rather than dropping the row', () => {
    const round = { assessments: ALL_MET.filter((item) => item.criterionId !== 'closing') }
    const rows = getRubricRows(INTERVIEW_REPORT_GENRE, round, null)

    expect(rows).toHaveLength(7)
    expect(rows.at(-1)).toMatchObject({ id: 'closing', status: null, trend: null })
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
