import {
  getAiRubrics,
  getGenreGuidance,
  getUnitById,
} from './curriculum.js'
import {
  applyRegressionChecks,
  buildRegressionCheckPrompt,
  buildRegressionCheckSchema,
  findDrops,
  validateRegressionChecks,
} from './regressionCheck.js'

// 일반 코치(채점기준 없는 단원)는 그대로 2.5-flash-lite. 채점기준 코칭만
// 3.8-flash 생각 낮게 — 측정(스펙 5-1절)에서 2.5-lite는 코드가 대상을 골라
// 주지 않으면 미션이 무너졌고, 3.8은 이전 글 맥락에 판정이 끌려가지 않았다.
const MODEL_ID = 'gemini-2.5-flash-lite'
const apiUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
const API_URL = apiUrl(MODEL_ID)
export const RUBRIC_MODEL = {
  model: 'gemini-3.8-flash',
  thinking: { thinkingLevel: 'low' },
  // 생각 토큰도 이 안에서 쓴다. 예전 2048은 모자랄 수 있다.
  maxOutputTokens: 4096,
}

// 보류 2건 (사용자가 스모크 비교를 보고 고른다. 고르면 안 쓰는 쪽을 지운다).
// ALL_MET_MISSIONS — 모든 기준이 met일 때 미션 개수. 'A' 3개 고정 / 'B' 0~3개.
// MISSION_CHECKS — 미션 코드 검사. 'C' 형식·무결성만 / 'B' C + 예시 문장·사실
// 지어내기·막연한 표현.
export const ALL_MET_MISSIONS = 'A'
export const MISSION_CHECKS = 'B'
export const MISSION_COUNT = 3

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
  maxItems: MISSION_COUNT,
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

// `minItems` drops to 0 only for an all-met round under ALL_MET_MISSIONS 'B'.
export function buildMissionSchema(rubrics, minItems = MISSION_COUNT) {
  const criterionIds = criterionIdsOf(rubrics)
  return {
    type: 'object',
    properties: {
      strength: {
        type: 'object',
        properties: {
          // 'effort' is the escape hatch for a round where nothing is met yet:
          // the praise has to point somewhere, and pointing at a criterion the
          // writing does not satisfy would be a lie.
          criterionId: { type: 'string', enum: [...criterionIds, 'effort'] },
          text: { type: 'string' },
        },
        required: ['criterionId', 'text'],
      },
      missions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            // AI가 기준을 직접 고른다. 코드는 진짜 기준인지만 본다.
            criterionId: { type: 'string', enum: criterionIds },
            title: { type: 'string' },
            instruction: { type: 'string' },
            criterion: { type: 'string' },
          },
          required: ['id', 'criterionId', 'title', 'instruction', 'criterion'],
        },
        minItems,
        maxItems: MISSION_COUNT,
      },
    },
    required: ['strength', 'missions'],
  }
}

// Everything the two-stage pipeline needs to coach one unit: its rubrics, the
// schemas derived from them, and the wording that is specific to this kind of
// writing. Assembling it in one place is what lets getRubricCoachingFeedback
// stay unit-agnostic.
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

// 선생님이 활동에 적은 안내(Activity.instructions). 학생 화면 📣 배너와 같은 글이다.
// 없으면 프롬프트에 아무것도 붙지 않는다. 여러 줄로 써도 한 줄로 편다.
function teacherInstructionsLine(instructions) {
  const text = instructions?.replace(/\s+/g, ' ').trim()
  return text ? `선생님 안내: ${text}` : ''
}

// 2026-10-20 수업: 투닝 AI 인물과 면담했는데 "실제로 어떤 팀의 누구인지",
// "면담 약속을 어떻게 잡았는지"를 쓰라는 미션이 나왔다. 활동 상황을 알려 주고
// 그 상황에 없는 사실을 요구하지 말라고 한다.
const SITUATION_FIT_RULE = "미션(보완할 점)은 활동 주제와 선생님 안내에 적힌 상황에 맞게 만들어. 그 상황에서는 있을 수 없는 사실을 쓰라고 하지 마. 예: AI 인물과 면담했다면 실제 사람의 이름·소속이나 면담 약속을 잡은 과정을 묻지 마."

export function buildFirstRoundPrompt(topic, writing, genre, instructions = null) {
  const genreNote = getGenreGuidance(genre)
  const topicPhrase = topic ? `"${topic}" 주제로` : '자유 주제로'
  const guide = teacherInstructionsLine(instructions)
  return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
아래는 아이가 ${topicPhrase} 쓴 글이야.${guide ? `\n${guide}` : ''}

---
${writing}
---

${MEANINGLESS_CHECK_INSTRUCTION}
그렇지 않다면, 이 글에서 잘한 점 1가지와 보완하면 좋을 점 2가지를 한국어로 알려줘.
보완할 점은 아이가 실제로 고칠 수 있는 구체적인 내용으로 써줘.${guide ? `\n${SITUATION_FIT_RULE}` : ''}${genreNote ? `\n이 글은 '${genre}' 종류의 글이야. ${genreNote}` : ''}`
}

export function buildRevisionPrompt(topic, previousWriting, previousImprovements, writing, genre, instructions = null) {
  const genreNote = getGenreGuidance(genre)
  const topicPhrase = topic ? `"${topic}" 주제로` : '자유 주제로'
  const guide = teacherInstructionsLine(instructions)
  return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
아이가 ${topicPhrase} 쓴 글을 고쳐썼어.${guide ? `\n${guide}` : ''}

[고치기 전 글]
${previousWriting}

[지난번에 알려준 보완할 점 2가지]
1. ${previousImprovements[0]}
2. ${previousImprovements[1]}

[고친 후 글]
${writing}

${MEANINGLESS_CHECK_INSTRUCTION}
그렇지 않다면, 먼저 지난번 보완할 점 1번과 2번을 각각 이번 글에서 고쳤는지 판단해줘(고쳤으면 true, 안 고쳤으면 false).
그다음 고친 후 글을 기준으로 새로운 잘한 점 1가지와 보완하면 좋을 점 2가지를 한국어로 알려줘.${guide ? `\n${SITUATION_FIT_RULE}` : ''}${genreNote ? `\n이 글은 '${genre}' 종류의 글이야. ${genreNote}` : ''}`
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
${bullets(MISSION_DONE_RULES)}`
}

// 관대한 판정 문구 (설계안 5절). 측정에서 관대하게 바꿔도 대조군(무관한 문장
// 붙이기, 글자만 늘리기)은 거의 다 not-done이었다.
const MISSION_DONE_RULES = [
  'done: 미션 방향에 맞는 의미 있는 개선이 있다. 문장이 짧거나 표현이 서툴러도 미션이 요구한 행동을 했으면 done이야.',
  'partial: 고친 흔적은 있지만 미션과의 관련성이나 개선이 부족하다.',
  'not-done: 미션과 관련된 수정이 없다.',
  '완벽한 문장이나 높은 글쓰기 수준을 요구하지 마. 확인 기준은 참고하되, 미션 설명에 없는 새로운 요구나 지나치게 엄격한 조건을 덧붙이지 마.',
  '글자 수만 늘린 것, 미션과 관계없는 내용을 추가한 것, 의미 없는 수정은 done이 아니야.',
  '글 전체가 아니라 고치기 전후의 변화를 근거로 삼아.',
]

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
  instructions = null,
  writing,
  previousWriting,
  previousMissions = [],
  changes,
}) {
  const guide = teacherInstructionsLine(instructions)
  const topicText = (topic ? `활동 주제: ${topic}` : '활동 주제: 학생이 자유롭게 정함') + (guide ? `\n${guide}` : '')
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

const isAllMet = (assessments) =>
  assessments.length > 0 && assessments.every((assessment) => assessment.status === 'met')

// The mission rules in the order the model reads them. Two of them are the
// unit's to write — where one unit says "don't invent 면담 내용" another says
// "don't invent 취재 내용" — so they sit in named slots rather than being
// appended, and the surrounding rules stay put whichever unit is coaching.
//
// 제목 '-기'와 설명의 동작은 프롬프트 지시로만 둔다. 예전에는 코드 목록으로
// 걸렀는데, 측정(스펙 5-1절)에서 재시도의 주원인이었고 3.8에서는 대부분
// 오탐이었다('담기', '짓기', '남겨 보세요'가 목록에 없었다).
function missionRules(spec, countRule) {
  const { grounding, selfFill } = spec.missionGuidance ?? {}
  return [
    countRule,
    "title은 반드시 행동을 나타내는 짧은 명사형 '-기'로 끝내. 예: '까닭 추가하기', '느낀 점 덧붙이기'.",
    'instruction에는 학생 글에서 어디를, 무엇으로, 어떻게 고칠지 드러내.',
    grounding,
    '완성 문장이나 모범답안을 대신 쓰지 마. 학생이 그대로 베낄 답을 주지 마.',
    "'예를 들어' 뒤에 학생이 베낄 문장을 제시하지 마. 글에 없는 이유나 상황을 선택지로 만들어 주지도 마.",
    selfFill,
    "'자세히 쓰기', '자세히 써 보세요', '구체적으로 쓰기', '내용 보충하기', '더 잘 다듬기'라는 막연한 표현은 사용하지 마. 글의 위치나 주제를 함께 언급해도 이 표현 자체를 쓰면 안 돼.",
    ...collectCriterionNotes(spec.rubrics, 'missionNotes'),
    '미션끼리 서로 같은 행동을 요구하지 않게 해.',
    'criterion에는 다음 라운드에서 실제 변화로 확인할 수 있는 한 문장의 기준을 써.',
    '점수, 등급, 상·중·하 표현을 사용하지 마.',
  ].filter(Boolean)
}

// AI가 판정과 학생 글을 보고 기준을 골라 미션을 직접 만든다. 이전 회차 미션은
// 넘기지 않는다 — 고친 곳은 덜 부족해지므로 같은 미션은 저절로 줄어든다고
// 본다(스펙 1절).
export function buildMissionPrompt({
  spec,
  topic = null,
  instructions = null,
  writing,
  assessments,
  allMetMissions = ALL_MET_MISSIONS,
}) {
  // 주제·안내가 둘 다 없으면 아무것도 붙지 않는다.
  const situation = [topic ? `활동 주제: ${topic}` : '', teacherInstructionsLine(instructions)].filter(Boolean)
  const situationBlock = situation.length ? `[활동 상황]
${situation.join('\n')}

` : ''
  const statusById = new Map(assessments.map((assessment) => [assessment.criterionId, assessment.status]))
  const criterionText = spec.rubrics.flatMap((rubric) => rubric.criteria).map((criterion) => `- criterionId=${criterion.id}
  채점기준: ${criterion.label}
  판정: ${statusById.get(criterion.id) ?? 'partial'}
  선생님이 정한 미션 방향: ${criterion.missionSeed ?? '(없음)'}`).join('\n')

  const allMet = isAllMet(assessments)
  const optional = allMet && allMetMissions === 'B'
  const choosing = allMet
    ? `[심화 미션]
모든 채점기준을 충족한 글이야. 부족한 점을 억지로 만들어 내지 마.
- 위 채점기준 가운데 하나와 연결해, 글의 구체성·표현력·생동감·내용의 깊이를 한 걸음 더 발전시키는 심화 미션을 만들어.
- 새로운 평가 기준을 만들지 마.
- 잘한 점에서 이미 잘 썼다는 것을 충분히 칭찬해. 더 고칠지는 학생이 고른다.`
    : `[미션 고르는 원칙]
- 미션마다 위 채점기준 가운데 하나를 골라 criterionId에 그 id를 그대로 써.
- unmet과 partial을 모두 고려하되 무조건 unmet부터 고르지 마. 학생 글에서 고치면 가장 좋아지고 실행하기 쉬운 곳을 먼저 골라.
- 모자란 기준이 ${MISSION_COUNT}개보다 적으면 한 기준에서 다른 곳을 짚거나, 이미 충족한 기준을 한 걸음 더 발전시키는 미션을 섞어도 돼.
- 미션은 한 번의 퇴고로 해낼 수 있게 작고 구체적으로 만들어.`
  const countRule = optional
    ? `심화 미션은 0~${MISSION_COUNT}개 만들어. 더 발전시킬 곳이 분명하지 않으면 억지로 채우지 말고 적게 만들거나 빈 배열로 둬.`
    : `수정미션은 정확히 ${MISSION_COUNT}개 만들어.`

  return `너는 초등학교 6학년 글쓰기를 돕는 친절한 공룡 코치 '디노'야.
판정 결과와 학생 글을 보고, 학생이 이번 퇴고에서 골라 해 볼 수정미션을 직접 골라 만들어.
미리 만든 문장을 복사하지 말고, 학생 글에 실제로 나온 내용과 선생님이 정한 미션 방향을 연결해 매번 새로 작성해.

${situationBlock}[학생 글]
---
${writing}
---

[채점기준과 판정]
${criterionText}

${choosing}

[잘한 점 작성 규칙]
- 충족한 채점기준 하나를 골라 학생 글에 실제로 나온 부분을 짚어 칭찬해.
- 충족한 기준이 없으면 criterionId를 effort로 쓰고, 루브릭을 충족했다고 꾸미지 말고 글을 끝까지 쓴 노력처럼 사실인 점만 칭찬해.

[수정미션 작성 규칙]
${bullets([...missionRules(spec, countRule), situation.length ? SITUATION_FIT_RULE : ''].filter(Boolean))}`
}

// 저장 모양 맞추기. 보드와 옛 회차가 rubricIds/criterionIds 배열을 읽는다.
export function attachMissionIds(result, rubrics) {
  if (!result || !Array.isArray(result.missions)) return result
  return {
    ...result,
    missions: result.missions.map((mission) => {
      const rubricId = findCriterion(rubrics, mission?.criterionId)?.rubric.id
      const { criterionId, ...rest } = mission
      return rubricId
        ? { ...rest, rubricIds: [rubricId], criterionIds: [criterionId] }
        : mission
    }),
  }
}

const VAGUE_PHRASE_PATTERN = /(자세히\s*(?:써|쓰)|구체적으로\s*(?:써|쓰)|내용\s*(?:을\s*)?보충|더\s*잘\s*다듬)/u
const EXAMPLE_SENTENCE_PATTERN = /예를\s*들어|예시\s*문장|와\s*같이\s*써/
const INVENT_FACTS_PATTERN = /(듣지\s*못했다면|모른다면)[\s\S]*(생각|상상|추측)[\s\S]*(덧붙|써|쓰)/u

// 'B' 핵심 검사에서 미션 하나가 걸리는 사유. 스모크가 'C'로 돌린 결과에도
// 같은 잣대를 대 보려고 따로 뗐다.
export function missionCoreProblems(mission) {
  const problems = []
  if (EXAMPLE_SENTENCE_PATTERN.test(mission.instruction ?? '')) {
    problems.push('학생이 베낄 예시 문장을 제시함')
  }
  if (INVENT_FACTS_PATTERN.test(mission.instruction ?? '')) {
    problems.push('수정미션이 사실을 지어내도록 요구함')
  }
  if (VAGUE_PHRASE_PATTERN.test(`${mission.title ?? ''} ${mission.instruction ?? ''}`)) {
    problems.push('수정미션에 금지된 막연한 표현이 있음')
  }
  return problems
}

// 'C' 형식·무결성: 저장·보드가 읽는 모양과, 거짓 칭찬 막기.
// 'B' 핵심: C + 베낄 예시 문장, 사실 지어내기 요구, 막연한 표현. 걸리면 재시도.
export function validateMissionResult(
  result,
  {
    assessments = [],
    rubrics,
    checks = MISSION_CHECKS,
    allMetMissions = ALL_MET_MISSIONS,
  },
) {
  if (!result || !Array.isArray(result.missions)) {
    throw new Error('수정미션 응답 형식이 올바르지 않음')
  }
  if (!result.strength || typeof result.strength.text !== 'string' || !result.strength.text.trim()) {
    throw new Error('잘한 점이 비어 있음')
  }
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

  const optional = isAllMet(assessments) && allMetMissions === 'B'
  const count = result.missions.length
  if (optional ? count > MISSION_COUNT : count !== MISSION_COUNT) {
    throw new Error(optional
      ? `수정미션은 ${MISSION_COUNT}개 이하여야 함`
      : `수정미션 개수는 항상 ${MISSION_COUNT}개여야 함`)
  }

  const knownIds = new Set(criterionIdsOf(rubrics))
  const seenMissionIds = new Set()
  for (const mission of result.missions) {
    if (typeof mission.id !== 'string' || !mission.id.trim()) {
      throw new Error('수정미션 ID가 비어 있음')
    }
    if (seenMissionIds.has(mission.id)) {
      throw new Error('수정미션 ID가 중복됨')
    }
    seenMissionIds.add(mission.id)
    if (!knownIds.has(mission.criterionId)) {
      throw new Error(`알 수 없는 채점기준: ${mission.criterionId}`)
    }
    for (const [field, label] of [['title', '제목'], ['instruction', '설명'], ['criterion', '확인 기준']]) {
      if (typeof mission[field] !== 'string' || !mission[field].trim()) {
        throw new Error(`수정미션 ${label}이 비어 있음`)
      }
    }
    if (checks !== 'B') continue
    const [problem] = missionCoreProblems(mission)
    if (problem) throw new Error(problem)
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

async function requestGeminiJson({
  prompt,
  schema,
  temperature,
  config: { model = MODEL_ID, thinking, maxOutputTokens = 2048 } = {},
}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new CoachingApiError('서버에 API 키가 설정되어 있지 않아요.', 500)
  }

  let geminiResponse
  try {
    geminiResponse = await fetch(`${apiUrl(model)}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: schema,
          ...(thinking ? { thinkingConfig: thinking } : {}),
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
  // 생각하는 모델은 생각 part를 앞에 붙여 보낸다. 답은 thought가 아닌 part다.
  const text = data?.candidates?.[0]?.content?.parts?.find((part) => !part.thought)?.text
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
  config,
  request = requestGeminiJson,
  maxAttempts = 3,
}) {
  let currentPrompt = prompt
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let result
    try {
      result = await request({ prompt: currentPrompt, schema, temperature, config })
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

// 내려간 기준만 한 번 더 확인한다. 확인 호출이 실패하면 직전 판정을 지킨다 —
// 학생 코칭을 통째로 실패시킬 만한 일이 아니고, 예전 잠금과 같은 쪽으로 기운다.
async function checkRegressions({ spec, previousWriting, writing, changes, drops, callJson, config }) {
  if (!drops.length) return []
  try {
    const result = await callJson({
      prompt: buildRegressionCheckPrompt({ spec, previousWriting, writing, changes, drops }),
      schema: buildRegressionCheckSchema(drops),
      temperature: 0,
      config,
      validate: (response) => validateRegressionChecks(response, drops),
    })
    const regressedById = new Map(result.checks.map((check) => [check.criterionId, check.regressed]))
    return drops.map((drop) => ({ ...drop, regressed: regressedById.get(drop.criterionId) }))
  } catch (error) {
    if (error instanceof CoachingApiError && error.status === 500) throw error
    return drops.map((drop) => ({ ...drop, regressed: false }))
  }
}

// The rubric pipeline: judge the writing against the unit's criteria, confirm
// any drop against the previous round, then let the model pick and write the
// missions. Which unit it is coaching comes entirely from `spec`.
//
// `previousMissions` are only the missions the student chose last round — the
// unchosen ones are never judged.
export async function getRubricCoachingFeedback({
  spec,
  topic,
  instructions = null,
  writing,
  previousWriting,
  previousMissions = [],
  priorRounds = [],
  changes,
  callJson = callGeminiJson,
  config = RUBRIC_MODEL,
  allMetMissions = ALL_MET_MISSIONS,
  missionChecks = MISSION_CHECKS,
}) {
  const rubrics = spec.rubrics
  // 반려(flagged) 회차는 판정이 없으니 건너뛴다.
  const previousAssessments = priorRounds.findLast((round) =>
    Array.isArray(round?.assessments) && round.assessments.length,
  )?.assessments ?? null
  // 글이 한 글자도 바뀌지 않았으면 다시 판정하지 않고 직전 판정을 그대로 쓴다.
  // 덤으로 Gemini 호출도 한 번 줄어든다.
  const reusableAssessments = previousWriting === writing ? previousAssessments : null

  const assessmentResult = reusableAssessments
    ? { meaningless: false, criteria: reusableAssessments, priorMissions: [] }
    : await callJson({
      prompt: buildAssessmentPrompt({
        spec,
        topic,
        instructions,
        writing,
        previousWriting,
        previousMissions,
        changes,
      }),
      schema: spec.assessmentSchema,
      temperature: 0,
      config,
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

  const rawAssessments = assessmentResult.criteria
  const regressionChecks = reusableAssessments
    ? []
    : await checkRegressions({
      spec,
      previousWriting,
      writing,
      changes,
      drops: findDrops(rawAssessments, previousAssessments),
      callJson,
      config,
    })
  const assessments = applyRegressionChecks(rawAssessments, regressionChecks)

  const allMetOptional = isAllMet(assessments) && allMetMissions === 'B'
  const missionResult = await callJson({
    prompt: buildMissionPrompt({ spec, topic, instructions, writing, assessments, allMetMissions }),
    schema: allMetOptional ? buildMissionSchema(rubrics, 0) : spec.missionSchema,
    temperature: 0.7,
    maxAttempts: 5,
    config,
    validate: (result) => validateMissionResult(result, {
      assessments,
      rubrics,
      checks: missionChecks,
      allMetMissions,
    }),
  })

  return {
    meaningless: false,
    assessments,
    // 모델이 실제로 뭐라고 판정했는지. 하락 확인이 무엇을 지켰는지 되짚을
    // 근거는 이것과 regressionChecks뿐이다.
    rawAssessments,
    regressionChecks,
    priorMissions,
    strength: missionResult.strength,
    missions: attachMissionIds(missionResult, rubrics).missions,
  }
}

// Calls Gemini and returns the parsed feedback object. Throws CoachingApiError
// on any failure so the route handler can map it to an HTTP status.
export async function getGeminiFeedback({ topic, instructions = null, writing, previousWriting, previousImprovements, genre }) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new CoachingApiError('서버에 API 키가 설정되어 있지 않아요.', 500)
  }

  const isRevision = Boolean(previousWriting && previousImprovements)
  const prompt = isRevision
    ? buildRevisionPrompt(topic, previousWriting, previousImprovements, writing, genre, instructions)
    : buildFirstRoundPrompt(topic, writing, genre, instructions)
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
