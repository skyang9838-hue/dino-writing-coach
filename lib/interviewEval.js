import { INTERVIEW_REPORT_UNIT_ID, getAiRubrics } from './curriculum.js'
import { buildInterviewRoundState } from './interviewRound.js'
import { selectMissionTargets } from './missions.js'

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

function missionKey(criterionIds) {
  return [...(criterionIds ?? [])].sort().join('|')
}

function missionSetKey(missions) {
  return missions.map((mission) =>
    Array.isArray(mission) ? missionKey(mission) : missionKey(mission.criterionIds),
  ).sort().join('::')
}

function vagueOnly(mission) {
  const text = `${mission.title ?? ''} ${mission.instruction ?? ''}`
  return /(자세히\s*(?:써|쓰)|구체적으로\s*(?:써|쓰)|내용\s*(?:을\s*)?보충|더\s*잘\s*다듬)/u
    .test(text)
}

const ACTION_TITLE_PATTERN =
  /(하기|추가하기|덧붙이기|밝히기|드러내기|소개하기|설명하기|알아보기|떠올리기|써\s*넣기|이어쓰기|쓰기|옮기기|모으기|나누기|연결하기|질문하기|확인하기|고르기|바꾸기|정리하기|배치하기|표시하기|준비하기|마무리하기|완성하기|다듬기|적기|넣기|빼기|고치기)$/u
const ACTION_INSTRUCTION_PATTERN =
  /(추가|덧붙|밝혀|밝히|드러내|소개|설명|알아보|떠올|써|쓰세요|이어\s*쓰|옮겨|옮기|모아|모으|나눠|나누|연결|질문|물어|확인|골라|고르|바꿔|바꾸|정리|배치|표시|준비|마무리|적어|적으|넣어|넣으|빼|고쳐|고치)/u

function hasUngroundedQuotedContent(instruction, writing) {
  const quotedParts = [...(instruction ?? '').matchAll(/['"‘“]([^'"’”]{4,})['"’”]/gu)]
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
  const normalizedWriting = (writing ?? '').replace(/\s+/g, ' ')
  return quotedParts.some((part) => !normalizedWriting.includes(part))
}

export function scoreMissionCase(fixture, result) {
  const violations = new Set()
  const missions = result?.missions ?? []
  const selectedTargets = result?.assessments?.length === CRITERION_COUNT
    ? selectMissionTargets({
        assessments: result.assessments,
        rubrics: INTERVIEW_RUBRICS,
        priorRounds: fixture.priorRounds ?? [],
      })
    : null
  const allowed = selectedTargets
    ? [selectedTargets.map((target) => target.criterionIds)]
    : fixture.allowedMissionCriterionSets ?? []
  const actualSetKey = missionSetKey(missions)

  if (missions.length !== 2) {
    violations.add('수정미션 개수가 2개가 아님')
  }
  if (Object.hasOwn(result ?? {}, 'complete')) {
    violations.add('종료 상태가 생성됨')
  }
  if (!allowed.some((allowedSet) => missionSetKey(allowedSet) === actualSetKey)) {
    violations.add('허용되지 않은 수정 대상 조합')
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

  const seen = new Set()
  for (const mission of missions) {
    const key = missionKey(mission.criterionIds)
    if (seen.has(key)) violations.add('중복 수정미션')
    seen.add(key)

    if (typeof mission.title !== 'string' || !ACTION_TITLE_PATTERN.test(mission.title.trim())) {
      violations.add('제목이 행동 명사형으로 끝나지 않음')
    }
    if (!ACTION_INSTRUCTION_PATTERN.test(mission.instruction ?? '')) {
      violations.add('실행 동작이 없는 미션')
    }
    if (vagueOnly(mission)) {
      violations.add('행동 방법이 없는 모호한 미션')
    }
    if (/예를\s*들어|예시\s*문장|와\s*같이\s*써/.test(mission.instruction ?? '')) {
      violations.add('학생이 베낄 예시 문장')
    }
    if (/(듣지\s*못했다면|모른다면)[\s\S]*(생각|상상|추측)[\s\S]*(덧붙|써|쓰)/u
      .test(mission.instruction ?? '')) {
      violations.add('면담 사실을 지어내도록 요구함')
    }
    if (hasUngroundedQuotedContent(mission.instruction, fixture.writing)) {
      violations.add('학생 글에 없는 인용 내용')
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
    twoMissionRate: meaningfulResults.length
      ? meaningfulResults.filter((result) => result.missionCount === 2).length / meaningfulResults.length
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
  if (metrics.twoMissionRate < 1) failures.push('수정미션 2개 생성률')
  if (metrics.terminalStates > 0) failures.push('종료 상태')

  return failures
}
