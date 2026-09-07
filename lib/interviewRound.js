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
    priorMissionStatuses,
  }
  const round = {
    writing,
    strength,
    missions: result.missions,
    assessments: result.assessments,
    // 잠금(lib/assessmentRatchet.js)이 걸리기 전에 모델이 실제로 내린 판정.
    // 화면에는 안 나오지만, 잠금이 무엇을 덮었는지 되짚으려면 이것뿐이다.
    rawAssessments: result.rawAssessments,
    priorMissionStatuses,
    actualAttainment,
    attainmentAfter: attainment,
  }

  return {
    actualAttainment,
    attainment,
    feedback,
    rounds: [...submission.rounds, round],
    lastImprovements: result.missions,
  }
}
