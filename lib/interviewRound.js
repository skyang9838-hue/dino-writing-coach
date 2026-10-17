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

// `selectedMissionIds`: 지난 회차 미션 가운데 학생이 고른 것. 고른 것만
// 판정되므로 priorMissions에도 그것만 있다.
export function buildInterviewRoundState({ submission, writing, result, selectedMissionIds = [] }) {
  const actualAttainment = computeRubricAttainment(result.assessments)
  const strength = result.strength?.text ?? ''
  const priorMissionStatuses = result.priorMissions ?? []
  // 첫 회차만 null(도달도 40에서 시작). 지난 회차 미션이 0개였어도(모두
  // 충족) 도달도가 40으로 돌아가면 안 되므로 그때는 빈 배열이다.
  const isFirstRound = !submission.rounds?.some((round) => !round.flagged)
  const addressed = isFirstRound && !priorMissionStatuses.length
    ? null
    : priorMissionStatuses.map((mission) => mission.status === 'done')
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
    // 하락 확인(lib/regressionCheck.js) 전에 모델이 실제로 내린 판정과 확인
    // 결과. 화면에는 안 나오지만 무엇을 지켰는지 되짚을 근거다.
    rawAssessments: result.rawAssessments,
    regressionChecks: result.regressionChecks ?? [],
    selectedMissionIds,
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
