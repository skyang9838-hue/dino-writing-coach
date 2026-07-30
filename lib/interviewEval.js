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

    if (typeof mission.title !== 'string' || !mission.title.trim().endsWith('하기')) {
      violations.add('제목이 ~하기로 끝나지 않음')
    }
    if (vagueOnly(mission)) {
      violations.add('행동 방법이 없는 모호한 미션')
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
