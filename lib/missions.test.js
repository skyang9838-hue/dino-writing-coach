import { describe, expect, it } from 'vitest'
import { INTERVIEW_REPORT_UNIT_ID, getAiRubrics } from './curriculum.js'
import { selectMissionTargets } from './missions.js'

const RUBRICS = getAiRubrics(INTERVIEW_REPORT_UNIT_ID)
const CHUNK = 'interview-procedure'

function assessment(criterionId, status, rubricId = CHUNK) {
  return { rubricId, criterionId, status }
}

function completeAssessments(overrides = {}) {
  return RUBRICS.flatMap((rubric) =>
    rubric.criteria.map((criterion) =>
      assessment(criterion.id, overrides[criterion.id] ?? 'met', rubric.id),
    ),
  )
}

describe('selectMissionTargets', () => {
  // The four criteria are independent, so each one stands alone as a target.
  // There used to be merge rules here (new-fact + fact-detail, purpose +
  // interviewee) because those pairs produced near-identical missions; the
  // criteria they merged into are now single criteria.
  it('makes each criterion its own target', () => {
    const targets = selectMissionTargets({
      assessments: [
        assessment('learned-facts', 'unmet'),
        assessment('purpose-and-target', 'unmet'),
      ],
      rubrics: RUBRICS,
    })

    expect(targets.map((target) => target.criterionIds)).toEqual([
      ['learned-facts'],
      ['purpose-and-target'],
    ])
    expect(targets[0].rubricIds).toEqual([CHUNK])
  })

  it('prefers unmet over partial and returns at most two targets', () => {
    const targets = selectMissionTargets({
      assessments: [
        assessment('learned-facts', 'partial'),
        assessment('purpose-and-target', 'unmet'),
        assessment('reflection', 'unmet'),
        assessment('preparation', 'partial'),
      ],
      rubrics: RUBRICS,
    })

    expect(targets).toHaveLength(2)
    expect(targets.map((target) => target.criterionIds)).toEqual([
      ['purpose-and-target'],
      ['reflection'],
    ])
  })

  it('keeps an unmet repeated target ahead of a non-repeated partial target', () => {
    const targets = selectMissionTargets({
      assessments: [
        assessment('purpose-and-target', 'unmet'),
        assessment('reflection', 'partial'),
      ],
      rubrics: RUBRICS,
      priorRounds: [
        { missions: [{ criterionIds: ['purpose-and-target'] }] },
        { missions: [{ criterionIds: ['purpose-and-target'] }] },
      ],
    })

    expect(targets.map((target) => target.criterionIds)).toEqual([
      ['purpose-and-target'],
      ['reflection'],
    ])
  })

  it('demotes a target that was used in the two most recent rounds', () => {
    const targets = selectMissionTargets({
      assessments: [
        assessment('purpose-and-target', 'unmet'),
        assessment('reflection', 'unmet'),
        assessment('preparation', 'unmet'),
      ],
      rubrics: RUBRICS,
      priorRounds: [
        { missions: [{ criterionIds: ['purpose-and-target'] }] },
        { missions: [{ criterionIds: ['purpose-and-target'] }] },
      ],
    })

    expect(targets).toHaveLength(2)
    expect(targets[0].criterionIds).toEqual(['reflection'])
    expect(targets[1].criterionIds).toEqual(['preparation'])
  })

  it('returns two distinct refinement targets when every criterion is met', () => {
    const targets = selectMissionTargets({
      assessments: completeAssessments(),
      rubrics: RUBRICS,
    })

    expect(targets).toHaveLength(2)
    expect(new Set(targets.map((target) => target.criterionIds.join('|'))).size).toBe(2)
    expect(targets.every((target) => target.refinement)).toBe(true)
    expect(targets.every((target) => target.missionSeed)).toBe(true)
  })

  it('fills the second slot with a refinement target when only one weak target remains', () => {
    const targets = selectMissionTargets({
      assessments: completeAssessments({ reflection: 'partial' }),
      rubrics: RUBRICS,
    })

    expect(targets).toHaveLength(2)
    expect(targets[0]).toEqual(expect.objectContaining({
      criterionIds: ['reflection'],
      refinement: false,
    }))
    expect(targets[1].refinement).toBe(true)
    expect(targets[1].criterionIds).not.toEqual(['reflection'])
  })

  // Four criteria is still enough to fill both slots in every combination —
  // the board promises exactly two missions per round, with no end state.
  it('always produces two targets, however the four criteria land', () => {
    const statuses = ['met', 'partial', 'unmet']
    for (const first of statuses) {
      for (const second of statuses) {
        for (const third of statuses) {
          for (const fourth of statuses) {
            const targets = selectMissionTargets({
              assessments: completeAssessments({
                'purpose-and-target': first,
                preparation: second,
                'learned-facts': third,
                reflection: fourth,
              }),
              rubrics: RUBRICS,
            })
            expect(targets).toHaveLength(2)
            expect(targets.every((target) => target.missionSeed)).toBe(true)
          }
        }
      }
    }
  })

  it('rejects unknown criterion IDs and statuses', () => {
    expect(() => selectMissionTargets({
      assessments: [assessment('made-up', 'unmet')],
      rubrics: RUBRICS,
    })).toThrow('알 수 없는 채점기준')

    expect(() => selectMissionTargets({
      assessments: [assessment('learned-facts', 'almost')],
      rubrics: RUBRICS,
    })).toThrow('알 수 없는 판정 상태')
  })

  // getAiRubrics never hands the teacher-judged criteria over, so if one ever
  // reached this far it would be rejected rather than turned into a mission.
  it('has no idea the teacher-judged criteria exist', () => {
    expect(() => selectMissionTargets({
      assessments: [assessment('audience', 'unmet', 'audience-and-medium')],
      rubrics: RUBRICS,
    })).toThrow('알 수 없는 채점기준')
  })
})
