'use client'

import { useEffect, useRef, useState } from 'react'
import { requestCoaching, saveDraft } from '../lib/actions.js'
import { getMascotState } from '../lib/mascot.js'
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
  const canCoach = isPendingReview ? false : isFirstRound ? isReady : true
  const mascot = getMascotState(attainment)

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
    <div className="container-wide">
      <header className="write-header">
        <div>
          <h1>🦕 디노 글쓰기 코치</h1>
          <p className="page-subtitle">함께 쓰고, 함께 성장해요!</p>
        </div>
        <span className="student-badge">{studentName}</span>
      </header>

      {activity.instructions && (
        <p className="instructions-banner">📣 {activity.instructions}</p>
      )}

      <div className="topic-card">
        <div>
          <p className="topic-card-label">오늘의 주제</p>
          <h2 className="topic-card-title">{activity.topic || '자유롭게 주제를 정해 써보세요'}</h2>
        </div>

        <div className="topic-card-progress">
          <p className="topic-card-progress-label">나의 글 도달도</p>
          <div className="attainment-track">
            <div className="attainment-mascot-wrap" style={{ left: `${Math.min(attainment ?? 0, 100)}%` }}>
              <span className="attainment-speech-bubble">{mascot.message}</span>
              <img src={`/dino/${mascot.face}.png`} alt="디노" className="attainment-mascot" />
            </div>
            <div className="attainment-track-bg">
              <div
                className={`attainment-track-fill ${(attainment ?? 0) >= 100 ? 'full' : ''}`}
                style={{ width: `${Math.min(attainment ?? 0, 100)}%` }}
              />
            </div>
          </div>
          <p className="attainment-track-value">
            {attainment !== null ? `${attainment}%` : '0%'}
            {rounds.length > 0 && <span className="revision-count"> · {rounds.length}회차</span>}
          </p>
        </div>
      </div>

      <div className="write-workspace">
        <div className="write-panel">
          <div className="write-panel-header">
            <h3>✏️ 내가 쓴 글</h3>
            <span className="char-count">글자 수 {charCount}자</span>
          </div>
          <textarea
            id="writing"
            placeholder="여기에 글을 써보세요!"
            value={writing}
            onChange={(e) => setWriting(e.target.value)}
          />
          <p className="write-panel-footer">
            <span>글은 자동으로 저장돼요.</span>
            <span>
              {charCount} / {activity.targetLength}자
              {isReady && <span className="ready-badge"> ✅ 준비 완료!</span>}
            </span>
          </p>
        </div>

        <div className="feedback-panel">
          <h3>✨ 디노의 피드백</h3>

          {!feedback ? (
            <p className="feedback-empty">
              아직 코칭을 받지 않았어요.
              <br />
              목표 글자 수를 채우고 코칭을 받아보세요!
            </p>
          ) : isPendingReview ? (
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
            <>
              <div className="feedback-good">
                <p className="feedback-good-title">👍 좋은 점</p>
                <p>{feedback.strength}</p>
              </div>
              <div className="feedback-missions">
                <p className="feedback-missions-title">🎯 수정 미션 (2가지)</p>
                <div className="feedback-mission">
                  <span className="feedback-mission-number">1</span>
                  <p className="feedback-mission-text">{feedback.improvements[0]}</p>
                </div>
                <div className="feedback-mission">
                  <span className="feedback-mission-number">2</span>
                  <p className="feedback-mission-text">{feedback.improvements[1]}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="coach-button-wrap">
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
                ? '디노에게 코칭 받기 ✨'
                : '다시 코칭 받기 ✨'}
        </button>
      </div>

      {error && <p className="error-message">{error.message}</p>}

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
