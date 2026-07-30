import { diffWords } from 'diff'
import {
  computeNextAttainment,
  computeRubricAttainment,
} from './attainment.js'

export function summarizeWritingChanges(previousWriting, writing) {
  if (!previousWriting) return { added: '', removed: '' }

  const changes = diffWords(previousWriting, writing)
  return {
    added: changes.filter((part) => part.added).map((part) => part.value).join(''),
    removed: changes.filter((part) => part.removed).map((part) => part.value).join(''),
  }
}

export function buildInterviewRoundState({ submission, writing, result }) {
  const actualAttainment = computeRubricAttainment(result.assessments)
  const strength = result.strength?.text ?? ''
  const priorMissionStatuses = result.priorMissions ?? []
  const addressed = priorMissionStatuses.length
    ? priorMissionStatuses.map((mission) => mission.status === 'done')
    : null
  const attainment = computeNextAttainment(submission.attainment, addressed)
  const feedback = {
    strength,
    missions: result.missions,
    assessments: result.assessments,
    complete: result.complete,
    priorMissionStatuses,
  }
  const round = {
    writing,
    strength,
    missions: result.missions,
    assessments: result.assessments,
    priorMissionStatuses,
    actualAttainment,
    attainmentAfter: attainment,
    complete: result.complete,
  }

  return {
    actualAttainment,
    attainment,
    feedback,
    rounds: [...submission.rounds, round],
    lastImprovements: result.missions,
  }
}
