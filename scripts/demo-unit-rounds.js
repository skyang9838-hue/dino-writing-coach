// 한 학생이 한 단원에서 코칭을 여러 라운드 받는 과정을 실제로 돌려 본다.
//
// `npm run smoke`와 다른 물건이다. 스모크는 글 한 편을 한 번 판정해 보고
// "이 단원이 돌기는 도는가"만 본다. 이건 코칭을 받고 → 글을 고치고 → 다시
// 받는 흐름을 그대로 재현해서, 미션이 실제로 학생을 움직이는지·도달도가
// 어떻게 쌓이는지를 남긴다. 남을 보여 줄 예시를 만드는 데 쓴다.
//
// 라운드 사이에 글을 고치는 것은 사람(또는 학생 역할을 맡은 에이전트)이다.
// 그래서 한 번에 한 라운드만 돌리고 상태를 --state 파일에 적어 둔다. 다음
// 라운드는 고친 글을 --writing으로 주고 같은 --state를 가리키면 이어진다.
//
// DB는 건드리지 않는다. lib/actions.js의 runRubricRound가 하는 일 가운데
// prisma.submission.update만 빼고 그대로 한다 — .env.local의 DATABASE_URL이
// 프로덕션 Neon을 가리키기 때문에 이게 중요하다.
//
//   node scripts/demo-unit-rounds.js --unit g6s2-unit6 \
//     --student 지민 --topic "경험을 떠올리며 이야기 바꾸어 쓰기" \
//     --writing demo/g6s2-unit6/지민-1.txt \
//     --state demo/g6s2-unit6/지민.json

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import { getRubricCoachingFeedback, getUnitCoachingSpec } from '../lib/coaching.js'
import { getUnitById, getUnitChunks, showsAiVerdict } from '../lib/curriculum.js'
import { buildInterviewRoundState, summarizeWritingChanges } from '../lib/interviewRound.js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

export function parseDemoArgs(args) {
  const options = {}
  const known = ['--unit', '--writing', '--state', '--topic', '--student']
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (!known.includes(flag)) throw new Error(`알 수 없는 옵션: ${flag}`)
    const value = args[index + 1]
    if (value === undefined) throw new Error(`${flag}에 값이 없습니다`)
    options[flag.slice(2)] = value
    index += 1
  }
  for (const required of ['unit', 'writing', 'state']) {
    if (!options[required]) throw new Error(`--${required}는 필수입니다`)
  }
  return options
}

const STATUS_MARK = { met: '○ met', partial: '◐ partial', unmet: '✗ unmet' }

// done만 도달도 +10%다. partial은 가산이 없으므로 화면에서도 구분해서 보여야
// "고치긴 했는데 점수가 안 올랐다"는 대목이 드러난다.
const PRIOR_MISSION_MARK = {
  done: '✓ done',
  partial: '◐ partial',
  'not-done': '✗ not-done',
}

// 기준 id로 채점기준 정의를 되찾는다. 판정 결과에는 id만 들어 있어서, 사람이
// 읽을 라벨과 "이게 보드에 뜨는 판정인가"는 교육과정 쪽에서 가져와야 한다.
function criterionIndex(unitId) {
  const index = new Map()
  for (const chunk of getUnitChunks(unitId) ?? []) {
    for (const criterion of chunk.criteria) {
      index.set(criterion.id, { ...criterion, chunkLabel: chunk.label })
    }
  }
  return index
}

async function loadState(statePath, options) {
  try {
    return JSON.parse(await fs.readFile(statePath, 'utf8'))
  } catch {
    return {
      unitId: options.unit,
      student: options.student ?? '학생',
      topic: options.topic ?? null,
      attainment: null,
      rounds: [],
      lastSubmittedWriting: null,
      lastImprovements: [],
    }
  }
}

function printRound(state, roundState, { unit, index, writing, previousWriting, changes }) {
  const roundNumber = roundState.rounds.length
  const label = unit.unitLabel ?? `${unit.unitNumber}단원`
  console.log(`\n${'━'.repeat(64)}`)
  console.log(`${label} ${unit.title} · ${state.student} · ${roundNumber}라운드`)

  const delta = previousWriting ? writing.length - previousWriting.length : null
  console.log(
    `글 ${writing.length}자`
    + (delta === null ? '' : ` (지난 라운드 ${delta >= 0 ? '+' : ''}${delta}자)`),
  )
  if (changes?.added?.trim()) {
    const added = changes.added.replace(/\s+/g, ' ').trim()
    console.log(`덧붙인 말: ${added.length > 120 ? `${added.slice(0, 120)}…` : added}`)
  }

  const priorStatuses = roundState.feedback.priorMissionStatuses ?? []
  if (priorStatuses.length) {
    console.log('\n지난 미션')
    for (const status of priorStatuses) {
      const mission = state.lastImprovements.find((m) => m.id === status.missionId)
      // done / partial / not-done 세 값이다. 도달도는 done만 +10%로 세지만
      // (lib/attainment.js), 여기서 partial을 not-done으로 뭉개면 "고치긴
      // 고쳤는데 점수가 안 올랐다"는 대목이 데모에서 사라진다.
      const mark = PRIOR_MISSION_MARK[status.status] ?? status.status
      console.log(`  ${mark.padEnd(10)} ${mission?.title ?? status.missionId}`)
    }
  }

  const before = state.attainment ?? '—'
  console.log(
    `\n도달도  ${before} → ${roundState.attainment}%`
    + `   (채점기준 실제 충족도 ${roundState.actualAttainment}%)`,
  )

  console.log('\n채점기준')
  for (const assessment of roundState.feedback.assessments) {
    const criterion = index.get(assessment.criterionId)
    const hidden = criterion && !showsAiVerdict(criterion) ? '  ← 보드엔 —(선생님이 판정)' : ''
    const mark = (STATUS_MARK[assessment.status] ?? assessment.status).padEnd(10)
    console.log(`  [${mark}] ${criterion?.shortLabel ?? assessment.criterionId}${hidden}`)
  }

  console.log(`\n잘한 점\n  ${roundState.feedback.strength}`)

  console.log('\n이번 수정 미션')
  roundState.feedback.missions.forEach((mission, order) => {
    console.log(`  ${order + 1}. [${(mission.criterionIds ?? []).join('+')}] ${mission.title}`)
    console.log(`     ${mission.instruction}`)
  })
}

const options = parseDemoArgs(process.argv.slice(2))
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY가 없어 실제 Gemini 호출을 할 수 없습니다.')
}

const unit = getUnitById(options.unit)
if (!unit) throw new Error(`그런 단원이 없습니다: ${options.unit}`)
const spec = getUnitCoachingSpec(options.unit)
if (!spec) throw new Error(`${options.unit}에는 AI 채점기준이 없습니다.`)

const index = criterionIndex(options.unit)
const statePath = path.resolve(options.state)
const state = await loadState(statePath, options)
const writing = (await fs.readFile(path.resolve(options.writing), 'utf8')).trim()

const previousWriting = state.lastSubmittedWriting
if (previousWriting === writing) {
  throw new Error('글이 지난 라운드와 한 글자도 다르지 않습니다 — 고쳐서 다시 주세요.')
}
const changes = summarizeWritingChanges(previousWriting, writing)

const result = await getRubricCoachingFeedback({
  spec,
  topic: state.topic,
  writing,
  previousWriting,
  previousMissions: state.lastImprovements ?? [],
  priorRounds: state.rounds,
  changes,
})

if (result.meaningless) {
  console.log('\n⚠️  디노가 이 글을 무의미한 글로 판정했습니다 — 라운드가 기록되지 않습니다.')
  process.exit(1)
}

const roundState = buildInterviewRoundState({
  submission: { attainment: state.attainment, rounds: state.rounds },
  writing,
  result,
})

printRound(state, roundState, { unit, index, writing, previousWriting, changes })

const nextState = {
  ...state,
  attainment: roundState.attainment,
  rounds: roundState.rounds,
  lastSubmittedWriting: writing,
  lastImprovements: roundState.lastImprovements,
}
await fs.mkdir(path.dirname(statePath), { recursive: true })
await fs.writeFile(statePath, JSON.stringify(nextState, null, 2), 'utf8')
console.log(`\n상태: ${statePath}`)
