// 보류 2건 비교의 두 번째 묶음: 미션을 받은 뒤 고쳐 쓴 글에서 done 판정까지
// 본다. `npm run smoke`는 첫 회차만 돌리므로 수행 판정이 없다.
//
// 입력은 demo/g6s2-*/의 시범 학생 8명(지어낸 글)이다. 학생마다 1회차 글로
// 미션을 받고, 2회차 글을 "고친 글"로 넣어 그 미션의 done/partial/not-done을
// 받는다. 학생은 미션 3개를 모두 고른 것으로 친다.
// ⚠️ 2회차 글은 개편 전 미션을 보고 쓴 글이다. 그래서 done 비율은 "새 미션의
// 품질"이 아니라 "같은 퇴고를 두고 옵션마다 낸 미션이 어떻게 판정되는지"를
// 보여 줄 뿐이다.
//
// DB는 건드리지 않는다. getRubricCoachingFeedback를 직접 부른다.
//
//   node scripts/compare-feedback-holds-rounds.js [--concurrency 4]
//
// ⚠️ 유료(gemini-3.8-flash). 8명 × 4조합 × 2회차, 대략 150번 안팎.

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import {
  callGeminiJson,
  getRubricCoachingFeedback,
  getUnitCoachingSpec,
  missionCoreProblems,
} from '../lib/coaching.js'
import { summarizeWritingChanges } from '../lib/interviewRound.js'

dotenv.config({ path: '.env.local', quiet: true })
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY가 없습니다.')

const concurrencyIndex = process.argv.indexOf('--concurrency')
const CONCURRENCY = concurrencyIndex > 0 ? Number(process.argv[concurrencyIndex + 1]) : 4

const COMBOS = [
  { allMet: 'A', checks: 'B' },
  { allMet: 'A', checks: 'C' },
  { allMet: 'B', checks: 'B' },
  { allMet: 'B', checks: 'C' },
]

async function loadStudents() {
  const students = []
  for (const dir of (await fs.readdir('demo')).sort()) {
    if (!dir.startsWith('g6s2-')) continue
    for (const file of (await fs.readdir(path.join('demo', dir))).sort()) {
      if (!file.endsWith('.json')) continue
      const state = JSON.parse(await fs.readFile(path.join('demo', dir, file), 'utf8'))
      if (!getUnitCoachingSpec(state.unitId) || state.rounds.length < 2) continue
      students.push({
        unitId: state.unitId,
        id: `${state.unitId}/${state.student}`,
        topic: state.topic ?? null,
        writings: state.rounds.map((round) => round.writing),
      })
    }
  }
  return students
}

// 회차마다 거절된 응답의 사유와 본문을 모은다. 동시에 여러 회차를 돌리므로
// console.error를 가로채지 않고 callJson을 감싼다.
function recordingCallJson(log) {
  return (args) => callGeminiJson({
    ...args,
    validate: (result) => {
      try {
        return args.validate(result)
      } catch (error) {
        log.push({ reason: error.message, response: result })
        throw error
      }
    },
  })
}

async function round(spec, { topic, writing, previousWriting, previousMissions, priorRounds }, combo) {
  const rejected = []
  const startedAt = Date.now()
  try {
    const result = await getRubricCoachingFeedback({
      spec,
      topic,
      writing,
      previousWriting,
      previousMissions,
      priorRounds,
      changes: previousWriting ? summarizeWritingChanges(previousWriting, writing) : undefined,
      callJson: recordingCallJson(rejected),
      allMetMissions: combo.allMet,
      missionChecks: combo.checks,
    })
    return {
      ok: true,
      ms: Date.now() - startedAt,
      rejected,
      ...result,
      coreProblems: (result.missions ?? []).map((mission) => missionCoreProblems(mission)),
    }
  } catch (error) {
    return { ok: false, ms: Date.now() - startedAt, rejected, error: error.message }
  }
}

async function runStudent(student, combo) {
  const spec = getUnitCoachingSpec(student.unitId)
  const first = await round(spec, { topic: student.topic, writing: student.writings[0] }, combo)
  if (!first.ok || first.meaningless) return { first }
  // 저장 모양 그대로: 미션은 id·제목·설명·확인 기준을 가진 객체.
  const missions = first.missions ?? []
  const second = await round(spec, {
    topic: student.topic,
    writing: student.writings[1],
    previousWriting: student.writings[0],
    previousMissions: missions,
    priorRounds: [{ assessments: first.assessments }],
  }, combo)
  return { first, second, selectedMissionIds: missions.map((mission) => mission.id) }
}

const students = await loadStudents()
const tasks = students.flatMap((student) => COMBOS.map((combo) => ({ student, combo })))
const results = []
let next = 0
let done = 0
async function worker() {
  while (next < tasks.length) {
    const task = tasks[next]
    next += 1
    const outcome = await runStudent(task.student, task.combo)
    results.push({ studentId: task.student.id, unitId: task.student.unitId, combo: task.combo, writings: task.student.writings.slice(0, 2), ...outcome })
    done += 1
    process.stdout.write(`\r${done}/${tasks.length}`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const outDir = path.resolve('.smoke-results')
await fs.mkdir(outDir, { recursive: true })
const outPath = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-holds-rounds.json`)
await fs.writeFile(outPath, JSON.stringify({ students: students.length, results }, null, 2), 'utf8')
console.log(`\n결과: ${outPath}`)
