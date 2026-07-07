const MODEL_ID = 'gemini-2.5-flash-lite'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`

export const GeminiErrorType = {
  AUTH: 'auth',
  NETWORK: 'network',
  UNKNOWN: 'unknown',
}

export class GeminiCoachingError extends Error {
  constructor(message, type = GeminiErrorType.UNKNOWN) {
    super(message)
    this.name = 'GeminiCoachingError'
    this.type = type
  }
}

function buildCoachingPrompt(topic, writing) {
  return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
아래는 아이가 "${topic}" 주제로 쓴 글이야.

---
${writing}
---

이 글에 대해 칭찬 1가지와 개선 제안 2가지, 총 3줄의 피드백을 한국어로 작성해줘.
반드시 아래 형식만 사용하고 다른 말은 하지 마:
1. (피드백 1)
2. (피드백 2)
3. (피드백 3)`
}

function parseFeedbackText(rawText) {
  const numbered = [...rawText.matchAll(/^\s*(?:\d+[.)]|[-*•])\s*(.+)$/gm)].map((m) => m[1].trim())
  if (numbered.length > 0) return numbered.slice(0, 3)

  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length > 0) return lines.slice(0, 3)

  const fallback = rawText.trim()
  return fallback ? [fallback] : ['디노가 피드백을 만드는 데 실패했어요. 다시 시도해주세요.']
}

export async function getCoachingFeedback(apiKey, topic, writing) {
  const prompt = buildCoachingPrompt(topic, writing)
  const url = `${API_URL}?key=${encodeURIComponent(apiKey)}`

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    })
  } catch {
    throw new GeminiCoachingError('네트워크 오류가 발생했어요.', GeminiErrorType.NETWORK)
  }

  if (!response.ok) {
    let body = null
    try {
      body = await response.json()
    } catch {
      // response body wasn't valid JSON — fall through with body = null
    }
    const isAuthError =
      [400, 401, 403].includes(response.status) &&
      (['INVALID_ARGUMENT', 'PERMISSION_DENIED', 'UNAUTHENTICATED'].includes(body?.error?.status) ||
        /api key/i.test(body?.error?.message ?? ''))
    throw new GeminiCoachingError(
      body?.error?.message ?? 'API 요청이 실패했어요.',
      isAuthError ? GeminiErrorType.AUTH : GeminiErrorType.UNKNOWN
    )
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new GeminiCoachingError('디노가 답을 만들지 못했어요. 다시 시도해주세요.', GeminiErrorType.UNKNOWN)
  }
  return parseFeedbackText(text)
}
