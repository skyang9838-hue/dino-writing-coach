'use client'

import { Fragment } from 'react'
import { diffWords } from 'diff'
import { getMissionStatusSymbol, getVisibleMissions } from '../lib/feedback.js'

const roundLabel = (index) => (index === 0 ? '초안' : `${index}차 수정`)

const FLAG_REASON_LABELS = {
  nonsense: '무의미한 글로 판단되어 도달도가 0%로 처리됐어요.',
  profanity: '선생님이 부적절한 표현으로 판단해 반려했어요. (도달도는 변동 없어요)',
}
const flagReasonLabel = (reason) => FLAG_REASON_LABELS[reason] ?? '이 글은 검토가 필요해 도달도가 0%로 처리됐어요.'

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

// Pure display of a submission's coaching rounds on the student's own writing
// screen: each round's writing (diffed word-for-word against the previous
// round), whether the prior round's improvement missions were addressed, and
// the new feedback. Stacked vertically, no expand/collapse state of its own —
// components/WritingScreen.jsx owns the "이전 버전 다시 보기" toggle.
//
// The teacher reads the same rounds through components/RevisionBoard.jsx,
// which lays them out side by side and adds the rubric table.
export function RevisionHistory({ rounds }) {
  return (
    <div className="history-list">
      <p className="history-legend">
        <span className="diff-removed">빨강 취소선</span>은 지운 부분,{' '}
        <span className="diff-added">파랑 밑줄</span>은 추가한 부분이에요.
      </p>
      <div className="history-items">
        {rounds.map((round, index) => {
          const previousRound = index > 0 ? rounds[index - 1] : null
          const currentMissions = getVisibleMissions(round)
          const previousMissions = getVisibleMissions(previousRound)
          return (
            <div className="history-item" key={index}>
              <p className="history-item-title">
                {roundLabel(index)}
                {round.attainmentAfter !== null ? ` · 도달도 ${round.attainmentAfter}%` : ''}
              </p>
              <p className="history-item-writing">
                {previousRound ? renderWritingDiff(previousRound.writing, round.writing) : round.writing}
              </p>

              {round.flagged ? (
                <p className="history-flagged-badge">⚠️ {flagReasonLabel(round.flagReason)}</p>
              ) : (
                <>
                  {previousRound && !previousRound.flagged && (
                    <div className="history-mission-check">
                      <p className="history-subtitle">지난 미션 반영 확인</p>
                      <ul>
                        {previousMissions.map((mission, missionIndex) => {
                          const previousMissionId = previousRound.missions?.[missionIndex]?.id
                          const newStatus = round.priorMissionStatuses?.find(
                            (status) => status.missionId === previousMissionId,
                          )?.status
                          const legacyStatus = round.addressed?.[missionIndex]
                          return (
                            <li key={previousMissionId ?? missionIndex}>
                              {getMissionStatusSymbol(newStatus ?? legacyStatus)}{' '}
                              {mission.title ? `${mission.title} — ` : ''}
                              {mission.instruction}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="history-mission-new">
                    <p className="history-subtitle">👍 {round.strength}</p>
                    <ul>
                      {currentMissions.map((mission, missionIndex) => (
                        <li key={round.missions?.[missionIndex]?.id ?? missionIndex}>
                          ✏️ {mission.title ? `${mission.title} — ` : ''}
                          {mission.instruction}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
