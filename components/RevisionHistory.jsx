'use client'

import { Fragment } from 'react'
import { diffWords } from 'diff'

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

// Pure display of a submission's coaching rounds: each round's writing
// (diffed word-for-word against the previous round), whether the prior
// round's improvement missions were addressed, and the new feedback.
// Used by both the student's own writing screen (layout="vertical", the
// default) and the teacher's read-only growth view (layout="horizontal",
// for side-by-side comparison across rounds) — no expand/collapse state
// of its own.
export function RevisionHistory({ rounds, layout = 'vertical' }) {
  return (
    <div className={`history-list history-list-${layout}`}>
      <p className="history-legend">
        <span className="diff-removed">빨강 취소선</span>은 지운 부분,{' '}
        <span className="diff-added">파랑 밑줄</span>은 추가한 부분이에요.
      </p>
      <div className="history-items">
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
    </div>
  )
}
