import { getGenreGuidance } from './curriculum.js'

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

export class CoachingApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'CoachingApiError'
    this.status = status
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
