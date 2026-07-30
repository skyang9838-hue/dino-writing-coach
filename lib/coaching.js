import {
  INTERVIEW_REPORT_RUBRICS,
  getGenreGuidance,
} from './curriculum.js'
import { selectMissionTargets } from './missions.js'

const MODEL_ID = 'gemini-2.5-flash-lite'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`

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

export const INTERVIEW_ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    meaningless: { type: 'boolean' },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rubricId: {
            type: 'string',
            enum: ['purpose-and-subject', 'information', 'structure'],
          },
          criterionId: {
            type: 'string',
            enum: ['purpose', 'interviewee', 'new-fact', 'fact-detail', 'opening', 'body', 'closing'],
          },
          status: { type: 'string', enum: ['met', 'partial', 'unmet'] },
        },
        required: ['rubricId', 'criterionId', 'status'],
      },
      minItems: 7,
      maxItems: 7,
    },
    priorMissions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          missionId: { type: 'string' },
          status: { type: 'string', enum: ['done', 'attempted', 'not-done'] },
        },
        required: ['missionId', 'status'],
      },
      maxItems: 2,
    },
  },
  required: ['meaningless', 'criteria', 'priorMissions'],
}

export const INTERVIEW_MISSION_SCHEMA = {
  type: 'object',
  properties: {
    strength: {
      type: 'object',
      properties: {
        rubricId: { type: 'string' },
        criterionId: { type: 'string' },
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
          rubricIds: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['purpose-and-subject', 'information', 'structure'],
            },
            minItems: 1,
          },
          criterionIds: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['purpose', 'interviewee', 'new-fact', 'fact-detail', 'opening', 'body', 'closing'],
            },
            minItems: 1,
          },
          title: { type: 'string' },
          instruction: { type: 'string' },
          criterion: { type: 'string' },
        },
        required: ['id', 'rubricIds', 'criterionIds', 'title', 'instruction', 'criterion'],
      },
      maxItems: 2,
    },
    complete: { type: 'boolean' },
  },
  required: ['strength', 'missions', 'complete'],
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
    return `[rubricId=${rubric.id}]
${rubric.label}
${criteria}`
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
- attempted: 그 방향으로 고친 흔적은 있지만 확인 기준을 아직 만족하지 못한다.
- not-done: 관련된 변화가 없다.
- 확인 기준에서 요구한 내용이 새로 추가되었으면 짧아도 done이야. 이미 있던 내용만 조금 바꿨거나 요구한 내용의 일부만 추가했을 때 attempted야.
글 전체가 아니라 고치기 전후의 변화와 확인 기준을 함께 근거로 삼아.`
}

export function buildInterviewAssessmentPrompt({
  topic,
  writing,
  previousWriting,
  previousMissions = [],
  changes,
  rubrics = INTERVIEW_REPORT_RUBRICS,
}) {
  const topicText = topic ? `활동 주제: ${topic}` : '활동 주제: 학생이 자유롭게 정함'
  const previousBlock = previousWriting ? `

[고치기 전 글]
---
${previousWriting}
---` : ''

  return `너는 초등학교 6학년 면담 보고서를 정해진 루브릭으로 확인하는 판정자야.
글을 평가하거나 점수나 등급을 매기지 마. 각 채점기준에 해당하는 내용이 학생 글에 실제로 드러나는지만 확인해.

[공통 판정 원칙]
- 맞춤법이나 문장이 미숙해도 내용을 식별할 수 있으면 그 이유로 낮게 판정하지 마.
- 학생 생각의 수준이나 사실의 옳고 그름을 판단하지 마.
- 글에 직접 드러난 내용만 근거로 삼고 없는 내용을 추측하지 마.
- opening, body, closing은 내용의 존재를 중복 판정하지 말고 배치와 흐름을 확인해.
- 제목이나 줄바꿈이 없어도 내용상 역할이 구분되면 구조가 있다고 인정해.
- new-fact가 unmet이면 fact-detail을 met으로 판정할 수 없어.
- 면담 대상을 밝혔다는 사실만으로 purpose를 met으로 판정하지 마.
- 뒤에 나온 면담 내용을 보고 목적을 거꾸로 추측하지 마. 무엇을 알아보려 했는지가 글에 직접 드러나야 해.
- 무엇을 알아보려 했는지가 글 어디에든 직접 쓰여 있으면 purpose는 met이야. 그 문장의 위치는 purpose가 아니라 opening에서 따로 판정해.
- '왜 시작했는지 물었다'처럼 무엇을 또는 왜 또는 어떻게 물었는지가 직접 드러나도 purpose는 met이야. 반드시 '알아보기 위해'라는 표현이 있어야 하는 것은 아니야.
- 무엇을 알아보려 했는지는 없지만 면담 주제만 드러나면 purpose는 partial이고, 주제와 목적을 모두 찾을 수 없을 때만 unmet이야.
- 새롭게 알게 된 사실은 있지만 단순히 나열만 했으면 fact-detail은 partial이야. 설명할 새 사실 자체가 없을 때만 unmet이야.
- opening, body, closing에 필요한 내용이 글에 있지만 위치만 맞지 않으면 partial이야. 필요한 내용 자체가 없을 때만 unmet이야.
- opening은 목적, 대상, 준비 과정 세 가지가 모두 앞부분에 있어야 met이야. 하나라도 빠졌으면 partial이고, 뒤에 흩어져 있으면 met이 아니야.
- 준비 과정은 질문 작성, 자료 조사, 약속 잡기처럼 면담 전에 한 준비 행동이 글에 직접 있어야 인정해.
- 면담 목적을 쓰거나 질문했다는 사실만으로 준비 과정을 추측하지 마. 준비 행동이 직접 없으면 opening은 met이 아니라 partial이야.
- body는 새롭게 알게 된 사실이 도입과 마무리 사이의 중심 내용에 모여 있어야 met이야. 글 앞뒤에 뒤섞였으면 partial이야.
- closing은 생각이나 느낌이 글의 끝부분에 있어야 met이야. 글 중간에만 있으면 partial이야.
- '좋았다', '재미있었다', '중요하다'처럼 까닭이나 변화가 없는 말만 있으면 closing은 partial이야.
- 끝부분에 구체적인 깨달음이나 생각이 한 문장이라도 있으면 closing은 met이야. 문장 수가 적거나 별도의 까닭 문장이 없다는 이유만으로 partial로 낮추지 마.
- '해 보고 싶었다'처럼 구체적인 변화나 다짐이 끝부분에 있으면 closing을 met으로 인정해.
- 면담 활동이나 준비에 관한 느낌만 끝에 있으면 closing은 partial이야. 느낌이 전혀 없을 때만 unmet이야.

[루브릭과 채점기준]
JSON의 rubricId와 criterionId에는 아래에 적힌 영문 ID를 그대로 복사해.
숫자 번호나 한국어 이름을 ID로 만들지 마.
${formatRubrics(rubrics)}

${topicText}${previousBlock}

[현재 학생 글]
---
${writing}
---
${formatPriorMissionBlock(previousMissions, changes)}

[무의미 글 확인]
자음이나 모음만 반복하거나, 스페이스와 같은 무관한 문자로 분량만 채우거나, 문장들이 서로 연결되지 않아 실제 의미를 파악할 수 없는 글이면 meaningless를 true로 판정해.
의미 있는 면담 보고서라면 meaningless를 false로 판정하고, 루브릭 순서대로 모든 채점기준을 met, partial, unmet 중 하나로 판정해.
지난 수정미션이 없으면 priorMissions는 빈 배열로 반환해.`
}

function findCriterion(rubrics, criterionId) {
  for (const rubric of rubrics) {
    const criterion = rubric.criteria.find((item) => item.id === criterionId)
    if (criterion) return { rubric, criterion }
  }
  return null
}

export function validateInterviewAssessment(
  result,
  rubrics = INTERVIEW_REPORT_RUBRICS,
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

  const statuses = new Map(result.criteria.map((assessment) => [assessment.criterionId, assessment.status]))
  if (statuses.get('new-fact') === 'unmet' && statuses.get('fact-detail') === 'met') {
    throw new Error('채점기준 사이의 논리 모순: 새 사실 없이 구체적 설명을 충족할 수 없음')
  }
  if (statuses.get('opening') === 'met'
    && (statuses.get('purpose') !== 'met' || statuses.get('interviewee') !== 'met')) {
    throw new Error('채점기준 사이의 논리 모순: 목적과 대상이 모두 충족되지 않았는데 앞부분을 충족할 수 없음')
  }
  if (statuses.get('new-fact') !== 'unmet' && statuses.get('fact-detail') === 'unmet') {
    throw new Error('채점기준 사이의 논리 모순: 새 사실이 있는데 구체성만 미충족일 수 없음')
  }
  if (statuses.get('new-fact') !== 'unmet' && statuses.get('body') === 'unmet') {
    throw new Error('채점기준 사이의 논리 모순: 새 사실이 있는데 가운데 내용을 미충족으로 판정할 수 없음')
  }

  if (!Array.isArray(result.priorMissions)) {
    throw new Error('지난 수정미션 판정 형식이 올바르지 않음')
  }
  for (const mission of result.priorMissions) {
    if (!mission?.missionId || !['done', 'attempted', 'not-done'].includes(mission.status)) {
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

export function buildInterviewMissionPrompt({
  writing,
  assessments,
  selectedTargets,
  rubrics = INTERVIEW_REPORT_RUBRICS,
  priorMissionStatuses = [],
}) {
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
- 충족한 기준이 없으면 루브릭을 충족했다고 꾸미지 말고 글을 끝까지 쓴 노력처럼 사실인 점만 칭찬해.

[수정미션 작성 규칙]
- 선택된 수정 대상 하나마다 미션 하나만 만들어. 선택되지 않은 채점기준의 미션을 추가하지 마.
- title은 반드시 행동을 나타내는 짧은 명사형 '-기'로 끝내. 예: '까닭 추가하기', '느낀 점 덧붙이기'.
- instruction에는 학생 글에서 어디를, 무엇으로, 어떻게 고칠지 드러내.
- 학생 글에 실제로 나온 내용을 짚되 학생 글에 없는 면담 내용이나 사실을 만들어내지 마.
- 완성 문장이나 모범답안을 대신 쓰지 마. 학생이 그대로 베낄 답을 주지 마.
- '예를 들어' 뒤에 학생이 베낄 문장을 제시하지 마. 글에 없는 이유나 상황을 선택지로 만들어 주지도 마.
- 질문이나 단서는 줄 수 있지만 학생이 면담에서 들은 내용을 스스로 채우게 해.
- '자세히 쓰기', '자세히 써 보세요', '구체적으로 쓰기', '내용 보충하기', '더 잘 다듬기'라는 막연한 표현은 사용하지 마. 글의 위치나 주제를 함께 언급해도 이 표현 자체를 쓰면 안 돼.
- new-fact 또는 fact-detail이 수정 대상이면 면담에서 들은 이유·과정·상황을 확인할 질문을 만들고, 그 답을 어느 사실 뒤에 덧붙일지 안내해. '더 자세히 쓰기'라고 하지 마.
- body가 수정 대상이면 이미 쓴 새 사실 문장을 도입과 마무리 사이로 옮기거나 모으는 행동을 안내해. 정보의 양을 늘리는 '더 자세히 쓰기'로 바꾸지 마.
- 서로 같은 행동을 요구하는 미션을 반복하지 마.
- criterion에는 다음 라운드에서 실제 변화로 확인할 수 있는 한 문장의 기준을 써.
- 점수, 등급, 상·중·하 표현을 사용하지 마.

수정 대상이 없으면 missions를 빈 배열, complete를 true로 반환해. 수정 대상이 있으면 complete는 false야.`
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

const ACTION_TITLE_PATTERN =
  /(하기|추가하기|덧붙이기|밝히기|드러내기|소개하기|설명하기|알아보기|떠올리기|써\s*넣기|이어쓰기|쓰기|옮기기|모으기|나누기|연결하기|질문하기|확인하기|고르기|바꾸기|정리하기|배치하기|표시하기|준비하기|마무리하기|완성하기|다듬기|적기|넣기|빼기|고치기)$/u
const ACTION_INSTRUCTION_PATTERN =
  /(추가|덧붙|밝혀|밝히|드러내|소개|설명|알아보|떠올|써|쓰세요|이어\s*쓰|옮겨|옮기|모아|모으|나눠|나누|연결|질문|물어|확인|골라|고르|바꿔|바꾸|정리|배치|표시|준비|마무리|적어|적으|넣어|넣으|빼|고쳐|고치)/u

export function sanitizeInterviewMissionResult(result, writing = '') {
  if (!result || !Array.isArray(result.missions)) return result
  const normalizedWriting = writing.replace(/\s+/g, ' ')
  return {
    ...result,
    missions: result.missions.map((mission) => ({
      ...mission,
      instruction: typeof mission.instruction === 'string'
        ? mission.instruction
          .replace(/\s*예를\s*들어[,\s\S]*$/u, '')
          .replace(/\s*만약[^.?!]*(?:듣지|모르)[\s\S]*$/u, '')
          .replace(
            /['"‘“]([^'"’”]{4,})['"’”](?:라는|는)?\s*문장/gu,
            (match, quoted) => normalizedWriting.includes(quoted.replace(/\s+/g, ' ').trim())
              ? match
              : '학생 글의 관련 문장',
          )
          .replace(
            /['"‘“]([^'"’”]{4,})['"’”]/gu,
            (match, quoted) => normalizedWriting.includes(quoted.replace(/\s+/g, ' ').trim())
              ? match
              : '학생 글의 관련 내용',
          )
          .trim()
        : mission.instruction,
    })),
  }
}

export function validateInterviewMissionResult(
  result,
  selectedTargets,
  { assessments = [], writing = '' } = {},
) {
  if (!result || typeof result.complete !== 'boolean' || !Array.isArray(result.missions)) {
    throw new Error('수정미션 응답 형식이 올바르지 않음')
  }
  if (!result.strength || typeof result.strength.text !== 'string' || !result.strength.text.trim()) {
    throw new Error('잘한 점이 비어 있음')
  }
  const metAssessments = assessments.filter((assessment) => assessment.status === 'met')
  if (metAssessments.length && !metAssessments.some((assessment) =>
    assessment.rubricId === result.strength.rubricId
    && assessment.criterionId === result.strength.criterionId,
  )) {
    throw new Error('잘한 점은 실제 충족한 채점기준을 가리켜야 함')
  }
  if (result.missions.length !== selectedTargets.length || result.missions.length > 2) {
    throw new Error('수정미션 개수가 선택된 수정 대상과 다름')
  }
  if (result.complete !== (selectedTargets.length === 0)) {
    throw new Error('완성 상태와 수정 대상이 일치하지 않음')
  }

  const expectedKeys = new Set(selectedTargets.map((target) =>
    normalizedTargetKey(target.rubricIds, target.criterionIds),
  ))
  const seen = new Set()
  for (const mission of result.missions) {
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

export async function getInterviewReportFeedback({
  topic,
  writing,
  previousWriting,
  previousMissions = [],
  priorRounds = [],
  changes,
  rubrics = INTERVIEW_REPORT_RUBRICS,
}) {
  const latestRound = priorRounds.at(-1)
  if (
    previousWriting
    && previousWriting === writing
    && previousMissions.length > 0
    && Array.isArray(latestRound?.assessments)
  ) {
    const strengthCriterion = latestRound.assessments.find(
      (assessment) => assessment.status === 'met',
    ) ?? latestRound.assessments[0]
    return {
      meaningless: false,
      assessments: latestRound.assessments,
      priorMissions: previousMissions.map((mission) => ({
        missionId: mission.id,
        status: 'not-done',
      })),
      strength: {
        rubricId: strengthCriterion?.rubricId ?? rubrics[0].id,
        criterionId: strengthCriterion?.criterionId ?? rubrics[0].criteria[0].id,
        text: latestRound.strength || '지난 글에서 잘한 점은 그대로 유지했어요.',
      },
      missions: previousMissions,
      complete: false,
    }
  }

  const assessmentPrompt = buildInterviewAssessmentPrompt({
    topic,
    writing,
    previousWriting,
    previousMissions,
    changes,
    rubrics,
  })
  const assessmentResult = await callGeminiJson({
    prompt: assessmentPrompt,
    schema: INTERVIEW_ASSESSMENT_SCHEMA,
    temperature: 0,
    validate: (result) => validateInterviewAssessment(result, rubrics, previousMissions),
  })

  if (assessmentResult.meaningless) {
    return {
      meaningless: true,
      assessments: assessmentResult.criteria,
      priorMissions: assessmentResult.priorMissions,
      strength: null,
      missions: [],
      complete: false,
    }
  }

  const selectedTargets = selectMissionTargets({
    assessments: assessmentResult.criteria,
    rubrics,
    priorRounds,
  })
  const missionPrompt = buildInterviewMissionPrompt({
    writing,
    assessments: assessmentResult.criteria,
    selectedTargets,
    rubrics,
    priorMissionStatuses: assessmentResult.priorMissions,
  })
  const missionResult = await callGeminiJson({
    prompt: missionPrompt,
    schema: INTERVIEW_MISSION_SCHEMA,
    temperature: 0.7,
    maxAttempts: 5,
    normalize: (result) => sanitizeInterviewMissionResult(result, writing),
    validate: (result) => validateInterviewMissionResult(
      result,
      selectedTargets,
      { assessments: assessmentResult.criteria, writing },
    ),
  })

  return {
    meaningless: false,
    assessments: assessmentResult.criteria,
    priorMissions: assessmentResult.priorMissions,
    strength: missionResult.strength,
    missions: missionResult.missions,
    complete: missionResult.complete,
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
