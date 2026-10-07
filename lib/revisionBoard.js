import { getUnitChunks, showsAiVerdict } from './curriculum.js'
import { getVisibleMissions } from './feedback.js'
import { STATUS_ORDER } from './assessmentRatchet.js'

// Shared by the teacher's revision board: everything it needs to render a
// round is already stored on the round itself (lib/interviewRound.js), so
// these are pure reshaping functions over saved data — no DB, no AI.

export function getTrend(previousStatus, status) {
  const previousRank = STATUS_ORDER[previousStatus]
  const rank = STATUS_ORDER[status]
  if (previousRank === undefined || rank === undefined) return null
  if (rank > previousRank) return 'up'
  if (rank < previousRank) return 'down'
  return 'same'
}

const statusOf = (round, criterionId) =>
  round?.assessments?.find((assessment) => assessment.criterionId === criterionId)?.status ?? null

// The unit's criteria grouped by chunk, in the curriculum's own order so every
// card reads the same. Units without criteria (and rounds saved before the
// interview-report pilot, which have no assessments at all) get no table.
//
// Teacher-judged criteria are listed but never looked up: the board is
// read-only and there is nowhere for a teacher verdict to be stored, so they
// always render as —. Only `evaluator: 'ai'` rows consult round.assessments.
//
// That includes `teacher-ai-feedback` rows, which the AI *does* judge — the
// verdict is there in round.assessments, it just drives the missions and never
// the screen, because on those criteria the teacher's call is the one that
// counts. showsAiVerdict is the single place that decides this.
export function getChunkRows(unitId, round, previousRound) {
  const chunks = getUnitChunks(unitId)
  if (!chunks || !Array.isArray(round?.assessments)) return []

  return chunks.map((chunk) => ({
    id: chunk.id,
    label: chunk.label,
    rows: chunk.criteria.map((criterion) => {
      const label = criterion.shortLabel ?? criterion.label
      if (!showsAiVerdict(criterion)) {
        return { id: criterion.id, label, evaluator: criterion.evaluator, status: null, trend: null }
      }

      const status = statusOf(round, criterion.id)
      return {
        id: criterion.id,
        label,
        evaluator: 'ai',
        status,
        trend: getTrend(statusOf(previousRound, criterion.id), status),
      }
    }),
  }))
}

// The missions handed out in this round, each carrying the verdict the *next*
// round passed on it. The latest round has no verdict yet — that's `pending`,
// not a failure.
export function getMissionRows(round, nextRound) {
  const missions = round?.missions ?? round?.improvements
  if (!Array.isArray(missions) || missions.length === 0) return []

  return getVisibleMissions(round).map((mission, index) => {
    const missionId = round.missions?.[index]?.id
    const status =
      nextRound?.priorMissionStatuses?.find((prior) => prior.missionId === missionId)?.status ??
      legacyStatus(nextRound?.addressed?.[index])

    return { title: mission.title, instruction: mission.instruction, status }
  })
}

// Rounds recorded before priorMissionStatuses existed stored a boolean per
// mission position instead.
function legacyStatus(addressed) {
  if (addressed === true) return 'done'
  if (addressed === false) return 'not-done'
  return 'pending'
}

// 보드는 최신 회차를 맨 왼쪽에 두고, 그 오른쪽부터 1차·2차·3차로 이어 간다.
// 선생님이 가장 자주 보는 것은 "지금 어디까지 왔나"인데 예전 배치에서는
// 그게 트랙 맨 끝이라 회차가 다섯을 넘으면 매번 끝까지 밀어야 했다.
//
// 원래 순번을 함께 돌려준다. 카드 제목(N차 수정), 초안 배지, diff의 기준이
// 되는 직전 회차가 전부 이 번호로 읽히기 때문에, 재배열된 자리 번호로
// 대신하면 보드 전체가 한 칸씩 어긋난다.
export function orderRoundsLatestFirst(rounds) {
  const entries = rounds.map((round, originalIndex) => ({ round, originalIndex }))
  if (entries.length <= 1) return entries
  return [entries.at(-1), ...entries.slice(0, -1)]
}
