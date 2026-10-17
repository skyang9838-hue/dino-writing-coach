// 보류 2건 비교 페이지를 만든다. Gemini는 부르지 않는다. 결정은 하지 않는다 —
// 사용자가 이 페이지를 보고 고른다.
//
// 읽는 것 (.smoke-results/, 깃 밖):
//   *-allmet{A|B}-checks{B|C}.json   `npm run smoke -- --all-met X --checks Y` (조합마다 가장 최근 것)
//   *-holds-rounds.json              `node scripts/compare-feedback-holds-rounds.js` (가장 최근 것)
// 쓰는 것: docs/feedback-redesign-holds.html, docs/feedback-redesign-holds.md
//
//   node scripts/analyze-feedback-holds.js
//
// 페이지 아래쪽의 "개편 전후 화면"과 "테스트·빌드" 절은 손으로 쓴 문구다.
// 테스트·빌드 숫자는 환경변수 HOLDS_TEST_LINE / HOLDS_BUILD_LINE으로 넘긴다.

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { getUnitCoachingSpec } from '../lib/coaching.js'

const COMBOS = [
  { allMet: 'A', checks: 'B' },
  { allMet: 'A', checks: 'C' },
  { allMet: 'B', checks: 'B' },
  { allMet: 'B', checks: 'C' },
]
const comboKey = ({ allMet, checks }) => `${allMet}${checks}`
const comboName = ({ allMet, checks }) => `개수 ${allMet} · 검사 ${checks}`
const comboLong = ({ allMet, checks }) =>
  `① ${allMet === 'A' ? 'A 3개 고정' : 'B 0~3개'} · ② ${checks === 'B' ? 'B 핵심 검사' : 'C 형식만'}`
const isCurrentDefault = ({ allMet, checks }) => allMet === 'A' && checks === 'B'

// 한 번 부를 때 비용 추정. 스펙 5-1절: 3.8 낮게 한 회차(판정+미션 2번) 약 $0.0044.
const COST_PER_CALL = 0.0022

const resultsDir = path.resolve(process.argv[2] ?? '.smoke-results')
const outDir = path.resolve(process.argv[3] ?? 'docs')
const files = (await fs.readdir(resultsDir)).sort()

async function loadSmoke(combo) {
  const file = files.filter((name) => name.endsWith(`-allmet${combo.allMet}-checks${combo.checks}.json`)).at(-1)
  if (!file) return null
  return { file, ...JSON.parse(await fs.readFile(path.join(resultsDir, file), 'utf8')) }
}

const smoke = {}
for (const combo of COMBOS) {
  const data = await loadSmoke(combo)
  if (data) smoke[comboKey(combo)] = data
  else console.log(`없음: npm run smoke -- --all-met ${combo.allMet} --checks ${combo.checks}`)
}
const roundsFile = files.filter((name) => name.endsWith('-holds-rounds.json')).at(-1)
const rounds = roundsFile ? JSON.parse(await fs.readFile(path.join(resultsDir, roundsFile), 'utf8')) : null
if (!rounds) console.log('없음: node scripts/compare-feedback-holds-rounds.js')

const evals = {}
for (const name of await fs.readdir('evals/smoke')) {
  for (const testCase of JSON.parse(await fs.readFile(path.join('evals/smoke', name), 'utf8'))) {
    evals[`${name.replace('.json', '')}/${testCase.id}`] = testCase
  }
}

// ── 숫자 ────────────────────────────────────────────────────────────────

const median = (values) => {
  const list = values.filter((value) => typeof value === 'number')
  if (!list.length) return null
  const sorted = [...list].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}
const p90 = (values) => {
  const list = values.filter((value) => typeof value === 'number')
  if (!list.length) return null
  const sorted = [...list].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)]
}
const seconds = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`)
const allMetOf = (assessments) => (assessments ?? []).length > 0 && assessments.every((a) => a.status === 'met')

function smokeRuns(key) {
  return (smoke[key]?.report ?? []).flatMap((item) => item.runs.map((run) => ({ ...run, unitId: item.unitId, caseId: item.caseId })))
}

function roundRuns(key) {
  return (rounds?.results ?? []).filter((result) => comboKey(result.combo) === key)
}

// 회차 하나에서 부른 횟수: 판정 1 + 하락 확인(내려간 게 있으면 1) + 미션 1 + 거절된 응답 수.
const callsOfRound = (round) => (round ? 1 + ((round.regressionChecks ?? []).length ? 1 : 0) + 1 + (round.rejected?.length ?? 0) : 0)

function stats(key) {
  const sRuns = smokeRuns(key)
  const rRuns = roundRuns(key)
  const allRounds = [
    ...sRuns.map((run) => ({ ok: run.ok, ms: run.ms, retries: run.retries ?? 0, reasons: run.retryReasons ?? [], missions: run.missions, core: run.coreProblems, assessments: run.assessments, meaningless: run.meaningless })),
    ...rRuns.flatMap((result) => [result.first, result.second].filter(Boolean)).map((round) => ({
      ok: round.ok,
      ms: round.ms,
      retries: round.rejected?.length ?? 0,
      reasons: (round.rejected ?? []).map((item) => item.reason),
      missions: round.missions,
      core: round.coreProblems,
      assessments: round.assessments,
      meaningless: round.meaningless,
      regressionChecks: round.regressionChecks,
    })),
  ]
  const ok = allRounds.filter((round) => round.ok && !round.meaningless)
  const reasons = new Map()
  for (const round of allRounds) for (const reason of round.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  const coreHits = new Map()
  let missionCount = 0
  let missionsHit = 0
  for (const round of ok) {
    for (const problems of round.core ?? []) {
      missionCount += 1
      if (problems.length) missionsHit += 1
      for (const problem of problems) coreHits.set(problem, (coreHits.get(problem) ?? 0) + 1)
    }
  }
  const allMetRounds = ok.filter((round) => allMetOf(round.assessments))
  const priors = rRuns.flatMap((result) => result.second?.priorMissions ?? [])
  const calls = sRuns.reduce((sum, run) => sum + 2 + (run.retries ?? 0), 0)
    + rRuns.reduce((sum, result) => sum + callsOfRound(result.first) + callsOfRound(result.second), 0)
  return {
    rounds: allRounds.length,
    failed: allRounds.filter((round) => !round.ok).length,
    retried: allRounds.filter((round) => round.retries > 0).length,
    retries: allRounds.reduce((sum, round) => sum + round.retries, 0),
    reasons: [...reasons].sort((a, b) => b[1] - a[1]),
    missionCount,
    missionsHit,
    coreHits: [...coreHits].sort((a, b) => b[1] - a[1]),
    allMetRounds: allMetRounds.length,
    allMetCounts: allMetRounds.map((round) => (round.missions ?? []).length),
    medianMs: median(allRounds.map((round) => round.ms)),
    p90Ms: p90(allRounds.map((round) => round.ms)),
    done: priors.filter((prior) => prior.status === 'done').length,
    partial: priors.filter((prior) => prior.status === 'partial').length,
    notDone: priors.filter((prior) => prior.status === 'not-done').length,
    regressionCalls: allRounds.filter((round) => (round.regressionChecks ?? []).length).length,
    calls,
    cost: calls * COST_PER_CALL,
  }
}

const S = Object.fromEntries(COMBOS.map((combo) => [comboKey(combo), stats(comboKey(combo))]))
const totalCost = Object.values(S).reduce((sum, s) => sum + s.cost, 0)
const totalCalls = Object.values(S).reduce((sum, s) => sum + s.calls, 0)

const countText = (counts) => {
  if (!counts.length) return '—'
  const tally = new Map()
  for (const count of counts) tally.set(count, (tally.get(count) ?? 0) + 1)
  return [...tally].sort((a, b) => a[0] - b[0]).map(([count, n]) => `${count}개 ${n}회`).join(', ')
}
const list = (entries) => (entries.length ? entries.map(([text, n]) => `${text} ${n}`).join(' · ') : '없음')
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')

const ROWS = [
  ['회차 수 (스모크 1회차 + 시범 1·2회차)', (s) => s.rounds],
  ['5번 재시도 끝에 실패', (s) => s.failed],
  ['재시도가 있던 회차', (s) => s.retried],
  ['거절된 응답 합계', (s) => s.retries],
  ['거절 사유', (s) => list(s.reasons)],
  ['모두 met으로 판정된 회차', (s) => s.allMetRounds],
  ['그 회차의 미션 개수', (s) => countText(s.allMetCounts)],
  ["최종 미션 가운데 'B' 잣대에 걸리는 것", (s) => `${s.missionsHit}/${s.missionCount}`],
  ["'B' 잣대 사유별", (s) => list(s.coreHits)],
  ['시범 2회차 done / partial / not-done', (s) => `${s.done} / ${s.partial} / ${s.notDone} (done ${pct(s.done, s.done + s.partial + s.notDone)})`],
  ['하락 확인 호출이 생긴 회차', (s) => s.regressionCalls],
  ['한 회차 시간 (중앙값 / p90)', (s) => `${seconds(s.medianMs)} / ${seconds(s.p90Ms)}`],
  ['Gemini 호출 (추정 비용)', (s) => `${s.calls}회 (약 $${s.cost.toFixed(2)})`],
]

// ── HTML 조각 ───────────────────────────────────────────────────────────

const esc = (text) => String(text ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
const STATUS_GLYPH = { met: '✓', partial: '?', unmet: '✕' }
const PRIOR_GLYPH = { done: '✅ done', partial: '🔄 partial', 'not-done': '❌ not-done' }

const assessmentLine = (assessments) => (assessments ?? []).map((a) =>
  `<span class="st st-${esc(a.status)}" title="${esc(a.criterionId)}">${STATUS_GLYPH[a.status] ?? '·'} ${esc(a.criterionId)}</span>`).join('')

function missionList(missions, core, priorById) {
  if (!missions?.length) return '<p class="crit">미션 0개</p>'
  return `<ol>${missions.map((mission, index) => {
    const problems = core?.[index] ?? []
    const prior = priorById?.get(mission.id)
    return `<li><p class="mt">${esc(mission.title)} <code>${esc((mission.criterionIds ?? [mission.criterionId]).join('+'))}</code></p>
<p>${esc(mission.instruction)}</p>
<p class="crit">확인 기준: ${esc(mission.criterion)}</p>
${problems.length ? `<p class="hits">'B' 잣대: ${esc(problems.join(', '))}</p>` : '<p class="clean">\'B\' 잣대: 통과</p>'}
${prior ? `<p class="prior prior-${esc(prior)}">2회차 판정: ${PRIOR_GLYPH[prior] ?? esc(prior)}</p>` : ''}</li>`
  }).join('')}</ol>`
}

function rejectedList(items) {
  if (!items.length) return ''
  return `<details><summary>거절된 응답 ${items.length}개 (원문)</summary>${items.map((item) => {
    const missions = item.response?.missions
    const body = Array.isArray(missions)
      ? `<ol>${missions.map((m) => `<li><b>${esc(m.title)}</b> — ${esc(m.instruction)}</li>`).join('')}</ol>`
      : `<pre>${esc(JSON.stringify(item.response ?? null, null, 1)?.slice(0, 600))}</pre>`
    return `<p class="hits">사유: ${esc(item.reason)}</p>${body}`
  }).join('')}</details>`
}

// smoke는 사유와 거절 본문을 따로 모았다(같은 순서로 찍힌다).
const smokeRejected = (run) => (run.retryReasons ?? []).map((reason, index) => ({ reason, response: run.rejected?.[index] }))

function column(combo, body) {
  return `<div class="col${isCurrentDefault(combo) ? ' col-default' : ''}"><h4>${esc(comboLong(combo))}</h4>${body}</div>`
}

function smokeSection(caseKey) {
  const [unitId, caseId] = caseKey.split('/')
  const testCase = evals[caseKey]
  const cols = COMBOS.map((combo) => {
    const run = smokeRuns(comboKey(combo)).find((item) => item.unitId === unitId && item.caseId === caseId)
    if (!run) return column(combo, '<p class="crit">결과 없음</p>')
    if (!run.ok) return column(combo, `<p class="hits">실패: ${esc(run.error)}</p>${rejectedList(smokeRejected(run))}`)
    return column(combo, `<p class="ms">${seconds(run.ms)} · 재시도 ${run.retries ?? 0}회${allMetOf(run.assessments) ? ' · <b>모두 met</b>' : ''}</p>
<p>${assessmentLine(run.assessments)}</p>
<p class="strength">👍 <code>${esc(run.strength?.criterionId)}</code> ${esc(run.strength?.text)}</p>
${missionList(run.missions, run.coreProblems)}
${rejectedList(smokeRejected(run))}`)
  }).join('')
  return `<section id="${esc(caseKey)}"><h2>${esc(caseId)} <span class="unit">${esc(unitId)}</span></h2>
<p class="unit">${esc(testCase?.note ?? '')}</p>
<details><summary>학생 글 보기 (${(testCase?.writing ?? '').length}자)</summary><pre>${esc(testCase?.writing)}</pre></details>
<div class="grid">${cols}</div></section>`
}

function roundsSection(studentId) {
  const sample = (rounds?.results ?? []).find((result) => result.studentId === studentId)
  const cols = COMBOS.map((combo) => {
    const result = roundRuns(comboKey(combo)).find((item) => item.studentId === studentId)
    if (!result) return column(combo, '<p class="crit">결과 없음</p>')
    const { first, second } = result
    if (!first?.ok) return column(combo, `<p class="hits">1회차 실패: ${esc(first?.error)}</p>${rejectedList(first?.rejected ?? [])}`)
    const priorById = new Map((second?.priorMissions ?? []).map((prior) => [prior.missionId, prior.status]))
    const drops = (second?.regressionChecks ?? []).map((check) =>
      `${esc(check.criterionId)} ${esc(check.from)}→${esc(check.to)} ${check.regressed ? '(하락 인정)' : '(직전 판정 유지)'}`).join(', ')
    return column(combo, `<p class="ms">1회차 ${seconds(first.ms)} · 재시도 ${first.rejected?.length ?? 0}회${allMetOf(first.assessments) ? ' · <b>모두 met</b>' : ''}</p>
<p>${assessmentLine(first.assessments)}</p>
<p class="strength">👍 <code>${esc(first.strength?.criterionId)}</code> ${esc(first.strength?.text)}</p>
${missionList(first.missions, first.coreProblems, priorById)}
${rejectedList(first.rejected ?? [])}
<hr><p class="ms">2회차 ${second ? `${seconds(second.ms)} · 재시도 ${second.rejected?.length ?? 0}회` : '없음'}</p>
${second?.ok ? `<p>${assessmentLine(second.assessments)}</p>${drops ? `<p class="crit">하락 확인: ${drops}</p>` : ''}
<details><summary>2회차에 새로 받은 미션 ${(second.missions ?? []).length}개</summary>${missionList(second.missions, second.coreProblems)}</details>`
    : second ? `<p class="hits">2회차 실패: ${esc(second.error)}</p>` : ''}
${second ? rejectedList(second.rejected ?? []) : ''}`)
  }).join('')
  return `<section id="${esc(studentId)}"><h2>${esc(studentId.split('/')[1])} <span class="unit">${esc(studentId.split('/')[0])}</span></h2>
<details><summary>1회차 글 (${(sample?.writings?.[0] ?? '').length}자)</summary><pre>${esc(sample?.writings?.[0])}</pre></details>
<details><summary>2회차 글 — 고친 글 (${(sample?.writings?.[1] ?? '').length}자)</summary><pre>${esc(sample?.writings?.[1])}</pre></details>
<div class="grid">${cols}</div></section>`
}

const smokeKeys = [...new Set(COMBOS.flatMap((combo) => smokeRuns(comboKey(combo)).map((run) => `${run.unitId}/${run.caseId}`)))]
const allMetSomewhere = (key) => COMBOS.some((combo) => smokeRuns(comboKey(combo)).some((run) => `${run.unitId}/${run.caseId}` === key && allMetOf(run.assessments)))
smokeKeys.sort((a, b) => Number(allMetSomewhere(b)) - Number(allMetSomewhere(a)))
const studentIds = [...new Set((rounds?.results ?? []).map((result) => result.studentId))].sort()

const s = (key) => S[key]
const field = (key, name) => s(key)?.[name] ?? 0

const summaryBoxes = `
<div class="box"><b>보류 ① 모두 met일 때 미션 개수</b>
A 3개 고정: 다 충족한 학생도 늘 심화 미션 3개를 받고 고른다. 화면·보드·검사가 한 가지 모양이라 단순하다. 대신 더 고칠 곳이 마땅치 않아도 3개를 채우므로 억지 미션이 섞일 수 있다.<br>
B 0~3개: AI가 더 발전시킬 곳이 분명할 때만 낸다. 억지 미션은 줄지만, 0개가 나오면 학생 화면이 "미션 없음"이 되고 그 회차에는 도달도를 올릴 길이 없다.<br>
<small>이번 비교에서 모두 met으로 판정된 회차: 개수A쪽 ${field('AB', 'allMetRounds') + field('AC', 'allMetRounds')}회, 개수B쪽 ${field('BB', 'allMetRounds') + field('BC', 'allMetRounds')}회. 개수B쪽 그 회차의 미션 개수: ${esc(countText([...(s('BB')?.allMetCounts ?? []), ...(s('BC')?.allMetCounts ?? [])]))}.</small></div>
<div class="box"><b>보류 ② 미션 코드 검사</b>
B 핵심: 형식 검사에 더해 "예를 들어" 같은 베낄 예시 문장, 사실을 지어내게 하는 요구, "자세히 써" 같은 막연한 표현에 걸리면 다시 만들게 한다. 그런 미션이 학생에게 안 가지만, 걸리는 만큼 호출과 시간이 늘고 오탐이면 멀쩡한 미션도 버린다.<br>
C 형식만: 모양·기준 id·잘한 점만 본다. 빠르고 재시도가 적지만, 위 세 가지는 프롬프트 지시에만 맡긴다.<br>
<small>C로 만든 최종 미션 가운데 B 잣대에 걸렸을 것: 개수A·검사C ${esc(s('AC')?.missionsHit)}/${esc(s('AC')?.missionCount)}, 개수B·검사C ${esc(s('BC')?.missionsHit)}/${esc(s('BC')?.missionCount)}. 거절된 응답 합계 — 검사B: ${esc(s('AB')?.retries)}·${esc(s('BB')?.retries)}개, 검사C: ${esc(s('AC')?.retries)}·${esc(s('BC')?.retries)}개.</small></div>
<div class="box"><b>시간 (한 회차 중앙값 / p90)</b>${COMBOS.map((combo) => `${esc(comboName(combo))}: ${seconds(s(comboKey(combo))?.medianMs)} / ${seconds(s(comboKey(combo))?.p90Ms)}`).join('<br>')}<br><small>개편 전(2.5-lite) 한 회차 중앙값 4.1s. 네 조합을 동시에 돌려 시간에 서로 영향이 있었을 수 있다.</small></div>
<div class="box"><b>비용</b>이번 비교 전체 Gemini 호출 약 ${totalCalls}회, 추정 약 $${totalCost.toFixed(2)} (한 번에 약 $${COST_PER_CALL}로 셈, 스펙 5-1절 단가). 교실 한 시간(24명 × 4회차)은 스펙 추산대로 약 $0.4이고, 검사 B의 재시도만큼 조금 늘어난다.</div>`

const tableHtml = `<table><thead><tr><th></th>${COMBOS.map((combo) => `<th>${esc(comboLong(combo))}${isCurrentDefault(combo) ? '<br><small>(지금 기본값)</small>' : ''}</th>`).join('')}</tr></thead><tbody>${
  ROWS.map(([label, cell]) => `<tr><th>${esc(label)}</th>${COMBOS.map((combo) => `<td>${esc(s(comboKey(combo)) ? cell(s(comboKey(combo))) : '—')}</td>`).join('')}</tr>`).join('')
}</tbody></table>`

const TEST_LINE = process.env.HOLDS_TEST_LINE ?? '(돌린 뒤 채운다)'
const BUILD_LINE = process.env.HOLDS_BUILD_LINE ?? '(돌린 뒤 채운다)'

const beforeAfter = `<section id="before-after"><h2>개편 전후 — 학생 화면과 교사 보드</h2>
<div class="wrap"><table><thead><tr><th></th><th>개편 전</th><th>개편 후</th></tr></thead><tbody>
<tr><th>미션 개수</th><td>항상 2개. 코드가 기준을 골랐고, 모자라면 맞춤법·문장 다듬기 미션이 채웠다</td><td>3개. AI가 채점기준 안에서 직접 고른다. 글다듬기 미션은 없다. 모두 충족하면 심화 미션(개수는 보류 ①)</td></tr>
<tr><th>학생 화면</th><td>미션을 읽기만 했고, 다음 코칭 때 2개 모두 판정됐다</td><td>미션 카드를 눌러 해 볼 것을 1~3개 고른다. 하나도 안 고르면 "다시 코칭 받기"가 꺼지고 안내가 뜬다. <b>고른 미션만</b> 판정된다</td></tr>
<tr><th>도달도</th><td>40%에서 시작, done 하나당 +10% (한 회차 최대 +20%)</td><td>공식 그대로. 한 회차 최대 +30%(3개 다 고르고 다 done), 1개만 고르면 최대 +10%. done 판정 문구는 관대하게 바꿨다</td></tr>
<tr><th>이전 버전 보기</th><td>지난 미션 2개의 반영 여부(✅🔄❌)</td><td>학생이 고른 미션만 보여 준다. 기호는 같다</td></tr>
<tr><th>채점기준 판정</th><td>한 번 올라가면 내려가지 않게 잠갔다</td><td>매 회차 새로 판정하고, 내려간 기준이 있으면 고치기 전후 글을 한 번 더 보여 줘 실제로 약해졌는지 확인한다. 아니면 직전 판정을 지킨다</td></tr>
<tr><th>교사 보드</th><td>✓ ? ✕와 ↑. 잠금 때문에 새 회차에는 ▼가 안 나왔다</td><td>기호는 그대로이고 <b>▼(하락)가 다시 나온다</b>. 미션 칸에는 학생이 고른 미션만 결과(✅🔄❌)와 함께 나온다. 최신 회차(아직 판정 전)는 3개 모두</td></tr>
<tr><th>모델</th><td>gemini-2.5-flash-lite, 한 회차 약 4초</td><td>채점기준 단원은 gemini-3.8-flash 생각 낮게, 한 회차 약 10초. 1단원(일반 코치)은 그대로</td></tr>
</tbody></table></div>
<h3>테스트·빌드</h3><ul><li>${esc(TEST_LINE)}</li><li>${esc(BUILD_LINE)}</li></ul>
<p class="crit">보류 2건은 <code>lib/coaching.js</code> 맨 위 상수 두 개(<code>ALL_MET_MISSIONS</code>, <code>MISSION_CHECKS</code>)로 바뀐다. 고르면 그 값만 바꾸면 되고, 안 쓰는 쪽 코드는 그 뒤에 지운다.</p></section>`

const units = [...new Set(smokeKeys.map((key) => key.split('/')[0]))]
const unitTitle = (unitId) => getUnitCoachingSpec(unitId)?.subject ?? unitId

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>보류 2건 비교</title>
<style>
:root{--bg:#f7f6f2;--card:#fff;--ink:#1d1d1b;--mute:#6b6a64;--line:#e3e1d9;--ok:#e8f3ea;--off:#fbe6e3;--accent:#2f6d4f;--warn:#a5481c}
@media (prefers-color-scheme:dark){:root{--bg:#171715;--card:#22221f;--ink:#ecebe6;--mute:#a09e95;--line:#3a3934;--ok:#1f3527;--off:#45231e;--accent:#7cc79f;--warn:#f0a07a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 "Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif}
header,main{max-width:1500px;margin:0 auto;padding:16px}
h1{font-size:24px;margin:8px 0}h2{font-size:18px;margin:0 0 4px}h3{font-size:15px;margin:14px 0 6px}h4{margin:0 0 8px;font-size:14px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:12px;margin:12px 0}
.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:14px}
.box b{display:block;margin-bottom:4px}.box small{color:var(--mute)}
.wrap{overflow-x:auto}
table{border-collapse:collapse;font-size:13px;width:100%;background:var(--card)}td,th{border:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top}
.toc{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 16px}.toc a{font-size:12px;padding:3px 8px;border:1px solid var(--line);border-radius:99px;color:var(--ink);text-decoration:none;background:var(--card)}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0}
.unit{color:var(--mute);font-size:13px;margin:0 0 6px;font-weight:400}.st{display:inline-block;margin-right:8px;font-size:12.5px}.st-met{color:var(--accent)}.st-unmet{color:var(--warn)}
pre{white-space:pre-wrap;background:var(--bg);padding:10px;border-radius:8px;font:inherit;font-size:14px}
details{margin:6px 0}summary{cursor:pointer;color:var(--mute);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px}
@media (max-width:1100px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:640px){.grid{grid-template-columns:minmax(0,1fr)}}
.col{border:1px solid var(--line);border-radius:10px;padding:10px;font-size:13.5px;overflow-wrap:anywhere}.col-default{border-color:var(--accent);border-width:2px}
.col ol{padding-left:18px;margin:6px 0}.col li{margin-bottom:8px}.col p{margin:2px 0}.mt{font-weight:700}.crit{color:var(--mute);font-size:12.5px}
code{font-size:11px;color:var(--mute)}.ms{color:var(--mute);font-size:12.5px}.strength{background:var(--bg);padding:6px 8px;border-radius:6px;margin:6px 0!important}
.hits{color:var(--warn);font-size:12.5px}.clean{color:var(--accent);font-size:12.5px}
.prior{font-size:12.5px;font-weight:700}.prior-done{color:var(--accent)}.prior-not-done{color:var(--warn)}
hr{border:0;border-top:1px dashed var(--line);margin:10px 0}
</style></head><body>
<header>
<h1>🦖 피드백 개편 보류 2건 비교</h1>
<p>계획에서 정하지 않고 남겨 둔 두 가지를 네 조합으로 실제로 돌린 결과입니다. <b>추천은 하지 않습니다.</b> 모델은 모두 gemini-3.8-flash 생각 낮게입니다. 글은 전부 이 저장소가 지어낸 테스트 글입니다(스모크 글 15편, 시범 학생 8명). 초록 테두리가 지금 코드의 기본값(개수 A · 검사 B)입니다.</p>
<ul>
<li><b>보류 ①</b> 모든 채점기준이 met일 때 미션 개수 — A: 3개 고정 / B: 0~3개 (<code>ALL_MET_MISSIONS</code>)</li>
<li><b>보류 ②</b> 미션 코드 검사 — B: 형식 + 예시 문장·사실 지어내기·막연한 표현에 걸리면 다시 만들기 / C: 형식·무결성만 (<code>MISSION_CHECKS</code>)</li>
<li>"'B' 잣대"는 최종 미션에 B 검사를 사후로 대 본 결과입니다. 검사 C 쪽에서 걸리는 것은 "B였다면 다시 만들었을 미션"입니다. 검사 B 쪽은 걸러진 뒤라 0이 정상입니다.</li>
<li>done 판정: 시범 학생의 1회차 글로 미션을 받고, 2회차 글을 고친 글로 넣었습니다. 학생은 미션 3개를 모두 고른 것으로 쳤습니다. <b>2회차 글은 개편 전 미션을 보고 쓴 글</b>이라 done 비율은 미션 품질이 아니라 "같은 퇴고를 두고 각 조합의 미션이 어떻게 판정되는지"만 보여 줍니다.</li>
</ul>
<div class="summary">${summaryBoxes}</div>
<div class="wrap">${tableHtml}</div>
<p class="crit">결과 파일: ${COMBOS.map((combo) => esc(smoke[comboKey(combo)]?.file ?? '—')).join(', ')}, ${esc(roundsFile ?? '—')} (.smoke-results/, 깃 밖). 조합마다 한 번씩만 돌린 결과라 몇 건 차이는 우연일 수 있습니다.</p>
<div class="toc"><a href="#smoke">스모크 글 (1회차)</a><a href="#rounds">시범 학생 (2회차 done 판정)</a><a href="#before-after">개편 전후 화면·테스트</a></div>
</header>
<main>
<h2 id="smoke">스모크 글 — 같은 글, 네 조합의 1회차 응답 <span class="unit">모두 met이 나온 글을 맨 앞에 뒀습니다</span></h2>
${units.map((unitId) => `<p class="unit">${esc(unitTitle(unitId))}: ${smokeKeys.filter((key) => key.startsWith(`${unitId}/`)).map((key) => `<a href="#${esc(key)}">${esc(key.split('/')[1])}</a>`).join(' · ')}</p>`).join('')}
${smokeKeys.map(smokeSection).join('\n')}
<h2 id="rounds">시범 학생 — 1회차 미션 → 2회차 고친 글의 done 판정</h2>
${studentIds.map(roundsSection).join('\n')}
${beforeAfter}
</main></body></html>
`

await fs.mkdir(outDir, { recursive: true })
await fs.writeFile(path.join(outDir, 'feedback-redesign-holds.html'), html, 'utf8')

const md = `# 피드백 개편 보류 2건 비교

> \`scripts/analyze-feedback-holds.js\`가 만든 요약이다. 실제 미션 원문은 같은 이름의 .html에 있다. 추천은 하지 않는다.

- 보류 ① 모두 met일 때 미션 개수 — A 3개 고정 / B 0~3개 (\`ALL_MET_MISSIONS\`)
- 보류 ② 미션 코드 검사 — B 핵심 / C 형식만 (\`MISSION_CHECKS\`)
- 모델 gemini-3.8-flash 생각 낮게. 스모크 글 15편(1회차) + 시범 학생 8명(1→2회차, 2회차 글은 개편 전 미션을 보고 쓴 글). 이번 비교 전체 약 ${totalCalls}회, 추정 약 $${totalCost.toFixed(2)}.

| | ${COMBOS.map(comboLong).join(' | ')} |
|---|${COMBOS.map(() => '---').join('|')}|
${ROWS.map(([label, cell]) => `| ${label} | ${COMBOS.map((combo) => String(s(comboKey(combo)) ? cell(s(comboKey(combo))) : '—').replaceAll('|', '/')).join(' | ')} |`).join('\n')}

- ${TEST_LINE}
- ${BUILD_LINE}
`
await fs.writeFile(path.join(outDir, 'feedback-redesign-holds.md'), md, 'utf8')
console.log(`썼습니다: ${path.join(outDir, 'feedback-redesign-holds.html')} (스모크 ${Object.keys(smoke).length}/4, 시범 ${rounds ? 'O' : 'X'})`)
