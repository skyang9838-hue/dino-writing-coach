import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import { getInterviewReportFeedback } from '../lib/coaching.js'
import { summarizeWritingChanges } from '../lib/interviewRound.js'
import {
  aggregateEvalResults,
  evaluateThresholds,
  parseEvalArgs,
  scoreAssessmentCase,
  scoreMissionCase,
  scoreProgressionCase,
} from '../lib/interviewEval.js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const options = parseEvalArgs(process.argv.slice(2))
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY가 없어 실제 Gemini 평가를 실행할 수 없습니다.')
}

const fixturePath = path.resolve('evals', 'interview-report', `${options.set}.json`)
const allFixtures = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const fixtures = options.caseId
  ? allFixtures.filter((fixture) => fixture.id === options.caseId)
  : allFixtures
if (options.caseId && fixtures.length === 0) {
  throw new Error(`평가 사례를 찾을 수 없음: ${options.caseId}`)
}
const results = []

function assessmentSignature(result) {
  return [
    String(result.meaningless),
    ...result.assessments.map((assessment) => `${assessment.criterionId}:${assessment.status}`),
  ].join('|')
}

for (const fixture of fixtures) {
  for (let run = 1; run <= options.runs; run += 1) {
    process.stdout.write(`[${fixture.id}] ${run}/${options.runs} `)
    try {
      const result = await getInterviewReportFeedback({
        topic: '면담 보고서 쓰기',
        writing: fixture.writing,
        previousWriting: fixture.previousWriting,
        previousMissions: fixture.previousMissions,
        priorRounds: fixture.priorRounds,
        changes: summarizeWritingChanges(fixture.previousWriting, fixture.writing),
      })
      const assessment = scoreAssessmentCase(fixture.expected, {
        meaningless: result.meaningless,
        criteria: result.assessments,
      })
      const missionViolations = result.meaningless ? [] : scoreMissionCase(fixture, result)
      const progression = scoreProgressionCase(fixture, result)
      const progressionFailures = progression?.failures ?? []
      results.push({
        caseId: fixture.id,
        run,
        assessment,
        signature: assessmentSignature(result),
        missionViolations,
        progressionFailures,
        meaningful: !result.meaningless,
        missionCount: result.missions.length,
        terminalState: Object.hasOwn(result, 'complete'),
        actual: result,
      })
      const caseAgreement = assessment.total ? assessment.matches / assessment.total : 0
      process.stdout.write(`판정 ${(caseAgreement * 100).toFixed(1)}%`)
      if (missionViolations.length) {
        process.stdout.write(` · 미션 위반 ${missionViolations.join(', ')}`)
      }
      if (progressionFailures.length) {
        process.stdout.write(` · 누적 달성도 오류 ${progressionFailures.join(', ')}`)
      }
      process.stdout.write('\n')
    } catch (error) {
      results.push({
        caseId: fixture.id,
        run,
        assessment: {
          matches: 0,
          total: fixture.expected.criteria.length,
          meaninglessMatch: false,
          hallucinatedMet: 0,
          contradictions: 0,
          schemaValid: false,
        },
        signature: `error:${error.message}`,
        progressionFailures: fixture.expected.meaningless
          ? []
          : ['누적 달성도를 계산하지 못함'],
        missionViolations: ['Gemini 호출 또는 응답 검증 실패'],
        meaningful: !fixture.expected.meaningless,
        missionCount: 0,
        terminalState: false,
        error: error.message,
      })
      process.stdout.write(`실패: ${error.message}\n`)
    }
  }
}

const metrics = aggregateEvalResults(results)
const failures = evaluateThresholds(metrics, options)
const percent = (value) => `${(value * 100).toFixed(1)}%`

console.log('\n=== 면담 보고서 Gemini 평가 ===')
console.log(`평가셋: ${options.set} · 사례: ${fixtures.length} · 반복: ${options.runs}`)
console.log(`판정 일치율: ${percent(metrics.agreement)}`)
console.log(`JSON 스키마 성공률: ${percent(metrics.schemaRate)}`)
console.log(`판정 안정성: ${percent(metrics.stability)}`)
console.log(`무의미 글 판별: ${percent(metrics.meaninglessRate)}`)
console.log(`글에 없는 충족 추측: ${metrics.hallucinatedMet}`)
console.log(`논리 모순: ${metrics.contradictions}`)
console.log(`수정미션 위반: ${metrics.missionViolations}`)
console.log(`의미 있는 글의 수정미션 2개 생성률: ${percent(metrics.twoMissionRate)}`)
console.log(`종료 상태 생성: ${metrics.terminalStates}`)
console.log(failures.length ? `실패 조건: ${failures.join(', ')}` : '모든 종료 조건 통과')

console.log(`누적 달성도 오류: ${metrics.progressionFailures}`)

const reportDir = path.resolve('.eval-results', 'interview-report')
await fs.mkdir(reportDir, { recursive: true })
const timestamp = new Date().toISOString().replaceAll(':', '-')
const reportPath = path.join(reportDir, `${timestamp}-${options.set}.json`)
await fs.writeFile(reportPath, JSON.stringify({ options, metrics, failures, results }, null, 2))
console.log(`상세 결과: ${reportPath}`)

if (failures.length) process.exitCode = 1
