import { Fragment } from 'react'
import { diffWords } from 'diff'
import { getUnitStandard } from '../lib/curriculum.js'
import { getChunkRows, getMissionRows } from '../lib/revisionBoard.js'
import { BoardTrack } from './BoardTrack.jsx'

// The teacher's read-only view of one student's revisions, laid out as cards
// side by side so a round can be compared with the ones around it. Everything
// shown is already stored on the round (lib/interviewRound.js) — this renders
// saved data and asks nothing of the AI.
//
// The criteria only appear for units that have them (the interview report
// pilot); every other unit still gets the missions, the diff and the
// character count. The student's own screen keeps components/RevisionHistory
// .jsx — same rounds, but stacked and written for the student.
//
// The achievement standard sits above the track, once — it is the same for
// every round, so repeating it on each card would just cost width.
//
// Card titles count revisions from 1, so the first coaching round reads
// "1차 수정" with a 초안 badge. The student screen calls that same round 초안.

// Deliberately hedged. These used to be the circle/triangle/cross a teacher
// writes when a grade is settled, but the judgement behind them is the AI's,
// and it is demonstrably noisy — the same writing assessed twice came back
// different. The glyphs and their labels now claim only as much certainty as
// the assessment actually has.
const RUBRIC_MARKS = {
  met: { glyph: '✓', label: '충족으로 보임' },
  partial: { glyph: '?', label: '판단이 애매함' },
  unmet: { glyph: '✕', label: '확인 안 됨' },
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

// Teacher-judged criteria have no verdict to show. The board is read-only, so
// this is the whole of their state — it is not a placeholder for something
// that arrives later.
const NOT_APPLICABLE = { glyph: '—', label: '선생님이 직접 확인해요' }

const EVALUATOR_BADGES = {
  ai: { text: 'AI', label: '디노가 판정한 항목' },
  teacher: { text: '교사', label: '선생님이 직접 확인하는 항목' },
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

function EvaluatorBadge({ evaluator }) {
  const badge = EVALUATOR_BADGES[evaluator]
  if (!badge) return <span className="evaluator-badge evaluator-badge-none" aria-hidden="true" />
  return (
    <span className={`evaluator-badge evaluator-badge-${evaluator}`} title={badge.label}>
      {badge.text}
    </span>
  )
}

function CriterionRow({ row, index }) {
  const isAi = row.evaluator === 'ai'
  return (
    <li className="board-criterion-row">
      <span className="board-criterion-number" aria-hidden="true">
        {index + 1}
      </span>
      <span className="board-criterion-label">{row.label}</span>
      {isAi ? (
        <Mark marks={RUBRIC_MARKS} value={row.status} className="rubric-mark" />
      ) : (
        <span className="rubric-mark rubric-mark-na" title={NOT_APPLICABLE.label} aria-label={NOT_APPLICABLE.label} role="img">
          {NOT_APPLICABLE.glyph}
        </span>
      )}
      <Mark marks={TREND_MARKS} value={isAi ? row.trend : null} className="rubric-trend" />
      <EvaluatorBadge evaluator={row.evaluator} />
    </li>
  )
}

function ChunkSections({ chunks }) {
  return (
    <div className="board-chunks">
      <p className="board-section-title">
        📋 채점기준
        <span className="board-rubric-caption-note">AI 판정은 선생님 확정 채점이 아니에요</span>
      </p>
      {chunks.map((chunk) => (
        <section
          className={`board-chunk${chunk.rows.every((row) => row.evaluator !== 'ai') ? ' board-chunk-teacher' : ''}`}
          key={chunk.id}
        >
          <h4 className="board-chunk-title">{chunk.label}</h4>
          <ol className="board-criterion-list">
            {chunk.rows.map((row, index) => (
              <CriterionRow index={index} key={row.id} row={row} />
            ))}
          </ol>
        </section>
      ))}
    </div>
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

export function RevisionBoard({ unitId, rounds }) {
  const hasRubric = rounds.some((round) => getChunkRows(unitId, round, null).length > 0)
  const standard = hasRubric ? getUnitStandard(unitId) : null

  return (
    <div className="board">
      {standard && (
        <details className="board-standard">
          <summary>
            성취기준 <strong>[{standard.code}]</strong>
          </summary>
          <p className="board-standard-text">{standard.text}</p>
        </details>
      )}

      {/* Scrollable region: focusable so the cards can be reached with the
          keyboard alone once the track overflows, and draggable so the
          teacher never has to hunt for the scrollbar below the cards. */}
      <BoardTrack>
        {rounds.map((round, index) => {
          const previousRound = index > 0 ? rounds[index - 1] : null
          const nextRound = index < rounds.length - 1 ? rounds[index + 1] : null
          const isLatest = index === rounds.length - 1
          const chunks = getChunkRows(unitId, round, previousRound)
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
                    {chunks.length > 0 && <ChunkSections chunks={chunks} />}
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
      </BoardTrack>

      <div className="board-legend">
        {hasRubric && (
          <div className="board-legend-group">
            <p className="board-legend-title">AI 판정 표시</p>
            <ul>
              {Object.entries(RUBRIC_MARKS).map(([status, mark]) => (
                <li key={status}>
                  <span className={`rubric-mark rubric-mark-${status}`}>{mark.glyph}</span> {mark.label}
                </li>
              ))}
              <li>
                <span className="rubric-mark rubric-mark-na">{NOT_APPLICABLE.glyph}</span> 해당 없음
              </li>
            </ul>
          </div>
        )}
        {hasRubric && (
          <div className="board-legend-group">
            <p className="board-legend-title">평가 주체</p>
            <ul>
              {Object.entries(EVALUATOR_BADGES).map(([evaluator, badge]) => (
                <li key={evaluator}>
                  <span className={`evaluator-badge evaluator-badge-${evaluator}`}>{badge.text}</span> {badge.label}
                </li>
              ))}
              <li>교사 항목은 판정을 저장하지 않아요</li>
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
              <li>지난 회차의 AI 판정과 견준 것이에요</li>
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
