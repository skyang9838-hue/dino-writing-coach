// 보류 2건 비교표를 만든다. `npm run smoke`를 네 조합으로 돌린 결과
// (.smoke-results/*-allmet{A|B}-checks{B|C}.json, 조합마다 가장 최근 것)를 읽어
// docs/feedback-redesign-holds.md 와 .html 을 쓴다. Gemini는 부르지 않는다.
//
//   for a in A B; do for c in B C; do npm run smoke -- --all-met $a --checks $c; done; done
//   node scripts/analyze-feedback-holds.js
//
// 결정은 하지 않는다. 사용자가 이 표를 보고 고른다.

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const COMBOS = [
  { allMet: 'A', checks: 'B' },
  { allMet: 'A', checks: 'C' },
  { allMet: 'B', checks: 'B' },
  { allMet: 'B', checks: 'C' },
]
const comboName = ({ allMet, checks }) => `미션개수 ${allMet} · 검사 ${checks}`

const resultsDir = path.resolve(process.argv[2] ?? '.smoke-results')
const outDir = path.resolve(process.argv[3] ?? 'docs')

async function loadLatest({ allMet, checks }) {
  const suffix = `-allmet${allMet}-checks${checks}.json`
  const files = (await fs.readdir(resultsDir)).filter((file) => file.endsWith(suffix)).sort()
  if (!files.length) return null
  const file = files.at(-1)
  const data = JSON.parse(await fs.readFile(path.join(resultsDir, file), 'utf8'))
  return { file, ...data }
}

const median = (values) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}
const p90 = (values) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)]
}
const seconds = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`)

function summarize(data) {
  const runs = data.report.flatMap((item) => item.runs.map((run) => ({ ...run, caseId: item.caseId, unitId: item.unitId })))
  const ok = runs.filter((run) => run.ok)
  const meaningful = ok.filter((run) => !run.meaningless)
  const allMetRuns = meaningful.filter((run) => run.allMet)
  const reasons = new Map()
  for (const run of runs) {
    for (const reason of run.retryReasons ?? []) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  }
  const coreHits = new Map()
  let missionsWithCoreHit = 0
  let missionCount = 0
  for (const run of meaningful) {
    for (const problems of run.coreProblems ?? []) {
      missionCount += 1
      if (problems.length) missionsWithCoreHit += 1
      for (const problem of problems) coreHits.set(problem, (coreHits.get(problem) ?? 0) + 1)
    }
  }
  const times = runs.map((run) => run.ms).filter((ms) => typeof ms === 'number')
  return {
    runs: runs.length,
    failed: runs.length - ok.length,
    retried: runs.filter((run) => run.retries > 0).length,
    retries: runs.reduce((sum, run) => sum + (run.retries ?? 0), 0),
    reasons: [...reasons].sort((a, b) => b[1] - a[1]),
    problems: runs.reduce((sum, run) => sum + (run.problems?.length ?? 0), 0),
    allMetRuns: allMetRuns.length,
    allMetCounts: allMetRuns.map((run) => (run.missions ?? []).length),
    missionCount,
    missionsWithCoreHit,
    coreHits: [...coreHits].sort((a, b) => b[1] - a[1]),
    medianMs: median(times),
    p90Ms: p90(times),
    allMetSamples: allMetRuns.map((run) => ({ caseId: run.caseId, strength: run.strength?.text, missions: run.missions ?? [] })),
    coreHitSamples: meaningful.flatMap((run) => (run.missions ?? []).flatMap((mission, index) =>
      (run.coreProblems?.[index] ?? []).length
        ? [{ caseId: run.caseId, title: mission.title, instruction: mission.instruction, problems: run.coreProblems[index] }]
        : [])),
  }
}

const loaded = []
for (const combo of COMBOS) {
  const data = await loadLatest(combo)
  if (!data) {
    console.log(`없음: ${comboName(combo)} — npm run smoke -- --all-met ${combo.allMet} --checks ${combo.checks}`)
    continue
  }
  loaded.push({ combo, file: data.file, options: data.options, stats: summarize(data) })
}
if (!loaded.length) {
  console.error(`${resultsDir}에 보류 비교용 스모크 결과가 없습니다.`)
  process.exit(1)
}

const countText = (counts) => {
  if (!counts.length) return '—'
  const tally = new Map()
  for (const count of counts) tally.set(count, (tally.get(count) ?? 0) + 1)
  return [...tally].sort((a, b) => a[0] - b[0]).map(([count, n]) => `${count}개×${n}`).join(', ')
}
const list = (entries) => entries.length ? entries.map(([text, n]) => `${text} ${n}`).join(' · ') : '없음'

const rows = [
  ['결과 파일', (s, l) => `\`${l.file}\``],
  ['회차(호출 묶음) 수', (s) => s.runs],
  ['5번 재시도 끝에 실패', (s) => s.failed],
  ['재시도가 한 번 이상 있던 회차', (s) => s.retried],
  ['재시도 합계', (s) => s.retries],
  ['재시도 사유', (s) => list(s.reasons)],
  ['스모크 자동 검사 문제', (s) => s.problems],
  ['모두 met으로 판정된 회차', (s) => s.allMetRuns],
  ['그 회차의 미션 개수', (s) => countText(s.allMetCounts)],
  ["최종 미션 중 'B' 핵심 검사에 걸렸을 것", (s) => `${s.missionsWithCoreHit}/${s.missionCount}`],
  ["'B' 사유별", (s) => list(s.coreHits)],
  ['한 회차 시간 (중앙값 / p90)', (s) => `${seconds(s.medianMs)} / ${seconds(s.p90Ms)}`],
]

const header = `| | ${loaded.map((item) => comboName(item.combo)).join(' | ')} |\n|---|${loaded.map(() => '---').join('|')}|`
const table = rows.map(([label, cell]) =>
  `| ${label} | ${loaded.map((item) => String(cell(item.stats, item)).replaceAll('|', '/')).join(' | ')} |`).join('\n')

const samples = loaded.map((item) => {
  const allMet = item.stats.allMetSamples.map((sample) => `- **${sample.caseId}** (미션 ${sample.missions.length}개) 잘한 점: ${sample.strength ?? '—'}\n${sample.missions.map((m) => `  - ${m.title} — ${m.instruction}`).join('\n')}`).join('\n')
  const core = item.stats.coreHitSamples.map((sample) => `- **${sample.caseId}** [${sample.problems.join(', ')}] ${sample.title} — ${sample.instruction}`).join('\n')
  return `### ${comboName(item.combo)}\n\n**모두 met 회차의 미션**\n\n${allMet || '(없음)'}\n\n**'B' 핵심 검사에 걸렸을 최종 미션**\n\n${core || '(없음)'}`
}).join('\n\n')

const md = `# 피드백 개편 보류 2건 비교 (스모크)

> \`scripts/analyze-feedback-holds.js\`가 만든 문서다. 결정은 하지 않는다. 글은 모두 \`evals/smoke/\`의 지어낸 글이고, 모델은 \`gemini-3.8-flash\` 생각 낮게다.

- **보류 ① 모두 met일 때 미션 개수** — A: 3개 고정 / B: 0~3개 (\`ALL_MET_MISSIONS\`)
- **보류 ② 미션 코드 검사** — B: 형식 + 예시 문장·사실 지어내기·막연한 표현(걸리면 재시도) / C: 형식·무결성만 (\`MISSION_CHECKS\`)
- 검사 C로 돌린 결과에도 'B' 잣대를 사후로 대어 "B였다면 걸렸을 미션"을 센다. B로 돌린 결과는 재시도로 걸러진 뒤라 0에 가까운 게 정상이다.
- 기준선(개편 전 2.5-lite, 스펙 5-1절 E0): 30회 중 3회가 5번 재시도 끝에 실패, 14회 재시도, 한 회차 중앙값 4.1s.

## 요약표

${header}
${table}

## 표본

${samples}
`

await fs.mkdir(outDir, { recursive: true })
await fs.writeFile(path.join(outDir, 'feedback-redesign-holds.md'), md, 'utf8')

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
const htmlTable = `<table><thead><tr><th></th>${loaded.map((item) => `<th>${escapeHtml(comboName(item.combo))}</th>`).join('')}</tr></thead><tbody>${
  rows.map(([label, cell]) => `<tr><th>${escapeHtml(label)}</th>${loaded.map((item) => `<td>${escapeHtml(cell(item.stats, item)).replaceAll('`', '')}</td>`).join('')}</tr>`).join('')
}</tbody></table>`
const htmlSamples = loaded.map((item) => `<section><h2>${escapeHtml(comboName(item.combo))}</h2>
<h3>모두 met 회차의 미션</h3>${item.stats.allMetSamples.length ? item.stats.allMetSamples.map((sample) => `<p><b>${escapeHtml(sample.caseId)}</b> (미션 ${sample.missions.length}개) 잘한 점: ${escapeHtml(sample.strength ?? '—')}</p><ol>${sample.missions.map((m) => `<li><b>${escapeHtml(m.title)}</b> — ${escapeHtml(m.instruction)}</li>`).join('')}</ol>`).join('') : '<p>(없음)</p>'}
<h3>'B' 핵심 검사에 걸렸을 최종 미션</h3>${item.stats.coreHitSamples.length ? `<ul>${item.stats.coreHitSamples.map((sample) => `<li><b>${escapeHtml(sample.caseId)}</b> [${escapeHtml(sample.problems.join(', '))}] ${escapeHtml(sample.title)} — ${escapeHtml(sample.instruction)}</li>`).join('')}</ul>` : '<p>(없음)</p>'}
</section>`).join('\n')

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>보류 2건 비교</title>
<style>
:root{--bg:#f7f6f2;--card:#fff;--ink:#1d1d1b;--mute:#6b6a64;--line:#e3e1d9}
@media (prefers-color-scheme:dark){:root{--bg:#171715;--card:#22221f;--ink:#ecebe6;--mute:#a09e95;--line:#3a3934}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 "Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif}
main{max-width:1200px;margin:0 auto;padding:16px}
table{border-collapse:collapse;width:100%;font-size:13.5px;background:var(--card)}td,th{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0}
.note{color:var(--mute);font-size:13.5px}
.wrap{overflow-x:auto}
</style></head><body><main>
<h1>🦖 피드백 개편 보류 2건 비교</h1>
<p class="note">결정은 하지 않는다. 보류 ① 모두 met일 때 미션 개수 (A 3개 고정 / B 0~3개), 보류 ② 미션 코드 검사 (B 핵심 / C 형식만). 글은 지어낸 스모크 글, 모델은 gemini-3.8-flash 생각 낮게. 검사 C 결과에도 'B' 잣대를 사후로 대어 본다. 기준선(개편 전): 30회 중 3회 실패, 14회 재시도, 중앙값 4.1s.</p>
<div class="wrap">${htmlTable}</div>
${htmlSamples}
</main></body></html>
`
await fs.writeFile(path.join(outDir, 'feedback-redesign-holds.html'), html, 'utf8')
console.log(`썼습니다: ${path.join(outDir, 'feedback-redesign-holds.md')}, .html (조합 ${loaded.length}/4)`)
