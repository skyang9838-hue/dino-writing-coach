// 단원 채점기준 코칭을 Gemini에 실제로 태워 보는 스모크 러너.
//
// `npm run eval`과 다른 물건이다. eval은 정답표를 두고 일치율로 게이트를 거는
// 품질 평가고, 이건 정답표 없이 "이 단원이 돌기는 도는가, 판정이 말이 되는가"만
// 본다. 새 단원을 넣었을 때 제일 먼저 돌리는 것.
//
// DB는 건드리지 않는다. getUnitCoachingSpec과 getRubricCoachingFeedback를 직접
// 부르므로 활동도 제출물도 만들지 않는다 — .env.local의 DATABASE_URL이 프로덕션
// Neon을 가리키기 때문에 이게 중요하다. .env.local에서 읽는 건 GEMINI_API_KEY뿐.
//
//   npm run smoke                        AI 채점기준이 있는 단원 전부, 1회씩
//   npm run smoke -- --runs 3            같은 글을 3번 돌려 판정 흔들림 측정
//   npm run smoke -- --unit g6s2-unit6   한 단원만
//   npm run smoke -- --case story-jumpy  한 케이스만

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import { getRubricCoachingFeedback, getUnitCoachingSpec } from '../lib/coaching.js'
import { GRADE6_SEMESTER2_UNITS, getUnitChunks } from '../lib/curriculum.js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

// callGeminiJson only reports rejected responses when this is on, and the
// retry count is one of the things we came here to measure. It is read per
// call, so setting it here is enough.
process.env.DEBUG_INTERVIEW_PROMPT = '1'

// Small and local rather than reusing lib/interviewEval.js's parseEvalArgs —
// that one takes --set/--runs/--case, this takes --unit.
export function parseSmokeArgs(args) {
  const options = { runs: 1 }
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (flag === '--unit') {
      options.unitId = args[index + 1]
      index += 1
    } else if (flag === '--runs') {
      options.runs = Number(args[index + 1])
      index += 1
    } else if (flag === '--case') {
      options.caseId = args[index + 1]
      index += 1
    } else {
      throw new Error(`알 수 없는 옵션: ${flag}`)
    }
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error('--runs는 1 이상의 정수여야 합니다')
  }
  return options
}

const criteriaOf = (unitId, evaluator) =>
  (getUnitChunks(unitId) ?? [])
    .flatMap((chunk) => chunk.criteria)
    .filter((criterion) => criterion.evaluator === evaluator)
    .map((criterion) => criterion.id)

// callGeminiJson logs one line per rejected response when DEBUG_INTERVIEW_PROMPT
// is on. Counting those tells us how close a unit's prompt runs to exhausting
// its retries — a prompt that only ever passes on the third try is one bad day
// from failing outright, and the reasons say which rule it keeps breaking.
function captureRetries() {
  const original = console.error
  const reasons = []
  const rejected = []
  console.error = (...args) => {
    const first = typeof args[0] === 'string' ? args[0] : ''
    if (first.startsWith('Gemini JSON validation failed:')) {
      reasons.push(args.slice(1).join(' ').trim() || first)
      return
    }
    // 거절된 응답 본문. 사유만으로는 어느 제목이 규칙에 걸렸는지 알 수 없다.
    try {
      rejected.push(JSON.parse(first))
    } catch {
      rejected.push(first)
    }
  }
  return {
    reasons,
    rejected,
    restore: () => { console.error = original },
  }
}

function checkRun(result, { spec, teacherOnly, advisory }) {
  const problems = []
  const ids = (result.assessments ?? []).map((assessment) => assessment.criterionId)

  // 방화벽. 유닛 테스트는 교사 전용 기준이 프롬프트에 안 들어가는 것까지만
  // 확인한다. 여기서는 모델이 실제로 그 이름을 만들어내지 않는지를 본다.
  const leaked = ids.filter((id) => teacherOnly.includes(id))
  if (leaked.length) problems.push(`교사 전용 기준이 응답에 섞임: ${leaked.join(', ')}`)

  // 반대 방향. 조언용 기준은 AI가 봐야 정상이다 — 사라지면 그 항목에 관한
  // 미션이 영영 안 나온다.
  const missingAdvisory = advisory.filter((id) => !ids.includes(id))
  if (missingAdvisory.length) problems.push(`조언용 기준이 판정에서 빠짐: ${missingAdvisory.join(', ')}`)

  if (!result.meaningless) {
    if (ids.length !== spec.criterionCount) {
      problems.push(`판정 개수 ${ids.length}, 기대 ${spec.criterionCount}`)
    }
    if ((result.missions ?? []).length !== 2) {
      problems.push(`수정미션 ${result.missions?.length ?? 0}개 (항상 2개여야 함)`)
    }
    const aiIds = spec.rubrics.flatMap((rubric) => rubric.criteria.map((c) => c.id))
    for (const mission of result.missions ?? []) {
      const off = (mission.criterionIds ?? []).filter((id) => !aiIds.includes(id))
      if (off.length) problems.push(`미션이 모르는 기준을 가리킴: ${off.join(', ')}`)
    }
  }
  return problems
}

async function runCase(spec, testCase, runs, context) {
  const runResults = []
  for (let run = 1; run <= runs; run += 1) {
    process.stdout.write(`    ${run}/${runs} `)
    const capture = captureRetries()
    const startedAt = Date.now()
    try {
      const result = await getRubricCoachingFeedback({
        spec,
        topic: testCase.topic ?? null,
        writing: testCase.writing,
      })
      capture.restore()
      runResults.push({
        ok: true,
        meaningless: result.meaningless,
        assessments: result.assessments,
        strength: result.strength,
        missions: result.missions,
        retries: capture.reasons.length,
        retryReasons: capture.reasons,
        rejected: capture.rejected,
        ms: Date.now() - startedAt,
        problems: checkRun(result, context),
      })
      const last = runResults.at(-1)
      console.log(
        `${last.problems.length ? '✗' : '✓'}`
        + `${last.meaningless ? ' [무의미 판정]' : ''}`
        + `${last.retries ? ` 재시도 ${last.retries}회` : ''}`,
      )
    } catch (error) {
      capture.restore()
      runResults.push({
        ok: false,
        error: error.message,
        retries: capture.reasons.length,
        retryReasons: capture.reasons,
        rejected: capture.rejected,
        ms: Date.now() - startedAt,
        problems: [`파이프라인 실패: ${error.message}`],
      })
      console.log(`✗ ${error.message}`)
    }
  }
  return runResults
}

const statusOf = (run, criterionId) =>
  run.assessments?.find((assessment) => assessment.criterionId === criterionId)?.status ?? '—'

function summarizeCase(testCase, runResults, spec) {
  const criterionIds = spec.rubrics.flatMap((rubric) => rubric.criteria.map((c) => c.id))
  const rows = criterionIds.map((criterionId) => {
    const statuses = runResults.filter((run) => run.ok).map((run) => statusOf(run, criterionId))
    const distinct = [...new Set(statuses)]
    const intended = testCase.intended?.[criterionId] ?? null
    return {
      기준: criterionId,
      의도: intended ?? '(없음)',
      판정: statuses.join(' / ') || '(실패)',
      일치: intended ? (distinct.length === 1 && distinct[0] === intended ? '○' : '✗') : '—',
      흔들림: distinct.length > 1 ? `${distinct.length}가지` : '',
    }
  })
  return rows
}

const options = parseSmokeArgs(process.argv.slice(2))
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY가 없어 실제 Gemini 호출을 할 수 없습니다.')
}

const targetUnits = GRADE6_SEMESTER2_UNITS
  .filter((unit) => getUnitCoachingSpec(unit.id))
  .filter((unit) => !options.unitId || unit.id === options.unitId)

if (targetUnits.length === 0) {
  throw new Error(`AI 채점기준이 있는 단원을 찾지 못했습니다: ${options.unitId ?? '(전체)'}`)
}

const report = []
let totalProblems = 0
let totalRuns = 0

for (const unit of targetUnits) {
  const spec = getUnitCoachingSpec(unit.id)
  const fixturePath = path.resolve('evals', 'smoke', `${unit.id}.json`)
  let cases
  try {
    cases = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
  } catch {
    console.log(`\n⚠️  ${unit.id}: 샘플 글이 없습니다 (${fixturePath}) — 건너뜁니다`)
    continue
  }
  if (options.caseId) cases = cases.filter((c) => c.id === options.caseId)
  if (cases.length === 0) continue

  const context = {
    spec,
    teacherOnly: criteriaOf(unit.id, 'teacher'),
    advisory: criteriaOf(unit.id, 'teacher-ai-feedback'),
  }

  console.log(`\n━━━ ${unit.unitLabel ?? `${unit.unitNumber}단원`} · ${unit.title} (${unit.id})`)
  console.log(`    AI 판정 ${spec.criterionCount}개 / 조언용 ${context.advisory.length}개 / 교사 전용 ${context.teacherOnly.length}개`)

  for (const testCase of cases) {
    console.log(`\n  [${testCase.id}] ${testCase.note ?? ''}`)
    const runResults = await runCase(spec, testCase, options.runs, context)
    totalRuns += runResults.length
    const problems = runResults.flatMap((run) => run.problems)
    totalProblems += problems.length
    console.table(summarizeCase(testCase, runResults, spec))
    for (const problem of [...new Set(problems)]) console.log(`    ⚠️  ${problem}`)

    const first = runResults.find((run) => run.ok && !run.meaningless)
    if (first) {
      console.log(`    잘한 점: ${first.strength?.text ?? '(없음)'}`)
      for (const mission of first.missions ?? []) {
        console.log(`    · [${(mission.criterionIds ?? []).join('+')}] ${mission.title} — ${mission.instruction}`)
      }
    }
    report.push({ unitId: unit.id, caseId: testCase.id, intended: testCase.intended, runs: runResults })
  }
}

const outDir = path.resolve('.smoke-results')
await fs.mkdir(outDir, { recursive: true })
const outPath = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
await fs.writeFile(outPath, JSON.stringify({ options, report }, null, 2), 'utf8')

console.log(`\n${'─'.repeat(60)}`)
console.log(`케이스 ${report.length}개 · 호출 ${totalRuns}회 · 문제 ${totalProblems}건`)
console.log(`결과: ${outPath}`)
console.log(
  '\n※ 글도 의도한 판정도 사람이 아니라 이 저장소가 지어낸 것이다. 여기서 맞는다는 것은'
  + '\n  "모델이 글을 의도대로 읽었다"는 뜻이지 선생님이 검증한 정답과 맞다는 뜻이 아니다.',
)
process.exit(totalProblems > 0 ? 1 : 0)
