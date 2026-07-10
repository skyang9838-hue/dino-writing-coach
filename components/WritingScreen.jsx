'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { diffWords } from 'diff'
import { requestCoaching, saveDraft, submitWriting } from '../lib/actions.js'

const AUTOSAVE_DELAY_MS = 800

export function WritingScreen({ submissionId, studentName, activity, initial }) {
  const [writing, setWriting] = useState(initial.writing)
  const [isCoaching, setIsCoaching] = useState(false)
  const [feedback, setFeedback] = useState(initial.feedback)
  const [attainment, setAttainment] = useState(initial.attainment)
  const [rounds, setRounds] = useState(initial.rounds)
  const [error, setError] = useState(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [status, setStatus] = useState(initial.status)
  const [submittedAt, setSubmittedAt] = useState(initial.submittedAt)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Rendered only after mount: toLocaleString('ko-KR') can format AM/PM
  // differently between Node's ICU and the browser's, which would otherwise
  // cause a hydration mismatch.
  const [submittedAtLabel, setSubmittedAtLabel] = useState(null)
  useEffect(() => {
    setSubmittedAtLabel(submittedAt ? new Date(submittedAt).toLocaleString('ko-KR') : null)
  }, [submittedAt])

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
  const isReady = charCount >= activity.targetLength
  const progressPercent = Math.min((charCount / activity.targetLength) * 100, 100)
  const canCoach = isFirstRound ? isReady : true

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

  const handleSubmitClick = async () => {
    setIsSubmitting(true)
    const result = await submitWriting(submissionId, writing)
    setStatus('submitted')
    setSubmittedAt(result.submittedAt)
    setIsSubmitting(false)
  }

  const roundLabel = (index) => (index === 0 ? '초안' : `${index}차 수정`)

  const renderWritingDiff = (before, after) =>
    diffWords(before, after).map((part, partIndex) => {
      const lines = part.value.split('\n')
      const content = lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {line}
        </Fragment>
      ))
      const className = part.added ? 'diff-added' : part.removed ? 'diff-removed' : undefined
      return (
        <span className={className} key={partIndex}>
          {content}
        </span>
      )
    })

  return (
    <div className="container">
      <h1>🦕 디노와 함께 글쓰기</h1>
      <p className="page-subtitle">
        {studentName} · {activity.topic}
      </p>

      {status === 'submitted' && <span className="submitted-badge">✅ 제출 완료</span>}

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
        {isCoaching ? '코칭 준비 중...' : isFirstRound ? '디노 코칭 받기' : '다시 코칭 받기'}
      </button>

      <button className="submit-button" disabled={isSubmitting} onClick={handleSubmitClick}>
        {isSubmitting ? '제출하는 중...' : status === 'submitted' ? '다시 제출하기' : '제출하기'}
      </button>
      {submittedAtLabel && (
        <p className="char-count" style={{ textAlign: 'center', marginTop: '0.4rem' }}>
          마지막 제출: {submittedAtLabel}
        </p>
      )}

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

      {rounds.length > 0 && (
        <div className="history-section">
          <button className="history-toggle" onClick={() => setIsHistoryOpen((prev) => !prev)}>
            {isHistoryOpen ? '이전 버전 접기' : `이전 버전 다시 보기 (총 ${rounds.length}회)`}
          </button>

          {isHistoryOpen && (
            <div className="history-list">
              <p className="history-legend">
                <span className="diff-removed">빨강 취소선</span>은 지운 부분,{' '}
                <span className="diff-added">파랑 밑줄</span>은 추가한 부분이에요.
              </p>
              {rounds.map((round, index) => (
                <div className="history-item" key={index}>
                  <p className="history-item-title">
                    {roundLabel(index)} · 도달도 {round.attainmentAfter}%
                  </p>
                  <p className="history-item-writing">
                    {index === 0 ? round.writing : renderWritingDiff(rounds[index - 1].writing, round.writing)}
                  </p>

                  {index > 0 && (
                    <div className="history-mission-check">
                      <p className="history-subtitle">지난 미션 반영 확인</p>
                      <ul>
                        {rounds[index - 1].improvements.map((mission, missionIndex) => (
                          <li key={missionIndex}>
                            {round.addressed?.[missionIndex] ? '✅' : '❌'} {mission}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="history-mission-new">
                    <p className="history-subtitle">👍 {round.strength}</p>
                    <ul>
                      <li>✏️ {round.improvements[0]}</li>
                      <li>✏️ {round.improvements[1]}</li>
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
