import { describe, expect, it } from 'vitest'
import {
  GENRES,
  GRADES,
  GRADE6_SEMESTER1_UNITS,
  INTERVIEW_REPORT_GENRE,
  INTERVIEW_REPORT_UNIT_ID,
  getAiRubrics,
  getGenreGuidance,
  getRecommendedLength,
  getUnitById,
  getUnitChunks,
  getUnitStandard,
} from './curriculum.js'

describe('getRecommendedLength', () => {
  it('returns the recommended length for each known grade', () => {
    expect(getRecommendedLength('초1-2학년군')).toBe(200)
    expect(getRecommendedLength('초3-4학년군')).toBe(400)
    expect(getRecommendedLength('초5-6학년군')).toBe(600)
  })

  it('returns null for an unknown grade', () => {
    expect(getRecommendedLength('중1')).toBeNull()
  })
})

describe('getGenreGuidance', () => {
  it('returns guidance text for every genre in GENRES', () => {
    for (const genre of GENRES) {
      expect(getGenreGuidance(genre)).toBeTruthy()
    }
  })

  it('returns null for an unknown genre', () => {
    expect(getGenreGuidance('시')).toBeNull()
  })
})

describe('GRADES', () => {
  it('is ordered from youngest to oldest grade band', () => {
    expect(GRADES.map((g) => g.value)).toEqual(['초1-2학년군', '초3-4학년군', '초5-6학년군'])
  })
})

describe('GRADE6_SEMESTER1_UNITS', () => {
  it('offers the grade 6 semester 2 interview report as the first pilot activity', () => {
    expect(GRADE6_SEMESTER1_UNITS[0]).toMatchObject({
      id: 'g6s2-unit2',
      unitNumber: 2,
      genre: INTERVIEW_REPORT_GENRE,
      title: '면담 보고서 쓰기',
    })
  })

  it('maps every unit to a genre with coaching guidance', () => {
    for (const unit of GRADE6_SEMESTER1_UNITS) {
      expect(GENRES).toContain(unit.genre)
      expect(getGenreGuidance(unit.genre)).toBeTruthy()
    }
  })
})

describe('the interview report unit criteria', () => {
  const chunks = getUnitChunks(INTERVIEW_REPORT_UNIT_ID)

  it('states the achievement standard once, on the unit', () => {
    expect(getUnitStandard(INTERVIEW_REPORT_UNIT_ID)).toEqual({
      code: '6국01-04',
      text: expect.stringContaining('면담의 절차'),
    })
    expect(getUnitStandard('g6s1-unit5')).toBeNull()
    expect(getUnitStandard('does-not-exist')).toBeNull()
  })

  it('splits the criteria into an AI-judged chunk and a teacher-judged one', () => {
    expect(chunks.map((chunk) => [chunk.label, chunk.criteria.length])).toEqual([
      ['면담의 절차', 4],
      ['상대와 매체 고려', 2],
    ])
    expect(getUnitChunks('g6s1-unit5')).toBeNull()
  })

  it('gives every AI criterion the fields the pipeline needs', () => {
    const aiCriteria = chunks.flatMap((chunk) =>
      chunk.criteria.filter((criterion) => criterion.evaluator === 'ai'),
    )

    expect(aiCriteria).toHaveLength(4)
    expect(new Set(aiCriteria.map((criterion) => criterion.id)).size).toBe(4)

    for (const criterion of aiCriteria) {
      expect(criterion.statuses).toEqual({
        met: expect.any(String),
        partial: expect.any(String),
        unmet: expect.any(String),
      })
      expect(criterion.missionSeed).toEqual(expect.any(String))
      expect(criterion.priority).toEqual(expect.any(Number))
      // The teacher's revision board renders these in a narrow card column,
      // so every criterion needs a label short enough to fit one line.
      expect(criterion.shortLabel).toEqual(expect.any(String))
      expect(criterion.shortLabel.length).toBeLessThanOrEqual(20)
    }
  })

  // Teacher criteria are display-only. Anything the AI could act on — a
  // status rubric, a mission seed, a priority — would be dead weight at best
  // and a leak into the pipeline at worst.
  it('leaves teacher criteria with nothing for the AI to act on', () => {
    const teacherCriteria = chunks.flatMap((chunk) =>
      chunk.criteria.filter((criterion) => criterion.evaluator === 'teacher'),
    )

    expect(teacherCriteria.map((criterion) => criterion.id)).toEqual(['audience', 'medium'])
    for (const criterion of teacherCriteria) {
      expect(criterion.statuses).toBeUndefined()
      expect(criterion.missionSeed).toBeUndefined()
      expect(criterion.priority).toBeUndefined()
      expect(criterion.shortLabel.length).toBeLessThanOrEqual(20)
    }
  })

  it('marks every criterion with who judges it', () => {
    for (const chunk of chunks) {
      for (const criterion of chunk.criteria) {
        expect(['ai', 'teacher']).toContain(criterion.evaluator)
      }
    }
  })
})

describe('getAiRubrics', () => {
  it('hands the pipeline the AI chunk alone, in the shape the prompt takes', () => {
    const rubrics = getAiRubrics(INTERVIEW_REPORT_UNIT_ID)

    expect(rubrics).toHaveLength(1)
    expect(rubrics[0].id).toBe('interview-procedure')
    expect(rubrics[0].criteria.map((criterion) => criterion.id)).toEqual([
      'purpose-and-target',
      'preparation',
      'learned-facts',
      'reflection',
    ])
  })

  // This is the whole point of the evaluator split: a teacher-judged
  // criterion must not be able to reach the assessment prompt, the response
  // schema, or a mission target.
  it('never leaks a teacher-judged criterion', () => {
    const serialised = JSON.stringify(getAiRubrics(INTERVIEW_REPORT_UNIT_ID))

    expect(serialised).not.toContain('audience')
    expect(serialised).not.toContain('medium')
    expect(serialised).not.toContain('teacher')
    expect(serialised).not.toContain('상대와 매체')
  })

  it('returns null for a unit with no criteria', () => {
    expect(getAiRubrics('g6s1-unit5')).toBeNull()
    expect(getAiRubrics('does-not-exist')).toBeNull()
  })
})

describe('getUnitById', () => {
  it('returns the matching unit', () => {
    expect(getUnitById('g6s1-unit5')?.title).toBe('주장하는 글 쓰기')
  })

  it('returns null for an unknown unit id', () => {
    expect(getUnitById('does-not-exist')).toBeNull()
  })
})
