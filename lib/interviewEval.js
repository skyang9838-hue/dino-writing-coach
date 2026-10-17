import { MISSION_COUNT } from './coaching.js'
import { INTERVIEW_REPORT_UNIT_ID, getAiRubrics } from './curriculum.js'
import { buildInterviewRoundState } from './interviewRound.js'

const VALID_STATUSES = new Set(['met', 'partial', 'unmet'])

const INTERVIEW_RUBRICS = getAiRubrics(INTERVIEW_REPORT_UNIT_ID)
// Derived rather than hardcoded: this used to be a literal 7 and silently
// stopped matching when the criteria were regrouped into four.
const CRITERION_COUNT = INTERVIEW_RUBRICS.reduce(
  (total, rubric) => total + rubric.criteria.length,
  0,
)

function criterionMap(criteria) {
  return new Map((criteria ?? []).map((criterion) => [criterion.criterionId, criterion.status]))
}

export function scoreAssessmentCase(expected, actual) {
  const expectedMap = criterionMap(expected.criteria)
  const actualMap = criterionMap(actual?.criteria)
  const actualIds = actual?.criteria?.map((criterion) => criterion.criterionId) ?? []
  const schemaValid =
    typeof actual?.meaningless === 'boolean'
    && actualIds.length === expectedMap.size
    && new Set(actualIds).size === actualIds.length
    && actualIds.every((id) => expectedMap.has(id))
    && (actual.criteria ?? []).every((criterion) => VALID_STATUSES.has(criterion.status))

  let matches = 0
  let hallucinatedMet = 0
  for (const [criterionId, expectedStatus] of expectedMap) {
    const actualStatus = actualMap.get(criterionId)
    if (actualStatus === expectedStatus) matches += 1
    if (expectedStatus === 'unmet' && actualStatus === 'met') hallucinatedMet += 1
  }

  // Always 0 since the criteria were regrouped into four independent ones —
  // there is no pair left where one status makes another impossible. The
  // metric stays wired up (the eval report and its gate still read it) so it
  // can be filled in again if a future unit's criteria do depend on each other.
  const contradictions = 0

  return {
    matches,
    total: expectedMap.size,
    meaninglessMatch: actual?.meaningless === expected.meaningless,
    hallucinatedMet,
    contradictions,
    schemaValid,
  }
}

const KNOWN_CRITERION_IDS = new Set(INTERVIEW_RUBRICS.flatMap((rubric) => rubric.criteria.map((criterion) => criterion.id)))

// 파이프라인(lib/coaching.js validateMissionResult)의 'B' 검사와 같은 것만 센다.
// 미션이 고르는 기준은 AI 몫이라 조합은 보지 않고, 알려진 기준인지만 본다.
export function scoreMissionCase(fixture, result) {
  const violations = new Set()
  const missions = result?.missions ?? []
  const allMet = (result?.assessments ?? []).length > 0
    && result.assessments.every((assessment) => assessment.status === 'met')

  if (allMet ? missions.length > MISSION_COUNT : missions.length !== MISSION_COUNT) {
    violations.add(`수정미션 개수가 ${MISSION_COUNT}개가 아님`)
  }
  if (Object.hasOwn(result ?? {}, 'complete')) {
    violations.add('종료 상태가 생성됨')
  }
  if (fixture.expectedPriorMissionStatuses) {
    const expectedPrior = fixture.expectedPriorMissionStatuses
      .map(({ missionId, status }) => `${missionId}:${status}`)
      .sort()
    const actualPrior = (result?.priorMissions ?? [])
      .map(({ missionId, status }) => `${missionId}:${status}`)
      .sort()
    if (
      expectedPrior.length !== actualPrior.length
      || expectedPrior.some((entry, index) => entry !== actualPrior[index])
    ) {
      violations.add('지난 수정미션 판정 불일치')
    }
  }

  const seenIds = new Set()
  for (const mission of missions) {
    if (seenIds.has(mission.id)) violations.add('중복 수정미션 ID')
    seenIds.add(mission.id)

    if (!(mission.criterionIds ?? []).length || !mission.criterionIds.every((id) => KNOWN_CRITERION_IDS.has(id))) {
      violations.add('알 수 없는 채점기준')
    }
    if (/(자세히\s*(?:써|쓰)|구체적으로\s*(?:써|쓰)|내용\s*(?:을\s*)?보충|더\s*잘\s*다듬)/u
      .test(`${mission.title ?? ''} ${mission.instruction ?? ''}`)) {
      violations.add('행동 방법이 없는 모호한 미션')
    }
    if (/예를\s*들어|예시\s*문장|와\s*같이\s*써/.test(mission.instruction ?? '')) {
      violations.add('학생이 베낄 예시 문장')
    }
    if (/(듣지\s*못했다면|모른다면)[\s\S]*(생각|상상|추측)[\s\S]*(덧붙|써|쓰)/u
      .test(mission.instruction ?? '')) {
      violations.add('면담 사실을 지어내도록 요구함')
    }
    if (typeof mission.title !== 'string' || !mission.title.trim()) {
      violations.add('수정미션 제목 누락')
    }
    if (typeof mission.instruction !== 'string' || !mission.instruction.trim()) {
      violations.add('수정미션 설명 누락')
    }
    if (typeof mission.criterion !== 'string' || !mission.criterion.trim()) {
      violations.add('다음 라운드 확인 기준 누락')
    }
  }

  return [...violations]
}

export function scoreProgressionCase(fixture, result) {
  if (fixture.expected.meaningless || result.meaningless) return null

  const { attainment: actualAttainment } = buildInterviewRoundState({
    submission: {
      attainment: fixture.currentAttainment ?? null,
      rounds: fixture.priorRounds ?? [],
    },
    writing: fixture.writing,
    result,
  })
  const doneMissions = (result.priorMissions ?? [])
    .filter((mission) => mission.status === 'done').length
  const expectedAttainment = fixture.currentAttainment == null
    ? 40
    : fixture.currentAttainment + doneMissions * 10
  const failures = actualAttainment === expectedAttainment
    ? []
    : ['누적 달성도 불일치']

  return { actualAttainment, expectedAttainment, failures }
}

export function parseEvalArgs(args) {
  const options = { set: 'dev', runs: 1 }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--set') {
      options.set = args[index + 1]
      index += 1
    } else if (args[index] === '--runs') {
      options.runs = Number(args[index + 1])
      index += 1
    } else if (args[index] === '--case') {
      options.caseId = args[index + 1]
      index += 1
    } else {
      throw new Error(`알 수 없는 평가 옵션: ${args[index]}`)
    }
  }

  if (!['dev', 'validation'].includes(options.set)) {
    throw new Error('평가셋은 dev 또는 validation이어야 함')
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error('실행 횟수는 1 이상의 정수여야 함')
  }
  return options
}

export function aggregateEvalResults(results) {
  const assessmentTotal = results.reduce((sum, result) => sum + result.assessment.total, 0)
  const matches = results.reduce((sum, result) => sum + result.assessment.matches, 0)
  const caseSignatures = new Map()

  for (const result of results) {
    const signatures = caseSignatures.get(result.caseId) ?? []
    signatures.push(result.signature)
    caseSignatures.set(result.caseId, signatures)
  }

  const stableCases = [...caseSignatures.values()].filter((signatures) =>
    new Set(signatures).size === 1,
  ).length
  const meaningfulResults = results.filter((result) => result.meaningful)

  return {
    agreement: assessmentTotal ? matches / assessmentTotal : 0,
    schemaRate: results.length
      ? results.filter((result) => result.assessment.schemaValid).length / results.length
      : 0,
    stability: caseSignatures.size ? stableCases / caseSignatures.size : 0,
    meaninglessRate: results.length
      ? results.filter((result) => result.assessment.meaninglessMatch).length / results.length
      : 0,
    hallucinatedMet: results.reduce((sum, result) => sum + result.assessment.hallucinatedMet, 0),
    contradictions: results.reduce((sum, result) => sum + result.assessment.contradictions, 0),
    missionViolations: results.reduce((sum, result) => sum + result.missionViolations.length, 0),
    progressionFailures: results.reduce(
      (sum, result) => sum + (result.progressionFailures?.length ?? 0),
      0,
    ),
    threeMissionRate: meaningfulResults.length
      ? meaningfulResults.filter((result) => result.missionCount === MISSION_COUNT).length / meaningfulResults.length
      : 1,
    terminalStates: results.filter((result) => result.terminalState).length,
  }
}

export function evaluateThresholds(metrics, { set, runs }) {
  const failures = []
  const agreementThreshold = set === 'validation' ? 0.85 : 0.9

  if (metrics.agreement < agreementThreshold) failures.push('판정 일치율')
  if (metrics.schemaRate < 1) failures.push('JSON 스키마 성공률')
  if (runs >= 3 && metrics.stability < 0.95) failures.push('3회 판정 안정성')
  if (metrics.meaninglessRate < 1) failures.push('무의미 글 판별')
  if (metrics.hallucinatedMet > 0) failures.push('글에 없는 충족 추측')
  if (metrics.contradictions > 0) failures.push('논리 모순')
  if (metrics.missionViolations > 0) failures.push('수정미션 위반')
  if (metrics.progressionFailures > 0) failures.push('누적 달성도')
  if (metrics.threeMissionRate < 1) failures.push('수정미션 3개 생성률')
  if (metrics.terminalStates > 0) failures.push('종료 상태')

  return failures
}
