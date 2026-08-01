import { getRubricsForGenre } from './curriculum.js'
import { getVisibleMissions } from './feedback.js'

// Shared by the teacher's revision board: everything it needs to render a
// round is already stored on the round itself (lib/interviewRound.js), so
// these are pure reshaping functions over saved data — no DB, no AI.

// Ordering only. computeRubricAttainment (lib/attainment.js) scores the same
// three statuses; that's a percentage for teacher analysis, this is "did it
// get better or worse than last round".
const RUBRIC_STATUS_RANK = {
  unmet: 0,
  partial: 1,
  met: 2,
}

export function getTrend(previousStatus, status) {
  const previousRank = RUBRIC_STATUS_RANK[previousStatus]
  const rank = RUBRIC_STATUS_RANK[status]
  if (previousRank === undefined || rank === undefined) return null
  if (rank > previousRank) return 'up'
  if (rank < previousRank) return 'down'
  return 'same'
}

const statusOf = (round, criterionId) =>
  round?.assessments?.find((assessment) => assessment.criterionId === criterionId)?.status ?? null

// One row per rubric criterion, in the curriculum's own order so the table
// reads the same across every card. Genres without a rubric (and rounds saved
// before the interview-report pilot) get no table at all.
export function getRubricRows(genre, round, previousRound) {
  const rubrics = getRubricsForGenre(genre)
  if (!rubrics || !Array.isArray(round?.assessments)) return []

  return rubrics.flatMap((rubric) =>
    rubric.criteria.map((criterion) => {
      const status = statusOf(round, criterion.id)
      return {
        id: criterion.id,
        label: criterion.shortLabel ?? criterion.label,
        status,
        trend: getTrend(statusOf(previousRound, criterion.id), status),
      }
    }),
  )
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
