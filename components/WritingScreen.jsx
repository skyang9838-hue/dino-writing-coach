'use client'

import { useEffect, useRef, useState } from 'react'
import { requestCoaching, saveDraft } from '../lib/actions.js'
import { getMissionPick } from '../lib/feedback.js'
import { getMascotState } from '../lib/mascot.js'
import { RevisionHistory } from './RevisionHistory.jsx'
import { DinoIcon } from './DinoIcon.jsx'

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
  const [selectedIds, setSelectedIds] = useState([])

  // 좋은 점은 두 줄까지만 보이고 길면 "더 보기"로 편다 — 미션 세 개가 피드백
  // 칸 안에 스크롤 없이 들어오게.
  const strengthRef = useRef(null)
  const [isStrengthOpen, setIsStrengthOpen] = useState(false)
  const [isStrengthLong, setIsStrengthLong] = useState(false)
  const strength = feedback?.strength
  useEffect(() => {
    setIsStrengthOpen(false)
    const el = strengthRef.current
    setIsStrengthLong(Boolean(el && el.scrollHeight > el.clientHeight + 1))
  }, [strength])

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
  const { missions: pickableMissions, mustPick, needsPick } = getMissionPick({ rounds, isFirstRound, selectedIds })
  const canCoach = isPendingReview ? false : isFirstRound ? isReady : !needsPick
  const mascot = getMascotState(attainment)

  const toggleMission = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleCoachClick = async () => {
    setIsCoaching(true)
    setError(null)

    const result = await requestCoaching(submissionId, writing, selectedIds)

    if (result.error) {
      setError({ message: result.error })
    } else {
      setFeedback(result.feedback)
      setAttainment(result.attainment)
      setRounds(result.rounds)
      // 새 미션을 받았을 때만 선택을 비운다. 반려되면 같은 미션으로 다시 낸다.
      if (!result.feedback?.flagged && !result.feedback?.pending) setSelectedIds([])
    }
    setIsCoaching(false)
  }

  return (
    <div className="container-write">
      <div className="write-screen">
        {/* 머리말·주제·도달도를 한 줄에 — 학생 노트북(약 1280×650)에서 글쓰기 칸이
            남는 높이를 최대한 받도록 윗부분을 낮게 둔다. */}
        <header className="write-topbar">
          <div className="write-brand">
            <h1>
              <DinoIcon pose="writing" size="sm" /> 디노 글쓰기 코치
            </h1>
            <p className="write-brand-subtitle">함께 쓰고, 함께 성장해요!</p>
          </div>

          <div className="write-topic">
            <p className="write-topic-label">오늘의 주제</p>
            <h2 className="write-topic-title">{activity.topic || '자유롭게 주제를 정해 써보세요'}</h2>
            {activity.instructions && (
              <p className="instructions-banner" title={activity.instructions}>
                📣 {activity.instructions}
              </p>
            )}
          </div>

          <div className="write-progress">
            <div className="write-progress-head">
              <p className="write-progress-label">
                나의 글 도달도{' '}
                <strong className="attainment-value">{attainment !== null ? `${attainment}%` : '0%'}</strong>
                {rounds.length > 0 && <span className="revision-count"> · {rounds.length}회차</span>}
              </p>
              <span className="attainment-speech-bubble">{mascot.message}</span>
            </div>
            <div className="attainment-track">
              <div className="attainment-track-bg">
                <div
                  className={`attainment-track-fill ${(attainment ?? 0) >= 100 ? 'full' : ''}`}
                  style={{ width: `${Math.min(attainment ?? 0, 100)}%` }}
                />
              </div>
              <img
                src={`/dino/${mascot.face}.png`}
                alt="디노"
                className="attainment-mascot"
                style={{ left: `${Math.min(attainment ?? 0, 100)}%` }}
              />
            </div>
          </div>

          <span className="student-badge">{studentName}</span>
        </header>

        <div className="write-workspace">
          <div className="write-panel">
            <div className="write-panel-header">
              <h3>✏️ 내가 쓴 글</h3>
              <span className="write-panel-autosave">글은 자동으로 저장돼요.</span>
              <span className="char-count">
                글자 수 <strong>{charCount.toLocaleString()}</strong> / {activity.targetLength.toLocaleString()}자
                {isReady && <span className="ready-badge"> ✅ 준비 완료!</span>}
              </span>
            </div>
            <textarea
              id="writing"
              placeholder="여기에 글을 써보세요!"
              value={writing}
              onChange={(e) => setWriting(e.target.value)}
            />
          </div>

          {/* 머리말 · 스크롤되는 본문 · 코칭 버튼(맨 아래 고정)의 세 칸.
              코칭 버튼이 따로 한 줄을 차지하지 않게 피드백 칸 안에 둔다. */}
          <div className="feedback-panel">
            <div className="feedback-panel-header">
              <h3>✨ 디노의 피드백</h3>
              {rounds.length > 0 && (
                <button className="history-toggle" onClick={() => setIsHistoryOpen((prev) => !prev)}>
                  {isHistoryOpen ? '이전 버전 접기' : `이전 버전 다시 보기 (총 ${rounds.length}회)`}
                </button>
              )}
            </div>

            <div className="feedback-panel-body">
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
              ) : (
                <>
                  {feedback.flagged ? (
                    <div className="warning-card">
                      <p className="warning-title">⚠️ 다시 확인해주세요</p>
                      <p>{FLAG_MESSAGES[feedback.reason] ?? '이 글은 검토가 필요해요. 다시 써 보세요.'}</p>
                    </div>
                  ) : (
                    <div className="feedback-good">
                      <p className="feedback-good-title">👍 좋은 점</p>
                      <p
                        ref={strengthRef}
                        className={`feedback-good-text ${isStrengthOpen ? '' : 'is-clamped'}`}
                      >
                        {feedback.strength}
                      </p>
                      {(isStrengthLong || isStrengthOpen) && (
                        <button
                          type="button"
                          className="feedback-good-more"
                          onClick={() => setIsStrengthOpen((prev) => !prev)}
                        >
                          {isStrengthOpen ? '접기 ▴' : '더 보기 ▾'}
                        </button>
                      )}
                    </div>
                  )}
                  {(!feedback.flagged || mustPick) && (
                    <div className="feedback-missions">
                      <p className="feedback-missions-title">
                        🎯 수정 미션 ({pickableMissions.length}가지)
                        {mustPick && <span className="feedback-mission-hint">해 볼 미션을 골라요.</span>}
                      </p>
                      {pickableMissions.length === 0 && (
                        <p className="feedback-mission-text">이번에는 미션이 없어요. 더 고치고 싶으면 고쳐서 다시 코칭을 받아도 돼요.</p>
                      )}
                      {pickableMissions.map((mission, index) => {
                        const content = (
                          <>
                            <span className="feedback-mission-number">{index + 1}</span>
                            <p className="feedback-mission-text">
                              {mission.title && <strong className="feedback-mission-name">{mission.title}</strong>}
                              {mission.instruction}
                            </p>
                          </>
                        )
                        const key = mission.id ?? `${mission.title ?? 'legacy'}-${index}`
                        if (!mission.id) {
                          return <div className="feedback-mission" key={key}>{content}</div>
                        }
                        const isPicked = selectedIds.includes(mission.id)
                        return (
                          <button
                            type="button"
                            className={`feedback-mission feedback-mission-pick ${isPicked ? 'is-picked' : ''}`}
                            aria-pressed={isPicked}
                            key={key}
                            onClick={() => toggleMission(mission.id)}
                          >
                            {content}
                            <span className="feedback-mission-check" aria-hidden="true">{isPicked ? '✔' : ''}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 코칭 버튼 위의 안내 줄(오류 등)은 이 칸 안, 버튼 바로 위에 둔다. */}
            <div className="coach-button-wrap">
              {error && <p className="error-message">{error.message}</p>}
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
          </div>
        </div>
      </div>

      {rounds.length > 0 && isHistoryOpen && (
        <div className="history-section">
          <RevisionHistory rounds={rounds} />
        </div>
      )}
    </div>
  )
}
