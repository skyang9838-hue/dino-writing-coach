import { describe, expect, it } from 'vitest'
import {
  GENRES,
  GRADES,
  GRADE6_SEMESTER2_UNITS,
  INTERVIEW_REPORT_GENRE,
  INTERVIEW_REPORT_UNIT_ID,
  getAiRubrics,
  getGenreGuidance,
  getRecommendedLength,
  getUnitById,
  getUnitChunks,
  getUnitStandards,
  isAiJudged,
  showsAiVerdict,
} from './curriculum.js'

// A unit that is only an activity template: no standards, no criteria. Used
// wherever a test needs the "nothing to grade here" case.
const UNIT_WITHOUT_CRITERIA = 'g6s2-unit1'

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

describe('GRADE6_SEMESTER2_UNITS', () => {
  it('lists the numbered semester 2 units in order', () => {
    expect(GRADE6_SEMESTER2_UNITS.map((unit) => unit.unitNumber)).toEqual([1, 2, 5, undefined, 6])
  })

  // 매체 단원은 교육과정에 번호가 없다. 번호 자리에 들어갈 이름을 따로 들고
  // 있어야 활동 생성 카드가 'undefined단원'을 찍지 않는다.
  it('gives every unit either a number or a label to show in its place', () => {
    for (const unit of GRADE6_SEMESTER2_UNITS) {
      expect(unit.unitLabel ?? unit.unitNumber).toBeDefined()
      expect(Number.isInteger(unit.unitNumber) || typeof unit.unitLabel === 'string').toBe(true)
    }
    const media = getUnitById('g6s2-media')
    expect(media.unitLabel).toBe('매체 단원')
    expect(media.unitNumber).toBeUndefined()
  })

  it('keeps the interview report pilot on its original unit id', () => {
    // Activities already in the database point at this id. Changing it would
    // orphan them, and it is the unit the eval fixtures are labelled against.
    expect(getUnitById(INTERVIEW_REPORT_UNIT_ID)).toMatchObject({
      unitNumber: 2,
      genre: INTERVIEW_REPORT_GENRE,
      title: '면담 보고서 쓰기',
    })
  })

  it('maps every unit to a genre with coaching guidance', () => {
    for (const unit of GRADE6_SEMESTER2_UNITS) {
      expect(GENRES).toContain(unit.genre)
      expect(getGenreGuidance(unit.genre)).toBeTruthy()
    }
  })

  it('gives every unit a unique id and a recommended length', () => {
    const ids = GRADE6_SEMESTER2_UNITS.map((unit) => unit.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const unit of GRADE6_SEMESTER2_UNITS) {
      expect(unit.recommendedLength).toEqual(expect.any(Number))
    }
  })
})

describe('unit achievement standards', () => {
  it('states the interview report standard once, on the unit', () => {
    expect(getUnitStandards(INTERVIEW_REPORT_UNIT_ID)).toEqual([
      { code: '6국01-04', text: expect.stringContaining('면담의 절차') },
    ])
  })

  it('carries both standards for the 매체 unit', () => {
    expect(getUnitStandards('g6s2-media').map((standard) => standard.code)).toEqual([
      '6국06-04',
      '6국03-06',
    ])
  })

  it('returns null for a unit with no standards yet', () => {
    expect(getUnitStandards(UNIT_WITHOUT_CRITERIA)).toBeNull()
    expect(getUnitStandards('does-not-exist')).toBeNull()
  })
})

describe('the interview report unit criteria', () => {
  const chunks = getUnitChunks(INTERVIEW_REPORT_UNIT_ID)

  it('splits the criteria into an AI-judged chunk and a teacher-judged one', () => {
    expect(chunks.map((chunk) => [chunk.label, chunk.criteria.length])).toEqual([
      ['면담의 절차', 4],
      ['상대와 매체 고려', 2],
    ])
    expect(getUnitChunks(UNIT_WITHOUT_CRITERIA)).toBeNull()
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
})

// Every unit's criteria have to satisfy the same contract, so this walks all
// of them rather than spot-checking the pilot. A unit added later is covered
// the moment it lands.
describe('every unit with criteria', () => {
  const unitsWithCriteria = GRADE6_SEMESTER2_UNITS.filter((unit) => unit.chunks)

  it('covers the four units the curriculum notes describe', () => {
    expect(unitsWithCriteria.map((unit) => unit.id)).toEqual([
      'g6s2-unit2',
      'g6s2-unit5',
      'g6s2-media',
      'g6s2-unit6',
    ])
  })

  it.each(unitsWithCriteria.map((unit) => [unit.id, unit]))(
    '%s marks every criterion with who judges it',
    (_id, unit) => {
      for (const chunk of unit.chunks) {
        for (const criterion of chunk.criteria) {
          expect(['ai', 'teacher', 'teacher-ai-feedback']).toContain(criterion.evaluator)
          expect(criterion.shortLabel).toEqual(expect.any(String))
          expect(criterion.shortLabel.length).toBeLessThanOrEqual(20)
        }
      }
    },
  )

  it.each(unitsWithCriteria.map((unit) => [unit.id, unit]))(
    '%s gives every AI-judged criterion the fields the pipeline needs',
    (_id, unit) => {
      const aiCriteria = unit.chunks.flatMap((chunk) => chunk.criteria.filter(isAiJudged))
      expect(aiCriteria.length).toBeGreaterThan(0)

      for (const criterion of aiCriteria) {
        expect(criterion.statuses).toEqual({
          met: expect.any(String),
          partial: expect.any(String),
          unmet: expect.any(String),
        })
        expect(criterion.missionSeed).toEqual(expect.any(String))
        // Picked when the criterion is already met but a mission slot has to
        // be filled anyway — lib/missions.js reads it off the criterion.
        expect(criterion.refinementSeed).toEqual(expect.any(String))
        expect(criterion.priority).toEqual(expect.any(Number))
      }
    },
  )

  it.each(unitsWithCriteria.map((unit) => [unit.id, unit]))(
    '%s keeps every criterion id unique across the unit',
    (_id, unit) => {
      const ids = unit.chunks.flatMap((chunk) => chunk.criteria.map((criterion) => criterion.id))
      expect(new Set(ids).size).toBe(ids.length)
    },
  )

  it.each(unitsWithCriteria.map((unit) => [unit.id, unit]))(
    '%s gives the AI wording for whatever it is allowed to invent',
    (_id, unit) => {
      // Without these two the mission prompt loses the rules that stop the
      // model writing the student's content for them.
      expect(unit.missionGuidance.grounding).toEqual(expect.any(String))
      expect(unit.missionGuidance.selfFill).toEqual(expect.any(String))
    },
  )
})

describe('the third evaluator', () => {
  const articleCriteria = getUnitChunks('g6s2-unit5').flatMap((chunk) => chunk.criteria)
  const advisory = articleCriteria.filter(
    (criterion) => criterion.evaluator === 'teacher-ai-feedback',
  )

  it('covers the criteria the notes mark 교사재량 but 피드백은 가능', () => {
    expect(advisory.map((criterion) => criterion.id)).toEqual([
      'newsworthy-topic',
      'headline',
      'fact-delivery',
    ])
  })

  // The whole point of the third kind: the AI judges it so it can advise, the
  // board keeps the verdict off the screen so the teacher's call stands.
  it('is judged by the AI but never shows its verdict', () => {
    for (const criterion of advisory) {
      expect(isAiJudged(criterion)).toBe(true)
      expect(showsAiVerdict(criterion)).toBe(false)
    }
  })

  it('still shows the verdict for a plain AI criterion', () => {
    const aiCriterion = articleCriteria.find((criterion) => criterion.id === 'article-structure')
    expect(isAiJudged(aiCriterion)).toBe(true)
    expect(showsAiVerdict(aiCriterion)).toBe(true)
  })

  it('keeps a plain teacher criterion away from the AI entirely', () => {
    const teacherCriterion = articleCriteria.find(
      (criterion) => criterion.id === 'plain-expression',
    )
    expect(isAiJudged(teacherCriterion)).toBe(false)
    expect(showsAiVerdict(teacherCriterion)).toBe(false)
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

  it.each([
    ['g6s2-unit2', ['audience', 'medium']],
    ['g6s2-media', ['participation', 'share-audience']],
    ['g6s2-unit5', ['plain-expression']],
    ['g6s2-unit6', ['character-setting-change', 'experience-and-thought', 'creative-change']],
  ])('drops every teacher-only criterion of %s', (unitId, teacherOnlyIds) => {
    const serialised = JSON.stringify(getAiRubrics(unitId))
    for (const id of teacherOnlyIds) {
      expect(serialised).not.toContain(id)
    }
  })

  it('keeps the advisory criteria so the AI can write missions about them', () => {
    const ids = getAiRubrics('g6s2-unit5').flatMap((rubric) =>
      rubric.criteria.map((criterion) => criterion.id),
    )
    expect(ids).toEqual([
      'newsworthy-topic',
      'headline',
      'article-structure',
      'five-w-one-h',
      'fact-delivery',
    ])
  })

  it('drops a chunk once its only criteria are teacher-judged', () => {
    // 매체 단원의 뒤 두 청크는 전부 교사 몫이라 루브릭으로 넘어오지 않는다.
    expect(getAiRubrics('g6s2-media').map((rubric) => rubric.id)).toEqual(['media-reflection'])
  })

  it('returns null for a unit with no criteria', () => {
    expect(getAiRubrics(UNIT_WITHOUT_CRITERIA)).toBeNull()
    expect(getAiRubrics('does-not-exist')).toBeNull()
  })
})

describe('getUnitById', () => {
  it('returns the matching unit', () => {
    expect(getUnitById('g6s2-unit5')?.title).toBe('독자와 매체를 고려하여 기사문 작성하기')
  })

  it('returns null for an unknown unit id', () => {
    expect(getUnitById('does-not-exist')).toBeNull()
  })
})
