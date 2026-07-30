import { describe, expect, it } from 'vitest'
import {
  GENRES,
  GRADES,
  GRADE6_SEMESTER1_UNITS,
  INTERVIEW_REPORT_GENRE,
  INTERVIEW_REPORT_RUBRICS,
  getGenreGuidance,
  getRecommendedLength,
  getRubricsForGenre,
  getUnitById,
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

describe('INTERVIEW_REPORT_RUBRICS', () => {
  it('defines three rubrics with seven unique observable criteria', () => {
    expect(INTERVIEW_REPORT_RUBRICS.map((rubric) => rubric.criteria.length)).toEqual([2, 2, 3])

    const criteria = INTERVIEW_REPORT_RUBRICS.flatMap((rubric) => rubric.criteria)
    expect(new Set(criteria.map((criterion) => criterion.id)).size).toBe(7)

    for (const criterion of criteria) {
      expect(criterion.statuses).toEqual({
        met: expect.any(String),
        partial: expect.any(String),
        unmet: expect.any(String),
      })
      expect(criterion.missionSeed).toEqual(expect.any(String))
      expect(criterion.priority).toEqual(expect.any(Number))
    }
  })

  it('returns the rubric only for the interview report genre', () => {
    expect(getRubricsForGenre(INTERVIEW_REPORT_GENRE)).toBe(INTERVIEW_REPORT_RUBRICS)
    expect(getRubricsForGenre('일기')).toBeNull()
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
