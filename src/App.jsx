import { useState } from 'react'
import './App.css'
import { getCoachingFeedback, GeminiCoachingError, GeminiErrorType } from './geminiCoachService.js'

const MIN_CHARS = 400
const API_KEY_STORAGE_KEY = 'dino-writing-coach:gemini-api-key'

function App() {
  const [topic, setTopic] = useState('')
  const [writing, setWriting] = useState('')
  const [isCoaching, setIsCoaching] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE_KEY) ?? '')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [isEditingKey, setIsEditingKey] = useState(false)
  const [error, setError] = useState(null)

  const charCount = writing.length
  const isReady = charCount >= MIN_CHARS
  const progressPercent = Math.min((charCount / MIN_CHARS) * 100, 100)
  const hasKey = apiKey.length > 0
  const showKeyInput = !hasKey || isEditingKey

  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed)
    setApiKey(trimmed)
    setApiKeyInput('')
    setIsEditingKey(false)
    setError(null)
  }

  const handleChangeKeyClick = () => {
    setApiKeyInput('')
    setIsEditingKey(true)
  }

  const handleCancelEditKey = () => {
    setIsEditingKey(false)
    setApiKeyInput('')
  }

  const handleCoachClick = async () => {
    setIsCoaching(true)
    setFeedback(null)
    setError(null)

    try {
      const result = await getCoachingFeedback(apiKey, topic, writing)
      setFeedback(result)
    } catch (err) {
      if (err instanceof GeminiCoachingError && err.type === GeminiErrorType.AUTH) {
        setError({ message: 'API 키가 올바르지 않아요. 키를 다시 확인해주세요.' })
        setIsEditingKey(true)
      } else {
        setError({ message: '코칭을 받아오지 못했어요. 잠시 후 다시 시도해주세요.' })
      }
    } finally {
      setIsCoaching(false)
    }
  }

  return (
    <div className="container">
      <h1>🦕 디노와 함께 글쓰기</h1>

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

      {showKeyInput ? (
        <div className="api-key-row">
          <input
            type="password"
            className="api-key-input"
            placeholder="Gemini API 키를 입력하세요"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <button
            className="api-key-save-button"
            disabled={!apiKeyInput.trim()}
            onClick={handleSaveKey}
          >
            저장
          </button>
          {hasKey && (
            <button className="api-key-cancel-button" onClick={handleCancelEditKey}>
              취소
            </button>
          )}
        </div>
      ) : (
        <>
          <button
            className={`coach-button ${isCoaching ? 'loading' : ''}`}
            disabled={!isReady || isCoaching}
            onClick={handleCoachClick}
          >
            {isCoaching ? '코칭 준비 중...' : '디노 코칭 받기'}
          </button>
          <button className="change-key-link" disabled={isCoaching} onClick={handleChangeKeyClick}>
            키 변경
          </button>
        </>
      )}
      {showKeyInput && (
        <p className="api-key-hint">
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>
          에서 무료로 API 키를 발급받을 수 있어요.
        </p>
      )}
      {error && <p className="error-message">{error.message}</p>}

      {feedback && (
        <div className="feedback-card">
          <p className="feedback-title">🦕 디노의 코칭</p>
          <ul>
            {feedback.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default App
