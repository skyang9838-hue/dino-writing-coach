import { describe, expect, it } from 'vitest'
import {
  GENRES,
  GRADES,
  GRADE6_SEMESTER1_UNITS,
  getGenreGuidance,
  getRecommendedLength,
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
  it('covers the 8 writing units (unit 3 has no writing activity)', () => {
    expect(GRADE6_SEMESTER1_UNITS.map((unit) => unit.unitNumber)).toEqual([1, 2, 4, 5, 6, 7, 8, 9])
  })

  it('maps every unit to a genre with coaching guidance', () => {
    for (const unit of GRADE6_SEMESTER1_UNITS) {
      expect(GENRES).toContain(unit.genre)
      expect(getGenreGuidance(unit.genre)).toBeTruthy()
    }
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
