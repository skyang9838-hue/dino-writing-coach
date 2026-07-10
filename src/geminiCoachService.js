export const CoachingErrorType = {
  NETWORK: 'network',
  UNKNOWN: 'unknown',
}

export class CoachingError extends Error {
  constructor(message, type = CoachingErrorType.UNKNOWN) {
    super(message)
    this.name = 'CoachingError'
    this.type = type
  }
}

export async function getCoachingFeedback({ topic, writing, previousWriting, previousImprovements }) {
  const body = { topic, writing }
  if (previousWriting && previousImprovements) {
    body.previousWriting = previousWriting
    body.previousImprovements = previousImprovements
  }

  let response
  try {
    response = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new CoachingError('네트워크 오류가 발생했어요.', CoachingErrorType.NETWORK)
  }

  if (!response.ok) {
    throw new CoachingError('코칭을 받아오지 못했어요. 잠시 후 다시 시도해주세요.', CoachingErrorType.UNKNOWN)
  }

  return response.json()
}
