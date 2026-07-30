const VALID_STATUSES = new Set(['met', 'partial', 'unmet'])

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

  const contradictions =
    actualMap.get('new-fact') === 'unmet' && actualMap.get('fact-detail') === 'met' ? 1 : 0

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
  if (!/(자세히|구체적으로|내용\s*보충|더\s*잘\s*다듬)/.test(text)) return false
  const remainder = (mission.instruction ?? '')
    .replace(/자세히|구체적으로|내용을?|보충|더|잘|다듬|써\s*보세요|쓰기|해\s*보세요|하세요|[.\s]/g, '')
  return remainder.length < 8
}

export function scoreMissionCase(fixture, result) {
  const violations = new Set()
  const missions = result?.missions ?? []
  const allowed = fixture.allowedMissionCriterionSets ?? []
  const actualSetKey = missionSetKey(missions)

  if (!allowed.some((allowedSet) => missionSetKey(allowedSet) === actualSetKey)) {
    violations.add('허용되지 않은 수정 대상 조합')
  }

  const seen = new Set()
  for (const mission of missions) {
    const key = missionKey(mission.criterionIds)
    if (seen.has(key)) violations.add('중복 수정미션')
    seen.add(key)

    if (typeof mission.title !== 'string' || !mission.title.trim().endsWith('기')) {
      violations.add('제목이 행동 명사형으로 끝나지 않음')
    }
    if (vagueOnly(mission)) {
      violations.add('행동 방법이 없는 모호한 미션')
    }
    if (/예를\s*들어|예시\s*문장|와\s*같이\s*써/.test(mission.instruction ?? '')) {
      violations.add('학생이 베낄 예시 문장')
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

export function parseEvalArgs(args) {
  const options = { set: 'dev', runs: 1 }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--set') {
      options.set = args[index + 1]
      index += 1
    } else if (args[index] === '--runs') {
      options.runs = Number(args[index + 1])
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

  return failures
}
