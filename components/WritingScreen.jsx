'use client'

import { useEffect, useRef, useState } from 'react'
import { requestCoaching, saveDraft } from '../lib/actions.js'
import { RevisionHistory } from './RevisionHistory.jsx'

const AUTOSAVE_DELAY_MS = 800

const FLAG_MESSAGES = {
  nonsense: '이 글은 의미가 통하는 문장으로 보기 어려워요. 같은 글자나 자음/모음을 반복하지 말고, 완성된 문장으로 다시 써 보세요.',
  profanity: '선생님이 확인한 결과, 이 글에는 적절하지 않은 표현이 있었어요. 표현을 다듬어서 다시 써 보세요.',
}

export function WritingScreen({ submissionId, studentName, activity, initial }) {
  const [writing, setWriting] = useState(initial.writing)
  const [isCoaching, setIsCoaching] = useState(false)
  const [feedback, setFeedback] = useState(initial.feedback)
  const [attainment, setAttainment] = useState(initial.attainment)
  const [rounds, setRounds] = useState(initial.rounds)
  const [error, setError] = useState(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const skipNextAutosave = useRef(true)
  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false
      return
    }
    const timer = setTimeout(() => {
      saveDraft(submissionId, writing)
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [writing, submissionId])

  const charCount = writing.length
  const isFirstRound = feedback === null
  const isPendingReview = Boolean(feedback?.pending)
  const isReady = charCount >= activity.targetLength
  const progressPercent = Math.min((charCount / activity.targetLength) * 100, 100)
  const canCoach = isPendingReview ? false : isFirstRound ? isReady : true

  const handleCoachClick = async () => {
    setIsCoaching(true)
    setError(null)

    const result = await requestCoaching(submissionId, writing)

    if (result.error) {
      setError({ message: result.error })
    } else {
      setFeedback(result.feedback)
      setAttainment(result.attainment)
      setRounds(result.rounds)
    }
    setIsCoaching(false)
  }

  return (
    <div className="container">
      <h1>🦕 디노와 함께 글쓰기</h1>
      <p className="page-subtitle">
        {studentName} · {activity.topic}
      </p>

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
          {charCount} / {activity.targetLength}자
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
          <p className="attainment-label">
            도달도 {attainment}% <span className="revision-count">· {rounds.length}회차</span>
          </p>
        </div>
      )}

      <button
        className={`coach-button ${isCoaching ? 'loading' : ''}`}
        disabled={!canCoach || isCoaching}
        onClick={handleCoachClick}
      >
        {isCoaching
          ? '코칭 준비 중...'
          : isPendingReview
            ? '선생님 확인 중...'
            : isFirstRound
              ? '디노 코칭 받기'
              : '다시 코칭 받기'}
      </button>

      {error && <p className="error-message">{error.message}</p>}

      {feedback && (
        isPendingReview ? (
          <div className="pending-card">
            <p className="pending-title">🕒 선생님이 확인하고 있어요</p>
            <p>선생님이 이 글을 확인한 뒤 다시 코칭을 받을 수 있어요. 잠시만 기다려주세요.</p>
          </div>
        ) : feedback.flagged ? (
          <div className="warning-card">
            <p className="warning-title">⚠️ 다시 확인해주세요</p>
            <p>{FLAG_MESSAGES[feedback.reason] ?? '이 글은 검토가 필요해요. 다시 써 보세요.'}</p>
          </div>
        ) : (
          <div className="feedback-card">
            <p className="feedback-title">🦕 디노의 코칭</p>
            <ul>
              <li>👍 {feedback.strength}</li>
              <li>✏️ {feedback.improvements[0]}</li>
              <li>✏️ {feedback.improvements[1]}</li>
            </ul>
          </div>
        )
      )}

      {rounds.length > 0 && (
        <div className="history-section">
          <button className="history-toggle" onClick={() => setIsHistoryOpen((prev) => !prev)}>
            {isHistoryOpen ? '이전 버전 접기' : `이전 버전 다시 보기 (총 ${rounds.length}회)`}
          </button>

          {isHistoryOpen && <RevisionHistory rounds={rounds} />}
        </div>
      )}
    </div>
  )
}
