const MODEL_ID = 'gemini-2.5-flash-lite'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`

const FIRST_ROUND_SCHEMA = {
  type: 'object',
  properties: {
    strength: { type: 'string' },
    improvements: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['strength', 'improvements'],
}

const REVISION_SCHEMA = {
  type: 'object',
  properties: {
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
  required: ['addressed', 'strength', 'improvements'],
}

function buildFirstRoundPrompt(topic, writing) {
  return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
아래는 아이가 "${topic}" 주제로 쓴 글이야.

---
${writing}
---

이 글에서 잘한 점 1가지와 보완하면 좋을 점 2가지를 한국어로 알려줘.
보완할 점은 아이가 실제로 고칠 수 있는 구체적인 내용으로 써줘.`
}

function buildRevisionPrompt(topic, previousWriting, previousImprovements, writing) {
  return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
아이가 "${topic}" 주제로 쓴 글을 고쳐썼어.

[고치기 전 글]
${previousWriting}

[지난번에 알려준 보완할 점 2가지]
1. ${previousImprovements[0]}
2. ${previousImprovements[1]}

[고친 후 글]
${writing}

먼저 지난번 보완할 점 1번과 2번을 각각 이번 글에서 고쳤는지 판단해줘(고쳤으면 true, 안 고쳤으면 false).
그다음 고친 후 글을 기준으로 새로운 잘한 점 1가지와 보완하면 좋을 점 2가지를 한국어로 알려줘.`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: '서버에 API 키가 설정되어 있지 않아요.' })
    return
  }

  const { topic, writing, previousWriting, previousImprovements } = req.body ?? {}
  if (!topic || !writing) {
    res.status(400).json({ error: 'topic과 writing이 필요해요.' })
    return
  }

  const isRevision = Boolean(previousWriting && previousImprovements)
  const prompt = isRevision
    ? buildRevisionPrompt(topic, previousWriting, previousImprovements, writing)
    : buildFirstRoundPrompt(topic, writing)
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
    res.status(502).json({ error: '네트워크 오류가 발생했어요.' })
    return
  }

  if (!geminiResponse.ok) {
    res.status(502).json({ error: 'AI 응답을 받아오지 못했어요.' })
    return
  }

  const data = await geminiResponse.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    res.status(502).json({ error: '디노가 답을 만들지 못했어요.' })
    return
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    res.status(502).json({ error: '디노 응답을 이해하지 못했어요.' })
    return
  }

  res.status(200).json(parsed)
}
