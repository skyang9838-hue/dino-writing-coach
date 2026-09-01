import {
  getAiRubrics,
  getGenreGuidance,
  getUnitById,
} from './curriculum.js'
import { selectMissionTargets } from './missions.js'

const MODEL_ID = 'gemini-2.5-flash-lite'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`

// 한국어 조사. The prompts name the kind of writing being judged, and that
// name comes from the unit, so the particle after it has to be chosen rather
// than hardcoded: '기사문을' but '면담 보고서를'.
function endsWithConsonant(word) {
  const last = word?.trim().at(-1)
  if (!last) return false
  const code = last.codePointAt(0)
  if (code < 0xac00 || code > 0xd7a3) return false
  return (code - 0xac00) % 28 !== 0
}

const objectParticle = (word) => (endsWithConsonant(word) ? '을' : '를')
const conditionalCopula = (word) => (endsWithConsonant(word) ? '이라면' : '라면')

export const FIRST_ROUND_SCHEMA = {
  type: 'object',
  properties: {
    meaningless: { type: 'boolean' },
    strength: { type: 'string' },
    improvements: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['meaningless', 'strength', 'improvements'],
}

export const REVISION_SCHEMA = {
  type: 'object',
  properties: {
    meaningless: { type: 'boolean' },
    addressed: {
      type: 'array',
      items: { type: 'boolean' },
      minItems: 2,
      maxItems: 2,
    },
    strength: { type: 'string' },
    improvements: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['meaningless', 'addressed', 'strength', 'improvements'],
}

// The assessment and mission schemas are built from the unit's own rubrics
// rather than written out, so a unit's criteria list is the single place that
// decides what the model is allowed to return. These used to be two literals
// pinned to the interview report's four criteria.
//
// Only criteria getAiRubrics hands over appear here. `evaluator: 'teacher'`
// ones never reach the enums, so the model has no way to name them.

const PRIOR_MISSION_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      missionId: { type: 'string' },
      status: { type: 'string', enum: ['done', 'partial', 'not-done'] },
    },
    required: ['missionId', 'status'],
  },
  maxItems: 2,
}

const rubricIdsOf = (rubrics) => rubrics.map((rubric) => rubric.id)
const criterionIdsOf = (rubrics) =>
  rubrics.flatMap((rubric) => rubric.criteria.map((criterion) => criterion.id))

export function buildAssessmentSchema(rubrics) {
  const criterionIds = criterionIdsOf(rubrics)
  return {
    type: 'object',
    properties: {
      meaningless: { type: 'boolean' },
      criteria: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            rubricId: { type: 'string', enum: rubricIdsOf(rubrics) },
            criterionId: { type: 'string', enum: criterionIds },
            status: { type: 'string', enum: ['met', 'partial', 'unmet'] },
          },
          required: ['rubricId', 'criterionId', 'status'],
        },
        minItems: criterionIds.length,
        maxItems: criterionIds.length,
      },
      priorMissions: PRIOR_MISSION_SCHEMA,
    },
    required: ['meaningless', 'criteria', 'priorMissions'],
  }
}

export function buildMissionSchema(rubrics) {
  return {
    type: 'object',
    properties: {
      strength: {
        type: 'object',
        properties: {
          // 'effort' is the escape hatch for a round where nothing is met yet:
          // the praise has to point somewhere, and pointing at a criterion the
          // writing does not satisfy would be a lie.
          rubricId: { type: 'string', enum: [...rubricIdsOf(rubrics), 'effort'] },
          criterionId: { type: 'string', enum: [...criterionIdsOf(rubrics), 'effort'] },
          text: { type: 'string' },
        },
        required: ['rubricId', 'criterionId', 'text'],
      },
      missions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            // Gemini rejects `enum` on non-string fields with HTTP 400, so the
            // 1-or-2 constraint is enforced in sanitizeMissionResult instead.
            targetIndex: { type: 'integer' },
            title: { type: 'string' },
            instruction: { type: 'string' },
            criterion: { type: 'string' },
          },
          required: ['id', 'targetIndex', 'title', 'instruction', 'criterion'],
        },
        minItems: 2,
        maxItems: 2,
      },
    },
    required: ['strength', 'missions'],
  }
}

// Everything the two-stage pipeline needs to coach one unit: its rubrics, the
// schemas derived from them, the wording that is specific to this kind of
// writing, and the per-criterion fallback mission titles. Assembling it in one
// place is what lets getRubricCoachingFeedback stay unit-agnostic.
export function buildCoachingSpec({
  unitId = null,
  subject,
  rubrics,
  assessmentGuidance = [],
  missionGuidance = {},
}) {
  const criteria = rubrics.flatMap((rubric) => rubric.criteria)
  return {
    unitId,
    subject,
    rubrics,
    assessmentGuidance,
    missionGuidance,
    criterionCount: criteria.length,
    assessmentSchema: buildAssessmentSchema(rubrics),
    missionSchema: buildMissionSchema(rubrics),
    fallbackMissionTitles: Object.fromEntries(
      criteria
        .filter((criterion) => criterion.fallbackMissionTitle)
        .map((criterion) => [criterion.id, criterion.fallbackMissionTitle]),
    ),
  }
}

// Cached because a spec is the same for the life of the process — the
// curriculum is a code constant — and every coaching request asks for one.
const SPEC_CACHE = new Map()

// null for a unit with no AI-judged criteria (1단원, or any unit whose
// criteria have not been written yet). Callers read that as "this unit does
// not get rubric coaching" and fall back to the generic coach.
export function getUnitCoachingSpec(unitId) {
  if (SPEC_CACHE.has(unitId)) return SPEC_CACHE.get(unitId)

  const unit = getUnitById(unitId)
  const rubrics = unit ? getAiRubrics(unitId) : null
  const spec = rubrics
    ? buildCoachingSpec({
      unitId,
      subject: unit.coachingSubject ?? unit.genre,
      rubrics,
      assessmentGuidance: unit.assessmentGuidance ?? [],
      missionGuidance: unit.missionGuidance ?? {},
    })
    : null

  SPEC_CACHE.set(unitId, spec)
  return spec
}

// Prompt instruction shared by both rounds: asks the model to double-check
// for content the rule-based lib/guard.js may have missed (e.g. spacing
// tricks that dodge its ratio thresholds). Placed first so the model judges
// meaningfulness before it commits to any actual coaching content.
const MEANINGLESS_CHECK_INSTRUCTION = `먼저 이 글이 자음/모음만 반복하거나 스페이스로 글자 수만 채우는 등 실제로 의미가 통하지 않는 글인지 판단해서 meaningless에 true 또는 false로 알려줘. meaningless가 true면 나머지 항목은 대충 채워도 괜찮아(사용하지 않음).`

export function buildFirstRoundPrompt(topic, writing, genre) {
  const genreNote = getGenreGuidance(genre)
  const topicPhrase = topic ? `"${topic}" 주제로` : '자유 주제로'
  return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
아래는 아이가 ${topicPhrase} 쓴 글이야.

---
${writing}
---

${MEANINGLESS_CHECK_INSTRUCTION}
그렇지 않다면, 이 글에서 잘한 점 1가지와 보완하면 좋을 점 2가지를 한국어로 알려줘.
보완할 점은 아이가 실제로 고칠 수 있는 구체적인 내용으로 써줘.${genreNote ? `\n이 글은 '${genre}' 종류의 글이야. ${genreNote}` : ''}`
}

export function buildRevisionPrompt(topic, previousWriting, previousImprovements, writing, genre) {
  const genreNote = getGenreGuidance(genre)
  const topicPhrase = topic ? `"${topic}" 주제로` : '자유 주제로'
  return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
아이가 ${topicPhrase} 쓴 글을 고쳐썼어.

[고치기 전 글]
${previousWriting}

[지난번에 알려준 보완할 점 2가지]
1. ${previousImprovements[0]}
2. ${previousImprovements[1]}

[고친 후 글]
${writing}

${MEANINGLESS_CHECK_INSTRUCTION}
그렇지 않다면, 먼저 지난번 보완할 점 1번과 2번을 각각 이번 글에서 고쳤는지 판단해줘(고쳤으면 true, 안 고쳤으면 false).
그다음 고친 후 글을 기준으로 새로운 잘한 점 1가지와 보완하면 좋을 점 2가지를 한국어로 알려줘.${genreNote ? `\n이 글은 '${genre}' 종류의 글이야. ${genreNote}` : ''}`
}

function formatRubrics(rubrics) {
  return rubrics.map((rubric) => {
    const criteria = rubric.criteria.map((criterion) => `- criterionId=${criterion.id}
  채점기준: ${criterion.label}
   - met(충족): ${criterion.statuses.met}
   - partial(부분): ${criterion.statuses.partial}
   - unmet(미충족): ${criterion.statuses.unmet}`).join('\n')
    // A unit whose criteria are not chunked (6단원) has one nameless rubric —
    // there is no group heading to print, only the criteria.
    const heading = rubric.label ? `${rubric.label}\n` : ''
    return `[rubricId=${rubric.id}]
${heading}${criteria}`
  }).join('\n\n')
}

function formatPriorMissionBlock(previousMissions, changes) {
  if (!previousMissions?.length) return ''
  const missions = previousMissions.map((mission, index) => `${index + 1}. missionId: ${mission.id}
   제목: ${mission.title}
   설명: ${mission.instruction}
   확인 기준: ${mission.criterion}`).join('\n')

  return `

[지난 수정미션]
${missions}

[이번 수정에서 새로 추가한 부분]
${changes?.added || '(추가된 부분 없음)'}

[이번 수정에서 지운 부분]
${changes?.removed || '(지운 부분 없음)'}

각 지난 수정미션의 수행 상태도 판정해.
- done: 확인 기준을 분명히 만족하는 변화가 있다.
- partial: 그 방향으로 고친 흔적은 있지만 확인 기준을 아직 만족하지 못한다.
- not-done: 관련된 변화가 없다.
- 확인 기준에서 요구한 내용이 새로 추가되었으면 짧아도 done이야. 이미 있던 내용만 조금 바꿨거나 요구한 내용의 일부만 추가했을 때 partial이야.
글 전체가 아니라 고치기 전후의 변화와 확인 기준을 함께 근거로 삼아.`
}

const bullets = (lines) => lines.map((line) => `- ${line}`).join('\n')

// The principles every unit's assessment shares, split around the one line
// that names how many criteria there are. A unit's own extra principles
// (spec.assessmentGuidance) go on the end.
const ASSESSMENT_PRINCIPLES_HEAD = [
  '맞춤법이나 문장이 미숙해도 내용을 식별할 수 있으면 그 이유로 낮게 판정하지 마.',
  '학생 생각의 수준이나 사실의 옳고 그름을 판단하지 마.',
  '글에 직접 드러난 내용만 근거로 삼고 없는 내용을 추측하지 마.',
]
const ASSESSMENT_PRINCIPLES_TAIL = [
  '변화 부분만 보고 기존 내용을 미충족으로 판정하지 마. 현재 글에 남아 있는 기존 내용도 반드시 포함해 확인해.',
  '내용이 글의 어느 위치에 있는지는 따지지 마. 필요한 내용이 글 어디에든 드러나면 인정해.',
]

function assessmentPrinciples(spec) {
  return [
    ...ASSESSMENT_PRINCIPLES_HEAD,
    `채점기준 ${spec.criterionCount}개는 현재 학생 글 전체를 기준으로 판정해. 고치기 전후의 변화는 지난 수정미션 수행 상태를 판정할 때만 사용해.`,
    ...ASSESSMENT_PRINCIPLES_TAIL,
    ...spec.assessmentGuidance,
  ]
}

const collectCriterionNotes = (rubrics, field) =>
  rubrics.flatMap((rubric) => rubric.criteria.flatMap((criterion) => criterion[field] ?? []))

export function buildAssessmentPrompt({
  spec,
  topic,
  writing,
  previousWriting,
  previousMissions = [],
  changes,
}) {
  const topicText = topic ? `활동 주제: ${topic}` : '활동 주제: 학생이 자유롭게 정함'
  const previousBlock = previousWriting ? `

[고치기 전 글]
---
${previousWriting}
---` : ''

  // Rules that only make sense for one criterion live on that criterion, so a
  // unit adding a criterion brings its judging rules with it. A unit whose
  // criteria carry none skips the block entirely.
  const criterionNotes = collectCriterionNotes(spec.rubrics, 'assessmentNotes')
  const criterionNoteBlock = criterionNotes.length ? `
[채점기준별 판정 원칙]
${bullets(criterionNotes)}
` : ''

  return `너는 초등학교 6학년 ${spec.subject}${objectParticle(spec.subject)} 정해진 루브릭으로 확인하는 판정자야.
글을 평가하거나 점수나 등급을 매기지 마. 각 채점기준에 해당하는 내용이 학생 글에 실제로 드러나는지만 확인해.

[공통 판정 원칙]
${bullets(assessmentPrinciples(spec))}
${criterionNoteBlock}
[루브릭과 채점기준]
JSON의 rubricId와 criterionId에는 아래에 적힌 영문 ID를 그대로 복사해.
숫자 번호나 한국어 이름을 ID로 만들지 마.
${formatRubrics(spec.rubrics)}

${topicText}${previousBlock}

[현재 학생 글]
---
${writing}
---
${formatPriorMissionBlock(previousMissions, changes)}

[무의미 글 확인]
자음이나 모음만 반복하거나, 스페이스와 같은 무관한 문자로 분량만 채우거나, 문장들이 서로 연결되지 않아 실제 의미를 파악할 수 없는 글이면 meaningless를 true로 판정해.
의미 있는 ${spec.subject}${conditionalCopula(spec.subject)} meaningless를 false로 판정하고, 루브릭 순서대로 모든 채점기준을 met, partial, unmet 중 하나로 판정해.
지난 수정미션이 없으면 priorMissions는 빈 배열로 반환해.`
}

function findCriterion(rubrics, criterionId) {
  for (const rubric of rubrics) {
    const criterion = rubric.criteria.find((item) => item.id === criterionId)
    if (criterion) return { rubric, criterion }
  }
  return null
}

// There used to be a normalizeInterviewAssessment here that downgraded an
// impossible `opening: met`. The interview report's four criteria are
// independent of one another — none of them can contradict another — so there
// is nothing left to correct. No unit added since has dependent criteria
// either; if one ever does, its normalization belongs on the spec.

export function validateAssessment(
  result,
  rubrics,
  expectedPreviousMissions = [],
) {
  if (!result || typeof result.meaningless !== 'boolean' || !Array.isArray(result.criteria)) {
    throw new Error('면담 보고서 판정 형식이 올바르지 않음')
  }

  const expectedCount = rubrics.reduce((total, rubric) => total + rubric.criteria.length, 0)
  if (result.criteria.length !== expectedCount) {
    throw new Error('모든 채점기준의 판정이 필요함')
  }

  const seen = new Set()
  for (const assessment of result.criteria) {
    const found = findCriterion(rubrics, assessment.criterionId)
    if (!found || found.rubric.id !== assessment.rubricId) {
      throw new Error(`알 수 없는 채점기준: ${assessment.criterionId}`)
    }
    if (seen.has(assessment.criterionId)) {
      throw new Error(`중복된 채점기준: ${assessment.criterionId}`)
    }
    if (!['met', 'partial', 'unmet'].includes(assessment.status)) {
      throw new Error(`알 수 없는 판정 상태: ${assessment.status}`)
    }
    seen.add(assessment.criterionId)
  }

  // No cross-criterion contradiction checks: the four criteria each judge a
  // different part of the interview procedure and none of them implies
  // another, so no combination of statuses is impossible.

  if (!Array.isArray(result.priorMissions)) {
    throw new Error('지난 수정미션 판정 형식이 올바르지 않음')
  }
  for (const mission of result.priorMissions) {
    if (!mission?.missionId || !['done', 'partial', 'not-done'].includes(mission.status)) {
      throw new Error('지난 수정미션 판정 상태가 올바르지 않음')
    }
  }
  const expectedMissionIds = expectedPreviousMissions.map((mission) => mission?.id).filter(Boolean).sort()
  const actualMissionIds = result.priorMissions.map((mission) => mission.missionId).sort()
  if (
    new Set(actualMissionIds).size !== actualMissionIds.length
    || expectedMissionIds.length !== actualMissionIds.length
    || expectedMissionIds.some((id, index) => id !== actualMissionIds[index])
  ) {
    throw new Error('지난 수정미션 ID가 입력과 정확히 일치해야 함')
  }

  return result
}

function criterionLabel(rubrics, criterionId) {
  return findCriterion(rubrics, criterionId)?.criterion.label ?? criterionId
}

// The mission rules in the order the model reads them. Two of them are the
// unit's to write — where one unit says "don't invent 면담 내용" another says
// "don't invent 취재 내용" — so they sit in named slots rather than being
// appended, and the surrounding rules stay put whichever unit is coaching.
function missionRules(spec) {
  const { grounding, selfFill } = spec.missionGuidance ?? {}
  return [
    '의미 있는 글에는 루브릭 충족 여부와 관계없이 수정미션을 항상 정확히 2개 만들어.',
    '선택된 수정 대상 하나마다 미션 하나만 만들어. 선택되지 않은 채점기준의 미션을 추가하지 마.',
    'Return exactly two mission items. Each item MUST include targetIndex: use 1 only for server-selected target #1 above and 2 only for target #2. Use each targetIndex exactly once. Do not return rubricIds or criterionIds; the server attaches those IDs after validation. Array order may be either order because targetIndex determines the mapping.',
    "title은 반드시 행동을 나타내는 짧은 명사형 '-기'로 끝내. 예: '까닭 추가하기', '느낀 점 덧붙이기'.",
    'instruction에는 학생 글에서 어디를, 무엇으로, 어떻게 고칠지 드러내.',
    grounding,
    '완성 문장이나 모범답안을 대신 쓰지 마. 학생이 그대로 베낄 답을 주지 마.',
    "'예를 들어' 뒤에 학생이 베낄 문장을 제시하지 마. 글에 없는 이유나 상황을 선택지로 만들어 주지도 마.",
    selfFill,
    "'자세히 쓰기', '자세히 써 보세요', '구체적으로 쓰기', '내용 보충하기', '더 잘 다듬기'라는 막연한 표현은 사용하지 마. 글의 위치나 주제를 함께 언급해도 이 표현 자체를 쓰면 안 돼.",
    ...collectCriterionNotes(spec.rubrics, 'missionNotes'),
    '서로 같은 행동을 요구하는 미션을 반복하지 마.',
    'criterion에는 다음 라운드에서 실제 변화로 확인할 수 있는 한 문장의 기준을 써.',
    '점수, 등급, 상·중·하 표현을 사용하지 마.',
  ].filter(Boolean)
}

export function buildMissionPrompt({
  spec,
  writing,
  assessments,
  selectedTargets,
  priorMissionStatuses = [],
}) {
  const rubrics = spec.rubrics
  const metCriteria = assessments
    .filter((assessment) => assessment.status === 'met')
    .map((assessment) => `- ${assessment.rubricId}/${assessment.criterionId}: ${criterionLabel(rubrics, assessment.criterionId)}`)
    .join('\n') || '- 충족으로 판정된 채점기준 없음'

  const targetText = selectedTargets.map((target, index) => `${index + 1}. 루브릭: ${target.rubricIds.join(', ')}
   채점기준: ${target.criterionIds.join(', ')}
   사람이 정한 미션 방향: ${target.missionSeed}`).join('\n') || '(수정 대상 없음)'

  const priorText = priorMissionStatuses.length
    ? priorMissionStatuses.map((mission) => `- ${mission.missionId}: ${mission.status}`).join('\n')
    : '(지난 수정미션 판정 없음)'

  return `너는 초등학교 6학년 글쓰기를 돕는 친절한 공룡 코치 '디노'야.
판정자가 고른 채점기준을 학생이 바로 행동할 수 있는 수정미션으로 바꿔.
미리 만든 문장을 복사하지 말고, 아래 학생 글에 실제로 나온 내용과 사람이 정한 미션 방향을 연결해 매번 새로 작성해.

[학생 글]
---
${writing}
---

[충족한 채점기준]
${metCriteria}

[코드가 선택한 수정 대상]
${targetText}

[지난 수정미션 수행 상태]
${priorText}

[잘한 점 작성 규칙]
- 충족한 채점기준 하나를 골라 학생 글에 실제로 나온 부분을 짚어 칭찬해.
- 충족한 기준이 없으면 rubricId와 criterionId를 모두 effort로 쓰고, 루브릭을 충족했다고 꾸미지 말고 글을 끝까지 쓴 노력처럼 사실인 점만 칭찬해.

[수정미션 작성 규칙]
${bullets(missionRules(spec))}`
}

function normalizedTargetKey(rubricIds, criterionIds) {
  return `${[...rubricIds].sort().join('|')}::${[...criterionIds].sort().join('|')}`
}

function isVagueOnlyMission(mission) {
  const vaguePattern = /(자세히|구체적으로|내용\s*보충|더\s*잘\s*다듬)/
  if (!vaguePattern.test(`${mission.title} ${mission.instruction}`)) return false

  const concreteRemainder = mission.instruction
    .replace(/자세히|구체적으로|내용을?|보충|더|잘|다듬|써\s*보세요|쓰기|해\s*보세요|하세요|[.\s]/g, '')
  return concreteRemainder.length < 8
}

function hasForbiddenVaguePhrase(mission) {
  return /(자세히\s*(?:써|쓰)|구체적으로\s*(?:써|쓰)|내용\s*(?:을\s*)?보충|더\s*잘\s*다듬)/u
    .test(`${mission.title} ${mission.instruction}`)
}

function hasUngroundedQuotedContent(instruction, writing) {
  if (!writing) return false
  const quotedParts = [...instruction.matchAll(/['"‘“]([^'"’”]{4,})['"’”]/gu)]
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
  const normalizedWriting = writing.replace(/\s+/g, ' ')
  return quotedParts.some((part) => !normalizedWriting.includes(part))
}

// 행동을 나타내는 말의 화이트리스트다. '이야기'처럼 -기로 끝나기만 하고 행동이
// 아닌 제목을 걸러 내려면 이 방식이어야 한다.
//
// 아래 뒷줄은 새 단원을 실제로 태워 보고 채웠다. 기사문·이야기 단원에서는
// '만들기'·'채우기'·'잇기'가 자연스럽게 나오는데 목록에 없어서, 멀쩡한 미션이
// 거절되고 재시도 5회를 다 쓰다 죽는 일이 있었다.
export const ACTION_TITLE_PATTERN =
  /(하기|추가하기|덧붙이기|밝히기|드러내기|소개하기|설명하기|알아보기|떠올리기|써\s*넣기|이어쓰기|쓰기|옮기기|모으기|나누기|연결하기|질문하기|확인하기|고르기|바꾸기|정리하기|배치하기|표시하기|준비하기|마무리하기|완성하기|다듬기|적기|넣기|빼기|고치기|만들기|채우기|잇기|붙이기|살리기|늘리기|줄이기|세우기|묶기|나타내기|보태기|합치기)$/u
export const ACTION_INSTRUCTION_PATTERN =
  /(추가|덧붙|밝혀|밝히|드러내|소개|설명|알아보|떠올|써|쓰세요|이어\s*쓰|옮겨|옮기|모아|모으|나눠|나누|연결|질문|물어|확인|골라|고르|바꿔|바꾸|정리|배치|표시|준비|마무리|적어|적으|넣어|넣으|빼|고쳐|고치|만들|만드|다듬|채워|채우|살려|살리|붙여|붙이|이어|늘려|늘리|줄여|줄이|나타내|합쳐|합치|세워|세우)/u

// 인용을 통째로 바꿔치울 때, 뒤에 붙어 있던 조사를 그대로 두면 말이 어긋난다.
// 스모크 실행에서 "학생 글의 관련 내용는 내용과 학생 글의 관련 내용는 내용을"
// 이라는 문장이 학생에게 나갈 뻔했다. 조사를 함께 걷어내고 바꿔 넣을 말에 맞는
// 것으로 다시 붙인다.
const PARTICLE_ALLOMORPHS = {
  은: ['은', '는'], 는: ['은', '는'],
  이: ['이', '가'], 가: ['이', '가'],
  을: ['을', '를'], 를: ['을', '를'],
  과: ['과', '와'], 와: ['과', '와'],
  으로: ['으로', '로'], 로: ['으로', '로'],
  이라는: ['이라는', '라는'], 라는: ['이라는', '라는'],
}

function withParticle(word, particle) {
  if (!particle) return word
  const pair = PARTICLE_ALLOMORPHS[particle]
  if (!pair) return `${word}${particle}`
  return `${word}${endsWithConsonant(word) ? pair[0] : pair[1]}`
}

// 긴 것부터 — '이'가 앞서면 '이라는'을 가로챈다. 뒤에 공백이나 문장부호가 와야
// 조사로 인정한다. 그러지 않으면 '은행'의 '은'까지 조사로 떼어 간다.
//
// 조사는 필수다. 여기 없는 조사('…'에 해당하는 처럼)가 붙은 인용은 이 규칙을
// 그냥 지나가고, 뒤따르는 무조건 치환 규칙이 받는다 — 조사를 못 알아봤다고
// 지어낸 인용을 학생에게 그대로 내보내면 안 된다.
const TRAILING_PARTICLE = '(이라는|라는|으로|은|는|이|가|을|를|과|와|로)(?=\\s|[,.!?)]|$)'
const QUOTED = "['\"‘“]([^'\"’”]{4,})['\"’”]"

const VAGUE_MISSION_TITLE_PATTERN =
  /(자세히|구체적으로|내용\s*보충|더\s*잘\s*다듬)/u
const VAGUE_MISSION_SENTENCE_PATTERN =
  /[^.?!]*(?:자세히\s*(?:써|쓰)|구체적으로\s*(?:써|쓰)|내용\s*(?:을\s*)?보충|더\s*잘\s*다듬)[^.?!]*[.?!]?\s*/gu

// `fallbackTitles` is the unit's per-criterion replacement for a title the
// model made vague ('내용 자세히 쓰기'). It comes off the spec, so a unit that
// writes none simply keeps whatever the model returned and lets
// validateMissionResult reject it.
export function sanitizeMissionResult(
  result,
  writing = '',
  selectedTargets = [],
  fallbackTitles = {},
) {
  if (!result || !Array.isArray(result.missions)) return result
  const normalizedWriting = writing.replace(/\s+/g, ' ')
  let missionsWithTargets = result.missions.map((mission, index) => ({
    mission,
    target: selectedTargets[index],
  }))

  if (selectedTargets.length === 2) {
    const missionsByTargetIndex = new Map()
    for (const mission of result.missions) {
      if (!Number.isInteger(mission?.targetIndex) || ![1, 2].includes(mission.targetIndex)) {
        throw new Error('mission targetIndex must be 1 or 2')
      }
      if (missionsByTargetIndex.has(mission.targetIndex)) {
        throw new Error('mission targetIndex values must be unique')
      }
      missionsByTargetIndex.set(mission.targetIndex, mission)
    }
    if (missionsByTargetIndex.size !== 2) {
      throw new Error('mission targetIndex values must include 1 and 2')
    }
    missionsWithTargets = [1, 2].map((targetIndex) => ({
      mission: missionsByTargetIndex.get(targetIndex),
      target: selectedTargets[targetIndex - 1],
    }))
  }

  return {
    ...result,
    missions: missionsWithTargets.map(({ mission, target }) => {
      const {
        targetIndex: _targetIndex,
        rubricIds: _modelRubricIds,
        criterionIds: _modelCriterionIds,
        ...missionWithoutTargetMetadata
      } = mission
      return {
      ...missionWithoutTargetMetadata,
      title:
        typeof mission.title === 'string' &&
        VAGUE_MISSION_TITLE_PATTERN.test(mission.title) &&
        fallbackTitles[target?.criterionIds?.at(-1)]
          ? fallbackTitles[target.criterionIds.at(-1)]
          : mission.title,
      ...(target
        ? {
            rubricIds: target.rubricIds,
            criterionIds: target.criterionIds,
          }
        : {}),
      instruction: typeof mission.instruction === 'string'
        ? mission.instruction
          .replace(VAGUE_MISSION_SENTENCE_PATTERN, '')
          .replace(/\s*예를\s*들어[,\s\S]*$/u, '')
          .replace(/\s*만약[^.?!]*(?:듣지|모르)[\s\S]*$/u, '')
          // '어떤 문장'/'어떤 내용'처럼 인용 뒤에 가리키는 말이 오는 꼴.
          // 그 말을 그대로 살려야 뒤에 붙은 조사도 자연스럽게 이어진다.
          .replace(
            new RegExp(`${QUOTED}\\s*(?:이?라는|는|은)?\\s*(문장|내용|부분|표현|말)`, 'gu'),
            (match, quoted, noun) => normalizedWriting.includes(quoted.replace(/\s+/g, ' ').trim())
              ? match
              : `학생 글의 관련 ${noun}`,
          )
          .replace(
            /['"‘“]([^'"’”]{4,})['"’”](?:와|과)\s*같이/gu,
            (match, quoted) => normalizedWriting.includes(quoted.replace(/\s+/g, ' ').trim())
              ? match
              : '학생 글의 관련 내용을 바탕으로',
          )
          .replace(
            new RegExp(`${QUOTED}\\s*${TRAILING_PARTICLE}`, 'gu'),
            (match, quoted, particle) => normalizedWriting.includes(quoted.replace(/\s+/g, ' ').trim())
              ? match
              : withParticle('학생 글의 관련 내용', particle),
          )
          // 남은 인용 전부. 알아보지 못한 조사가 붙어 있어도 지어낸 인용은
          // 반드시 걷어낸다.
          .replace(
            /['"‘“]([^'"’”]{4,})['"’”]/gu,
            (match, quoted) => normalizedWriting.includes(quoted.replace(/\s+/g, ' ').trim())
              ? match
              : '학생 글의 관련 내용',
          )
          .trim()
        : mission.instruction,
      }
    }),
  }
}

export function validateMissionResult(
  result,
  selectedTargets,
  { assessments = [], writing = '' } = {},
) {
  if (!result || !Array.isArray(result.missions)) {
    throw new Error('수정미션 응답 형식이 올바르지 않음')
  }
  if (!result.strength || typeof result.strength.text !== 'string' || !result.strength.text.trim()) {
    throw new Error('잘한 점이 비어 있음')
  }
  // criterionId만 본다. 기준 id는 단원 안에서 유일하므로(lib/curriculum.test.js가
  // 고정) rubricId를 함께 맞춰 봐도 걸러 낼 것이 없고, 저장되는 것은 strength.text
  // 뿐이라 두 id는 이 검사 밖으로 나가지도 않는다.
  //
  // 실측에서 이 rubricId 대조가 재시도의 큰 몫이었다. 모델이 criterionId는
  // 'effort'로 제대로 쓰면서 rubricId에는 청크 id를 남겨 두는 일이 잦았고,
  // 그때마다 5회를 다 쓰고 502로 죽었다.
  const metAssessments = assessments.filter((assessment) => assessment.status === 'met')
  if (metAssessments.length && !metAssessments.some((assessment) =>
    assessment.criterionId === result.strength.criterionId,
  )) {
    throw new Error('잘한 점은 실제 충족한 채점기준을 가리켜야 함')
  }
  if (
    assessments.length
    && metAssessments.length === 0
    && result.strength.criterionId !== 'effort'
  ) {
    throw new Error('충족한 기준이 없을 때 잘한 점은 노력 항목을 가리켜야 함')
  }
  if (
    selectedTargets.length !== 2
    || result.missions.length !== 2
    || result.missions.length !== selectedTargets.length
  ) {
    throw new Error('수정미션 개수는 항상 2개여야 함')
  }

  const expectedKeys = new Set(selectedTargets.map((target) =>
    normalizedTargetKey(target.rubricIds, target.criterionIds),
  ))
  const seen = new Set()
  const seenMissionIds = new Set()
  for (const mission of result.missions) {
    if (typeof mission.id !== 'string' || !mission.id.trim()) {
      throw new Error('수정미션 ID가 비어 있음')
    }
    if (seenMissionIds.has(mission.id)) {
      throw new Error('수정미션 ID가 중복됨')
    }
    seenMissionIds.add(mission.id)
    const key = normalizedTargetKey(mission.rubricIds ?? [], mission.criterionIds ?? [])
    if (!expectedKeys.has(key) || seen.has(key)) {
      throw new Error('수정미션이 선택된 수정 대상과 일치하지 않음')
    }
    if (typeof mission.instruction !== 'string' || !mission.instruction.trim()) {
      throw new Error('수정미션 설명이 비어 있음')
    }
    if (hasForbiddenVaguePhrase(mission)) {
      throw new Error('수정미션에 금지된 막연한 표현이 있음')
    }
    if (isVagueOnlyMission(mission)) {
      throw new Error('수정미션에 학생이 행동할 방법이 없음')
    }
    if (/예를\s*들어|예시\s*문장|와\s*같이\s*써/.test(mission.instruction)) {
      throw new Error('학생이 베낄 예시 문장을 제시함')
    }
    if (/(듣지\s*못했다면|모른다면)[\s\S]*(생각|상상|추측)[\s\S]*(덧붙|써|쓰)/u.test(mission.instruction)) {
      throw new Error('수정미션이 면담 사실을 지어내도록 요구함')
    }
    if (hasUngroundedQuotedContent(mission.instruction, writing)) {
      throw new Error('수정미션에 학생 글에 없는 인용 내용이 있음')
    }
    if (typeof mission.title !== 'string' || !ACTION_TITLE_PATTERN.test(mission.title.trim())) {
      throw new Error('수정미션 제목은 행동 명사형 -기로 끝나야 함')
    }
    if (!ACTION_INSTRUCTION_PATTERN.test(mission.instruction)) {
      throw new Error('수정미션 설명에 실행 동작이 없음')
    }
    if (typeof mission.criterion !== 'string' || !mission.criterion.trim()) {
      throw new Error('다음 라운드 확인 기준이 비어 있음')
    }
    seen.add(key)
  }

  return result
}

export class CoachingApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'CoachingApiError'
    this.status = status
  }
}

async function requestGeminiJson({ prompt, schema, temperature, maxOutputTokens = 2048 }) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new CoachingApiError('서버에 API 키가 설정되어 있지 않아요.', 500)
  }

  let geminiResponse
  try {
    geminiResponse = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
    })
  } catch {
    throw new CoachingApiError('네트워크 오류가 발생했어요.', 502)
  }

  if (!geminiResponse.ok) {
    throw new CoachingApiError('AI 응답을 받아오지 못했어요.', 502)
  }

  const data = await geminiResponse.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new CoachingApiError('디노가 답을 만들지 못했어요.', 502)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new CoachingApiError('디노 응답을 이해하지 못했어요.', 502)
  }
}

export function buildRetryPrompt(originalPrompt, error) {
  return `${originalPrompt}

[이전 응답 오류]
${error.message}

위 원래 지시는 그대로 지키고, 이전 응답에서 지적된 오류만 바로잡아 JSON을 다시 생성해.`
}

export async function callGeminiJson({
  prompt,
  schema,
  temperature,
  validate,
  normalize = (result) => result,
  request = requestGeminiJson,
  maxAttempts = 3,
}) {
  let currentPrompt = prompt
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let result
    try {
      const rawResult = await request({ prompt: currentPrompt, schema, temperature })
      result = normalize(rawResult)
      validate(result)
      return result
    } catch (error) {
      if (error instanceof CoachingApiError && error.status === 500) {
        throw error
      }
      if (process.env.DEBUG_INTERVIEW_PROMPT === '1') {
        console.error('Gemini JSON validation failed:', error.message)
        if (result !== undefined) console.error(JSON.stringify(result, null, 2))
      }
      if (attempt === maxAttempts - 1) {
        if (error instanceof CoachingApiError) throw error
        throw new CoachingApiError('디노 응답을 이해하지 못했어요.', 502)
      }
      currentPrompt = buildRetryPrompt(prompt, error)
    }
  }
  throw new CoachingApiError('디노 응답을 이해하지 못했어요.', 502)
}

// The two-stage rubric pipeline: judge the writing against the unit's criteria,
// then turn the criteria a code-side selector picked into two missions. Which
// unit it is coaching comes entirely from `spec` — the criteria, both schemas,
// and the wording that is specific to that kind of writing.
export async function getRubricCoachingFeedback({
  spec,
  topic,
  writing,
  previousWriting,
  previousMissions = [],
  priorRounds = [],
  changes,
  callJson = callGeminiJson,
}) {
  const rubrics = spec.rubrics
  // 글이 한 글자도 바뀌지 않았으면 다시 판정하지 않고 직전 판정을 그대로 쓴다.
  // 판정 호출은 temperature 0이지만 프롬프트가 변화 맥락(previousWriting, changes,
  // 지난 미션)까지 함께 받기 때문에, 같은 글이라도 이력이 달라지면 판정이 흔들린다.
  // 실측에서 똑같은 267자 글이 body partial→met, closing partial→unmet으로 뒤집혀
  // 교사 보드에 있지도 않은 향상 ↑ 과 하락 ▼ 화살표가 떴다(body·closing은 채점기준을
  // 4개로 개편하기 전의 이름이다). 아래 priorMissions를 코드로 확정하는 것과 같은
  // 이유이고, 덤으로 Gemini 호출도 한 번 줄어든다.
  const unchangedAssessments = previousWriting === writing
    ? priorRounds.at(-1)?.assessments
    : null
  const reusableAssessments = Array.isArray(unchangedAssessments) && unchangedAssessments.length
    ? unchangedAssessments
    : null

  const assessmentResult = reusableAssessments
    ? { meaningless: false, criteria: reusableAssessments, priorMissions: [] }
    : await callJson({
      prompt: buildAssessmentPrompt({
        spec,
        topic,
        writing,
        previousWriting,
        previousMissions,
        changes,
      }),
      schema: spec.assessmentSchema,
      temperature: 0,
      validate: (result) => validateAssessment(result, rubrics, previousMissions),
    })

  if (assessmentResult.meaningless) {
    return {
      meaningless: true,
      assessments: assessmentResult.criteria,
      priorMissions: assessmentResult.priorMissions,
      strength: null,
      missions: [],
    }
  }

  const priorMissions = previousWriting === writing
    ? previousMissions.map((mission) => ({ missionId: mission.id, status: 'not-done' }))
    : assessmentResult.priorMissions

  const selectedTargets = selectMissionTargets({
    assessments: assessmentResult.criteria,
    rubrics,
    priorRounds,
  })
  const missionPrompt = buildMissionPrompt({
    spec,
    writing,
    assessments: assessmentResult.criteria,
    selectedTargets,
    priorMissionStatuses: priorMissions,
  })
  const missionResult = await callJson({
    prompt: missionPrompt,
    schema: spec.missionSchema,
    temperature: 0.7,
    maxAttempts: 5,
    normalize: (result) =>
      sanitizeMissionResult(result, writing, selectedTargets, spec.fallbackMissionTitles),
    validate: (result) => validateMissionResult(
      result,
      selectedTargets,
      { assessments: assessmentResult.criteria, writing },
    ),
  })

  return {
    meaningless: false,
    assessments: assessmentResult.criteria,
    priorMissions,
    strength: missionResult.strength,
    missions: missionResult.missions,
  }
}

// Calls Gemini and returns the parsed feedback object. Throws CoachingApiError
// on any failure so the route handler can map it to an HTTP status.
export async function getGeminiFeedback({ topic, writing, previousWriting, previousImprovements, genre }) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new CoachingApiError('서버에 API 키가 설정되어 있지 않아요.', 500)
  }

  const isRevision = Boolean(previousWriting && previousImprovements)
  const prompt = isRevision
    ? buildRevisionPrompt(topic, previousWriting, previousImprovements, writing, genre)
    : buildFirstRoundPrompt(topic, writing, genre)
  const schema = isRevision ? REVISION_SCHEMA : FIRST_ROUND_SCHEMA

  let geminiResponse
  try {
    geminiResponse = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
    })
  } catch {
    throw new CoachingApiError('네트워크 오류가 발생했어요.', 502)
  }

  if (!geminiResponse.ok) {
    throw new CoachingApiError('AI 응답을 받아오지 못했어요.', 502)
  }

  const data = await geminiResponse.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new CoachingApiError('디노가 답을 만들지 못했어요.', 502)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new CoachingApiError('디노 응답을 이해하지 못했어요.', 502)
  }
}
