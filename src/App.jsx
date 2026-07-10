import { useEffect, useState } from 'react'
import './App.css'
import { getCoachingFeedback, CoachingError, CoachingErrorType } from './geminiCoachService.js'
import { loadSession, saveSession, clearSession } from './sessionStorage.js'

const MIN_CHARS = 400
const ATTAINMENT_START = 40
const ATTAINMENT_PER_POINT = 10

const savedSession = loadSession()

function App() {
  const [topic, setTopic] = useState(savedSession?.topic ?? '')
  const [writing, setWriting] = useState(savedSession?.writing ?? '')
  const [isCoaching, setIsCoaching] = useState(false)
  const [feedback, setFeedback] = useState(savedSession?.feedback ?? null)
  const [attainment, setAttainment] = useState(savedSession?.attainment ?? null)
  const [lastSubmittedWriting, setLastSubmittedWriting] = useState(savedSession?.lastSubmittedWriting ?? null)
  const [lastImprovements, setLastImprovements] = useState(savedSession?.lastImprovements ?? null)
  const [rounds, setRounds] = useState(savedSession?.rounds ?? [])
  const [error, setError] = useState(null)

  useEffect(() => {
    saveSession({ topic, writing, feedback, attainment, lastSubmittedWriting, lastImprovements, rounds })
  }, [topic, writing, feedback, attainment, lastSubmittedWriting, lastImprovements, rounds])

  const charCount = writing.length
  const isFirstRound = feedback === null
  const isReady = charCount >= MIN_CHARS
  const progressPercent = Math.min((charCount / MIN_CHARS) * 100, 100)
  const canCoach = isFirstRound ? isReady : true
  const hasContent = topic.length > 0 || writing.length > 0 || rounds.length > 0

  const handleCoachClick = async () => {
    setIsCoaching(true)
    setError(null)

    try {
      const result = await getCoachingFeedback({
        topic,
        writing,
        previousWriting: lastSubmittedWriting,
        previousImprovements: lastImprovements,
      })

      const nextAttainment = (() => {
        if (!result.addressed) return ATTAINMENT_START
        const fixedCount = result.addressed.filter(Boolean).length
        return (attainment ?? ATTAINMENT_START) + fixedCount * ATTAINMENT_PER_POINT
      })()

      setAttainment(nextAttainment)
      setFeedback({ strength: result.strength, improvements: result.improvements })
      setLastSubmittedWriting(writing)
      setLastImprovements(result.improvements)
      setRounds((prev) => [
        ...prev,
        {
          writing,
          strength: result.strength,
          improvements: result.improvements,
          addressed: result.addressed ?? null,
          attainmentAfter: nextAttainment,
        },
      ])
    } catch (err) {
      const message =
        err instanceof CoachingError && err.type === CoachingErrorType.NETWORK
          ? '네트워크 오류가 발생했어요. 다시 시도해주세요.'
          : '코칭을 받아오지 못했어요. 잠시 후 다시 시도해주세요.'
      setError({ message })
    } finally {
      setIsCoaching(false)
    }
  }

  const handleNewWritingClick = () => {
    if (!window.confirm('정말 새 글을 시작할까요? 지금까지 쓴 내용이 모두 사라져요.')) return
    clearSession()
    setTopic('')
    setWriting('')
    setFeedback(null)
    setAttainment(null)
    setLastSubmittedWriting(null)
    setLastImprovements(null)
    setRounds([])
    setError(null)
  }

  return (
    <div className="container">
      <h1>🦕 디노와 함께 글쓰기</h1>

      {hasContent && (
        <button className="new-writing-link" onClick={handleNewWritingClick}>
          새 글 시작
        </button>
      )}

      <div className="field">
        <label htmlFor="topic">오늘의 글쓰기 주제</label>
        <input
          id="topic"
          type="text"
          placeholder="글쓰기 주제를 입력하세요"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="writing">내 글쓰기</label>
        <textarea
          id="writing"
          placeholder="여기에 글을 써보세요!"
          value={writing}
          onChange={(e) => setWriting(e.target.value)}
        />
      </div>

      <div className="progress-section">
        <div className="progress-bar-bg">
          <div
            className={`progress-bar-fill ${isReady ? 'complete' : ''}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="char-count">
          {charCount} / {MIN_CHARS}자
          {isReady && <span className="ready-badge"> ✅ 준비 완료!</span>}
        </p>
      </div>

      {attainment !== null && (
        <div className="attainment-section">
          <div className="attainment-bar-bg">
            <div
              className={`attainment-bar-fill ${attainment >= 100 ? 'full' : ''}`}
              style={{ width: `${Math.min(attainment, 100)}%` }}
            />
          </div>
          <p className="attainment-label">도달도 {attainment}%</p>
        </div>
      )}

      <button
        className={`coach-button ${isCoaching ? 'loading' : ''}`}
        disabled={!canCoach || isCoaching}
        onClick={handleCoachClick}
      >
        {isCoaching ? '코칭 준비 중...' : isFirstRound ? '디노 코칭 받기' : '다시 코칭 받기'}
      </button>

      {error && <p className="error-message">{error.message}</p>}

      {feedback && (
        <div className="feedback-card">
          <p className="feedback-title">🦕 디노의 코칭</p>
          <ul>
            <li>👍 {feedback.strength}</li>
            <li>✏️ {feedback.improvements[0]}</li>
            <li>✏️ {feedback.improvements[1]}</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default App
