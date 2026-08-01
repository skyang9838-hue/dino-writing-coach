import { Fragment } from 'react'
import { diffWords } from 'diff'
import { getMissionRows, getRubricRows } from '../lib/revisionBoard.js'

// The teacher's read-only view of one student's revisions, laid out as cards
// side by side so a round can be compared with the ones around it. Everything
// shown is already stored on the round (lib/interviewRound.js) — this renders
// saved data and asks nothing of the AI.
//
// The rubric table only appears for genres that have a rubric (the interview
// report pilot); every other genre still gets the missions, the diff and the
// character count. The student's own screen keeps components/RevisionHistory
// .jsx — same rounds, but stacked and written for the student.
//
// Card titles count revisions from 1, so the first coaching round reads
// "1차 수정" with a 초안 badge. The student screen calls that same round 초안.

const RUBRIC_MARKS = {
  met: { glyph: '○', label: '충분히 충족' },
  partial: { glyph: '△', label: '보완 필요' },
  unmet: { glyph: '✕', label: '미충족' },
}

const TREND_MARKS = {
  same: { glyph: '–', label: '변화 없음' },
  up: { glyph: '↑', label: '향상' },
  down: { glyph: '▼', label: '하락' },
}

const MISSION_MARKS = {
  done: { glyph: '✅', label: '고쳤어요' },
  partial: { glyph: '🔄', label: '고치는 중이에요' },
  'not-done': { glyph: '❌', label: '아직 안 고쳤어요' },
}

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

function Mark({ marks, value, className }) {
  const mark = marks[value]
  if (!mark) return <span className={`${className} ${className}-none`} aria-hidden="true" />
  return (
    <span className={`${className} ${className}-${value}`} title={mark.label} aria-label={mark.label} role="img">
      {mark.glyph}
    </span>
  )
}

function RubricTable({ rows }) {
  return (
    <table className="board-rubric-table">
      <caption className="board-section-title">📋 채점기준표</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row">{row.label}</th>
            <td>
              <Mark marks={RUBRIC_MARKS} value={row.status} className="rubric-mark" />
            </td>
            <td>
              <Mark marks={TREND_MARKS} value={row.trend} className="rubric-trend" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MissionList({ rows }) {
  const pending = rows.every((row) => row.status === 'pending')
  return (
    <div className={`board-missions${pending ? ' board-missions-pending' : ''}`}>
      <p className="board-section-title">✏️ 수정 미션</p>
      <ol>
        {rows.map((row, index) => (
          <li className="board-mission-row" key={index}>
            <span className="board-mission-number" aria-hidden="true">
              {String.fromCodePoint(0x2460 + index)}
            </span>
            <span className="board-mission-text">
              {row.title ? `${row.title} — ` : ''}
              {row.instruction}
            </span>
            <Mark marks={MISSION_MARKS} value={row.status} className="mission-mark" />
          </li>
        ))}
      </ol>
    </div>
  )
}

export function RevisionBoard({ genre, rounds }) {
  const hasRubric = rounds.some((round) => getRubricRows(genre, round, null).length > 0)

  return (
    <div className="board">
      {/* Scrollable region: focusable so the cards can be reached with the
          keyboard alone once the track overflows. */}
      <div className="board-track" tabIndex={0} role="group" aria-label="수정 라운드">
        {rounds.map((round, index) => {
          const previousRound = index > 0 ? rounds[index - 1] : null
          const nextRound = index < rounds.length - 1 ? rounds[index + 1] : null
          const isLatest = index === rounds.length - 1
          const rubricRows = getRubricRows(genre, round, previousRound)
          const missionRows = getMissionRows(round, nextRound)

          return (
            <Fragment key={index}>
              {index > 0 && (
                <span className="board-chevron" aria-hidden="true">
                  ›
                </span>
              )}
              <article className={`board-card${isLatest ? ' board-card-latest' : ''}`}>
                <header className="board-card-title">
                  <h3>
                    {index + 1}차 수정
                    {round.attainmentAfter !== null && round.attainmentAfter !== undefined && (
                      <span className="board-card-attainment"> ({round.attainmentAfter}%)</span>
                    )}
                  </h3>
                  {index === 0 && <span className="board-badge">초안</span>}
                  {isLatest && index > 0 && <span className="board-badge board-badge-latest">최근</span>}
                </header>

                {round.flagged ? (
                  <p className="history-flagged-badge">⚠️ {flagReasonLabel(round.flagReason)}</p>
                ) : (
                  <>
                    {rubricRows.length > 0 && <RubricTable rows={rubricRows} />}
                    {missionRows.length > 0 && <MissionList rows={missionRows} />}
                  </>
                )}

                <div className="board-writing">
                  <p className="board-section-title">📝 글 내용</p>
                  <p className="board-writing-text">
                    {previousRound ? renderWritingDiff(previousRound.writing, round.writing) : round.writing}
                  </p>
                </div>

                <footer className="board-charcount">글자 수 {round.writing.length}자</footer>
              </article>
            </Fragment>
          )
        })}
      </div>

      <div className="board-legend">
        {hasRubric && (
          <div className="board-legend-group">
            <p className="board-legend-title">채점기준표 상태</p>
            <ul>
              {Object.entries(RUBRIC_MARKS).map(([status, mark]) => (
                <li key={status}>
                  <span className={`rubric-mark rubric-mark-${status}`}>{mark.glyph}</span> {mark.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasRubric && (
          <div className="board-legend-group">
            <p className="board-legend-title">변화 표시</p>
            <ul>
              {Object.entries(TREND_MARKS).map(([trend, mark]) => (
                <li key={trend}>
                  <span className={`rubric-trend rubric-trend-${trend}`}>{mark.glyph}</span> {mark.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="board-legend-group">
          <p className="board-legend-title">수정 미션</p>
          <ul>
            {Object.entries(MISSION_MARKS).map(([status, mark]) => (
              <li key={status}>
                {mark.glyph} {mark.label}
              </li>
            ))}
            <li>표시 없음 — 다음 수정에서 확인해요</li>
          </ul>
        </div>
        <div className="board-legend-group">
          <p className="board-legend-title">글 표시</p>
          <ul>
            <li>
              <span className="diff-removed">빨강 취소선</span> 지운 부분
            </li>
            <li>
              <span className="diff-added">파랑 밑줄</span> 추가한 부분
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
