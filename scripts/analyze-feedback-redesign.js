// scripts/measure-feedback-redesign.js가 남긴 기록을 표로 정리한다. Gemini를 부르지 않는다.
//
//   node scripts/analyze-feedback-redesign.js .smoke-results/measure-....json [--missions out.md]

import fs from 'node:fs/promises'
import process from 'node:process'

const [file, ...rest] = process.argv.slice(2)
const missionsOut = rest[0] === '--missions' ? rest[1] : null
const { models, records } = JSON.parse(await fs.readFile(file, 'utf8'))
const cfgs = models.map((model) => model.key)

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')
const median = (xs) => {
  const sorted = xs.filter((x) => x != null).sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
}
const p90 = (xs) => {
  const sorted = xs.filter((x) => x != null).sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : null
}
const sec = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`)
const groupBy = (xs, key) => xs.reduce((map, x) => {
  const k = key(x)
  map.set(k, [...(map.get(k) ?? []), x])
  return map
}, new Map())
const RANK = { unmet: 0, partial: 1, met: 2 }

function table(rows) {
  console.table(rows)
}

// ── E1 ──
const e1 = records.filter((r) => r.exp === 'e1')
console.log('\n━━ E1 채점기준 판정: 흔들림·의도 일치·실패')
{
  const rows = {}
  for (const cfg of cfgs) {
    const mine = e1.filter((r) => r.cfg === cfg)
    const row = { 실패: `${mine.filter((r) => r.error).length}/${mine.length}` }
    for (const kind of ['smoke', 'demo-independent', 'demo-combined']) {
      const ok = mine.filter((r) => r.kind === kind && !r.error)
      const groups = groupBy(ok, (r) => `${r.id}|${r.k ?? ''}`)
      let cells = 0
      let shaky = 0
      for (const runs of groups.values()) {
        for (const id of Object.keys(runs[0].statuses)) {
          cells += 1
          if (new Set(runs.map((r) => r.statuses[id])).size > 1) shaky += 1
        }
      }
      row[`흔들린 칸 ${kind}`] = `${shaky}/${cells} (${pct(shaky, cells)})`
    }
    // 스모크 의도 일치: 매 회 판정이 의도와 같은 칸 비율
    const smoke = mine.filter((r) => r.kind === 'smoke' && !r.error)
    const intended = JSON.parse(JSON.stringify(globalThis.__intended ?? {}))
    void intended
    row['판정 중앙값'] = sec(median(mine.map((r) => r.ms)))
    row['판정 p90'] = sec(p90(mine.map((r) => r.ms)))
    rows[cfg] = row
    void smoke
  }
  table(rows)
}

// 스모크 의도 일치는 기록에 의도가 없으므로 픽스처에서 다시 읽는다.
const intendedById = new Map()
for (const name of await fs.readdir('evals/smoke')) {
  for (const testCase of JSON.parse(await fs.readFile(`evals/smoke/${name}`, 'utf8'))) {
    intendedById.set(testCase.id, testCase.intended ?? {})
  }
}
{
  console.log('\n  스모크 의도 일치 (칸×회 기준, 의도가 적힌 칸만)')
  const rows = {}
  for (const cfg of cfgs) {
    const smoke = e1.filter((r) => r.cfg === cfg && r.kind === 'smoke' && !r.error)
    let total = 0
    let hit = 0
    let lenient = 0
    let strict = 0
    for (const r of smoke) {
      for (const [id, want] of Object.entries(intendedById.get(r.id) ?? {})) {
        if (!(id in r.statuses)) continue
        total += 1
        if (r.statuses[id] === want) hit += 1
        else if (RANK[r.statuses[id]] > RANK[want]) lenient += 1
        else strict += 1
      }
    }
    rows[cfg] = { 일치: pct(hit, total), '의도보다 후함': pct(lenient, total), '의도보다 엄격': pct(strict, total), 칸: total }
  }
  table(rows)
}
{
  console.log('\n  같은 글(시범 2·3회차)을 독립 판정 vs 지금 방식(이전 글·미션 함께)으로 판정했을 때 다수결이 다른 칸')
  const rows = {}
  for (const cfg of cfgs) {
    const ok = e1.filter((r) => r.cfg === cfg && !r.error && r.kind.startsWith('demo-') && r.k > 0)
    const groups = groupBy(ok, (r) => `${r.id}|${r.k}`)
    let cells = 0
    let differ = 0
    let combinedHigher = 0
    for (const runs of groups.values()) {
      const ind = runs.filter((r) => r.kind === 'demo-independent')
      const com = runs.filter((r) => r.kind === 'demo-combined')
      if (!ind.length || !com.length) continue
      for (const id of Object.keys(ind[0].statuses)) {
        const maj = (xs) => {
          const counts = {}
          for (const x of xs) counts[x] = (counts[x] ?? 0) + 1
          return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
        }
        const a = maj(ind.map((r) => r.statuses[id]))
        const b = maj(com.map((r) => r.statuses[id]))
        cells += 1
        if (a !== b) differ += 1
        if (RANK[b] > RANK[a]) combinedHigher += 1
      }
    }
    rows[cfg] = { '다른 칸': `${differ}/${cells}`, '지금 방식이 더 높게': combinedHigher }
  }
  table(rows)
}

// ── E2 ──
const e2 = records.filter((r) => r.exp === 'e2')
console.log('\n━━ E2 하락 확인')
{
  const rows = {}
  for (const cfg of cfgs) {
    const independentRuns = e1.filter((r) => r.cfg === cfg && r.kind === 'demo-independent' && !r.error && r.k > 0).length
    const demo = e2.filter((r) => r.cfg === cfg && r.kind === 'demo')
    const same = e2.filter((r) => r.cfg === cfg && r.kind === 'same-text')
    const count = (xs, value) => xs.flatMap((r) => r.checks ?? []).filter((c) => c.regressed === value).length
    rows[cfg] = {
      '하락이 생긴 회차(시범)': `${demo.length}/${independentRuns}`,
      '하락 칸': demo.flatMap((r) => r.drops).length,
      '확인 후 하락 인정': count(demo, true),
      '확인 후 유지': count(demo, false),
      '같은 글 대조군 하락 칸': same.flatMap((r) => r.drops).length,
      '대조군인데 하락 인정(오류)': count(same, true),
      '확인 실패': e2.filter((r) => r.cfg === cfg && r.error).length,
      '확인 중앙값': sec(median(e2.filter((r) => r.cfg === cfg).map((r) => r.ms))),
    }
  }
  table(rows)
  const sample = e2.filter((r) => r.kind === 'demo' && r.checks?.some((c) => c.regressed)).slice(0, 12)
  if (sample.length) {
    console.log('  하락 인정 예:')
    for (const r of sample) console.log(`   ${r.cfg} ${r.id} ${r.k}회차 ${r.drops.map((d) => `${d.criterionId} ${d.from}→${d.to}`).join(', ')} → ${r.checks.map((c) => `${c.criterionId}:${c.regressed}`).join(', ')}`)
  }
}

// ── E3 ──
const e3 = records.filter((r) => r.exp === 'e3')
console.log('\n━━ E3 미션 수행 판정 (따로 뗀 호출)')
{
  const rows = {}
  for (const cfg of cfgs) {
    for (const wording of ['strict', 'lenient']) {
      const mine = e3.filter((r) => r.cfg === cfg && r.wording === wording)
      const dist = (kind) => {
        const statuses = mine.filter((r) => r.kind === kind).flatMap((r) => r.priorMissions ?? []).map((m) => m.status)
        return `done ${pct(statuses.filter((s) => s === 'done').length, statuses.length)} · partial ${pct(statuses.filter((s) => s === 'partial').length, statuses.length)}`
      }
      const real = mine.filter((r) => r.kind === 'real' && r.priorMissions)
      const groups = groupBy(real, (r) => `${r.id}|${r.k}`)
      let cells = 0
      let shaky = 0
      for (const runs of groups.values()) {
        for (const mission of runs[0].missions) {
          cells += 1
          if (new Set(runs.map((r) => r.priorMissions.find((m) => m.missionId === mission.id)?.status)).size > 1) shaky += 1
        }
      }
      rows[`${cfg} ${wording}`] = {
        '실제 퇴고': dist('real'),
        '흔들림': `${shaky}/${cells}`,
        '무관한 추가(대조)': dist('control-irrelevant'),
        '글자 늘리기(대조)': dist('control-padding'),
        실패: mine.filter((r) => r.error).length,
        중앙값: sec(median(mine.map((r) => r.ms))),
      }
    }
    // 지금 방식: E1 combined 호출 안에서 같이 판정한 것
    const combined = e1.filter((r) => r.cfg === cfg && r.kind === 'demo-combined' && !r.error)
    const statuses = combined.flatMap((r) => r.priorMissions).map((m) => m.status)
    rows[`${cfg} 지금(판정과 한 호출)`] = {
      '실제 퇴고': `done ${pct(statuses.filter((s) => s === 'done').length, statuses.length)} · partial ${pct(statuses.filter((s) => s === 'partial').length, statuses.length)}`,
    }
  }
  table(rows)
}

// ── E4 ──
const e4 = records.filter((r) => r.exp === 'e4')
console.log('\n━━ E4 AI가 고르는 미션 3개 (재시도 없이 첫 응답 기준)')
{
  const rows = {}
  const ruleRows = {}
  for (const cfg of cfgs) {
    const mine = e4.filter((r) => r.cfg === cfg)
    const ok = mine.filter((r) => !r.error && r.missions)
    const clean = ok.filter((r) => Object.keys(r.hits).length === 0)
    const notAllMet = ok.filter((r) => !r.allMet)
    const picks = notAllMet.flatMap((r) => r.missions.map((m) => r.statuses[m.criterionId]))
    const distinctCriteria = notAllMet.map((r) => new Set(r.missions.map((m) => m.criterionId)).size)
    rows[cfg] = {
      '규칙 하나도 안 걸림': `${clean.length}/${ok.length} (${pct(clean.length, ok.length)})`,
      실패: mine.filter((r) => r.error).length,
      '고른 기준 상태 unmet/partial/met': `${picks.filter((s) => s === 'unmet').length}/${picks.filter((s) => s === 'partial').length}/${picks.filter((s) => s === 'met').length}`,
      '서로 다른 기준 수(평균)': (distinctCriteria.reduce((a, b) => a + b, 0) / (distinctCriteria.length || 1)).toFixed(2),
      중앙값: sec(median(mine.map((r) => r.ms))),
      p90: sec(p90(mine.map((r) => r.ms))),
    }
    const hits = {}
    for (const r of ok) for (const [rule, n] of Object.entries(r.hits)) hits[rule] = (hits[rule] ?? 0) + n
    ruleRows[cfg] = hits
  }
  table(rows)
  console.log('  규칙별 걸린 미션 수 (응답 수는 위 표의 분모, 응답 하나에 미션 3개)')
  table(ruleRows)
}

// ── E0 ──
const e0 = records.filter((r) => r.exp === 'e0')
if (e0.length) {
  console.log('\n━━ E0 지금 파이프라인(2.5-lite, 미션 2개) 재시도 사유')
  const reasons = {}
  for (const r of e0) for (const reason of r.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1
  console.log(`  ${e0.length}회 · 실패 ${e0.filter((r) => r.error).length} · 재시도 있었던 회 ${e0.filter((r) => r.reasons.length).length} · 한 회차(판정+미션) 중앙값 ${sec(median(e0.map((r) => r.ms)))}`)
  table(reasons)
}

// ── 토큰 ──
console.log('\n━━ 호출당 평균 토큰 (입력/출력/생각)')
{
  const rows = {}
  for (const cfg of cfgs) {
    for (const exp of ['e1', 'e2', 'e3', 'e4']) {
      const mine = records.filter((r) => r.exp === exp && r.cfg === cfg && r.inTokens)
      if (!mine.length) continue
      const avg = (key) => Math.round(mine.reduce((sum, r) => sum + r[key], 0) / mine.length)
      rows[`${cfg} ${exp}`] = { 입력: avg('inTokens'), 출력: avg('outTokens'), 생각: avg('thinkTokens'), 호출: mine.length }
    }
  }
  table(rows)
}

if (missionsOut) {
  const lines = ['# E4 미션 표본', '']
  const byItem = groupBy(e4.filter((r) => r.missions && r.run === 1), (r) => r.id)
  for (const [id, runs] of byItem) {
    lines.push(`## ${id}${runs[0].allMet ? ' (모두 met → 심화)' : ''}`, '', `판정: ${Object.entries(runs[0].statuses).map(([k, v]) => `${k}=${v}`).join(', ')}`, '')
    for (const r of runs) {
      lines.push(`### ${r.cfg}`, `- 잘한 점 [${r.strength?.criterionId}] ${r.strength?.text}`)
      for (const m of r.missions) lines.push(`- **[${m.criterionId}] ${m.title}** — ${m.instruction} _(확인: ${m.criterion})_`)
      if (Object.keys(r.hits).length) lines.push(`- ⚠ 걸린 규칙: ${Object.entries(r.hits).map(([k, v]) => `${k}×${v}`).join(', ')}`)
      lines.push('')
    }
  }
  await fs.writeFile(missionsOut, lines.join('\n'), 'utf8')
  console.log(`\n미션 표본: ${missionsOut}`)
}
