import { useState } from 'react'
import './App.css'

const MIN_CHARS = 400

function App() {
  const [topic, setTopic] = useState('')
  const [writing, setWriting] = useState('')

  const charCount = writing.length
  const isReady = charCount >= MIN_CHARS
  const progressPercent = Math.min((charCount / MIN_CHARS) * 100, 100)

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

      <button className="coach-button" disabled={!isReady}>
        디노 코칭 받기
      </button>
    </div>
  )
}

export default App
