import { describe, expect, it } from 'vitest'
import { INTERVIEW_REPORT_RUBRICS } from './curriculum.js'
import { selectMissionTargets } from './missions.js'

function assessment(rubricId, criterionId, status) {
  return { rubricId, criterionId, status }
}

describe('selectMissionTargets', () => {
  it('merges missing new-fact and fact-detail into one core-information target', () => {
    expect(selectMissionTargets({
      assessments: [
        assessment('information', 'new-fact', 'unmet'),
        assessment('information', 'fact-detail', 'unmet'),
      ],
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })).toEqual([
      expect.objectContaining({
        rubricIds: ['information'],
        criterionIds: ['new-fact', 'fact-detail'],
      }),
    ])
  })

  it('merges a missing purpose and interviewee into one introduction target', () => {
    expect(selectMissionTargets({
      assessments: [
        assessment('purpose-and-subject', 'purpose', 'unmet'),
        assessment('purpose-and-subject', 'interviewee', 'partial'),
      ],
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })[0]).toEqual(expect.objectContaining({
      rubricIds: ['purpose-and-subject'],
      criterionIds: ['purpose', 'interviewee'],
    }))
  })

  it('suppresses body when the underlying new fact is absent', () => {
    const targets = selectMissionTargets({
      assessments: [
        assessment('information', 'new-fact', 'unmet'),
        assessment('structure', 'body', 'unmet'),
        assessment('structure', 'closing', 'unmet'),
      ],
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })

    expect(targets.flatMap((target) => target.criterionIds)).not.toContain('body')
    expect(targets.flatMap((target) => target.criterionIds)).toContain('closing')
  })

  it('suppresses opening when its purpose and interviewee content are absent', () => {
    const targets = selectMissionTargets({
      assessments: [
        assessment('purpose-and-subject', 'purpose', 'unmet'),
        assessment('purpose-and-subject', 'interviewee', 'unmet'),
        assessment('structure', 'opening', 'unmet'),
      ],
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })

    expect(targets).toHaveLength(1)
    expect(targets[0].criterionIds).toEqual(['purpose', 'interviewee'])
  })

  it('prefers unmet over partial and returns at most two targets', () => {
    const targets = selectMissionTargets({
      assessments: [
        assessment('information', 'new-fact', 'partial'),
        assessment('purpose-and-subject', 'purpose', 'unmet'),
        assessment('structure', 'closing', 'unmet'),
        assessment('structure', 'body', 'partial'),
      ],
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })

    expect(targets).toHaveLength(2)
    expect(targets.map((target) => target.criterionIds)).toEqual([
      ['purpose'],
      ['closing'],
    ])
  })

  it('demotes a target that was used in the two most recent rounds', () => {
    const targets = selectMissionTargets({
      assessments: [
        assessment('purpose-and-subject', 'purpose', 'unmet'),
        assessment('structure', 'closing', 'unmet'),
        assessment('structure', 'body', 'unmet'),
      ],
      rubrics: INTERVIEW_REPORT_RUBRICS,
      priorRounds: [
        { missions: [{ criterionIds: ['purpose'] }] },
        { missions: [{ criterionIds: ['purpose'] }] },
      ],
    })

    expect(targets).toHaveLength(2)
    expect(targets[0].criterionIds).toEqual(['closing'])
    expect(targets[1].criterionIds).toEqual(['body'])
  })

  it('returns no targets when every criterion is met', () => {
    const assessments = INTERVIEW_REPORT_RUBRICS.flatMap((rubric) =>
      rubric.criteria.map((criterion) => assessment(rubric.id, criterion.id, 'met')),
    )

    expect(selectMissionTargets({
      assessments,
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })).toEqual([])
  })

  it('rejects unknown criterion IDs and statuses', () => {
    expect(() => selectMissionTargets({
      assessments: [assessment('information', 'made-up', 'unmet')],
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })).toThrow('알 수 없는 채점기준')

    expect(() => selectMissionTargets({
      assessments: [assessment('information', 'new-fact', 'almost')],
      rubrics: INTERVIEW_REPORT_RUBRICS,
    })).toThrow('알 수 없는 판정 상태')
  })
})
