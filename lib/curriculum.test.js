import { describe, expect, it } from 'vitest'
import { GENRES, GRADES, getGenreGuidance, getRecommendedLength } from './curriculum.js'

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
