import { useState } from 'react'
import './App.css'

const MIN_CHARS = 400

const MOCK_FEEDBACK_SETS = [
  (topic) => [
    `'${topic}' 주제로 시작을 잘 했어요!`,
    '문장 사이에 연결어를 조금 더 써보면 글이 더 매끄러워질 거예요.',
    '마지막 문장에 자신의 생각을 한 줄 더 추가해보세요.',
  ],
  (topic) => [
    `'${topic}'에 대한 경험이 잘 드러나 있어요.`,
    '비슷한 단어가 반복되는 곳이 있는지 다시 읽어보세요.',
    '읽는 사람이 그림을 떠올릴 수 있도록 예시를 더해보면 좋아요.',
  ],
  (topic) => [
    '글의 시작과 끝이 자연스럽게 이어져요.',
    `'${topic}' 주제에 어울리는 표현을 더 찾아볼까요?`,
    '문단을 나누면 훨씬 읽기 편해질 거예요.',
  ],
]

function App() {
  const [topic, setTopic] = useState('')
  const [writing, setWriting] = useState('')
  const [isCoaching, setIsCoaching] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const charCount = writing.length
  const isReady = charCount >= MIN_CHARS
  const progressPercent = Math.min((charCount / MIN_CHARS) * 100, 100)

  const handleCoachClick = () => {
    setIsCoaching(true)
    setFeedback(null)

    setTimeout(() => {
      const randomSet =
        MOCK_FEEDBACK_SETS[Math.floor(Math.random() * MOCK_FEEDBACK_SETS.length)]
      setFeedback(randomSet(topic))
      setIsCoaching(false)
    }, 1200)
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

      <button
        className={`coach-button ${isCoaching ? 'loading' : ''}`}
        disabled={!isReady || isCoaching}
        onClick={handleCoachClick}
      >
        {isCoaching ? '코칭 준비 중...' : '디노 코칭 받기'}
      </button>

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
