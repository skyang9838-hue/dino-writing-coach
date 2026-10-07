// demo/ 아래 상태 JSON을 사람이 읽는 기록으로 펼친다.
//
// demo-unit-rounds.js가 남기는 것은 상태 JSON이라 눈으로 읽기 어렵다. 이건
// 그 안에 이미 들어 있는 것(학생이 낸 글, 채점기준 판정, 잘한 점, 수정 미션,
// 지난 미션 달성 여부)을 라운드 순서대로 펼쳐 쓴다. Gemini를 다시 부르지
// 않으므로 몇 번을 돌려도 비용이 없다.
//
//   node scripts/demo-report.js
//
// 결과: demo/기록/<단원>-<이름>.md 와 이를 모두 이어 붙인 demo/기록.md

import fs from 'node:fs/promises'
import path from 'node:path'
import { getUnitById, getUnitChunks, showsAiVerdict } from '../lib/curriculum.js'

const DEMO = path.resolve('demo')
const OUT = path.join(DEMO, '기록')

const STATUS_LABEL = { met: '○ 충족', partial: '◐ 부분', unmet: '✗ 미충족' }
const PRIOR_LABEL = { done: '✓ 해냄', partial: '◐ 부분만', 'not-done': '✗ 안 고침' }

function criterionIndex(unitId) {
  const index = new Map()
  for (const chunk of getUnitChunks(unitId) ?? []) {
    for (const criterion of chunk.criteria) {
      index.set(criterion.id, { ...criterion, chunkLabel: chunk.label })
    }
  }
  return index
}

function renderStudent(state) {
  const unit = getUnitById(state.unitId)
  const index = criterionIndex(state.unitId)
  const unitLabel = unit?.unitLabel ?? `${unit?.unitNumber}단원`
  const lines = []

  lines.push(`# ${unitLabel} ${unit?.title ?? state.unitId} — ${state.student}`)
  lines.push('')
  lines.push(`- 활동 주제: ${state.topic ?? '(없음)'}`)
  lines.push(`- 단원 id: \`${state.unitId}\` · 장르: ${unit?.genre ?? '-'} · 권장 분량: ${unit?.recommendedLength ?? '-'}자`)
  lines.push(`- 라운드 ${state.rounds.length}회 · 마지막 도달도 ${state.attainment}%`)
  lines.push('')

  state.rounds.forEach((round, i) => {
    const previous = state.rounds[i - 1]
    const delta = previous ? round.writing.length - previous.writing.length : null
    lines.push('---')
    lines.push('')
    lines.push(`## ${i + 1}라운드`)
    lines.push('')
    lines.push(
      `**글 ${round.writing.length}자**`
      + (delta === null ? '' : ` (지난 라운드 ${delta >= 0 ? '+' : ''}${delta}자)`)
      + ` · **도달도 ${previous ? `${previous.attainmentAfter}% → ` : ''}${round.attainmentAfter}%**`
      + ` · 채점기준 실제 충족 ${round.actualAttainment}%`,
    )
    lines.push('')

    if (round.priorMissionStatuses?.length) {
      lines.push('### 지난 미션을 해냈나')
      lines.push('')
      for (const status of round.priorMissionStatuses) {
        const mission = previous?.missions?.find((m) => m.id === status.missionId)
        lines.push(`- ${PRIOR_LABEL[status.status] ?? status.status} — ${mission?.title ?? `(미션 id ${status.missionId})`}`)
      }
      lines.push('')
      const done = round.priorMissionStatuses.filter((s) => s.status === 'done').length
      lines.push(`→ 해낸 미션 ${done}개 × 10% = 도달도 +${done * 10}%`)
      lines.push('')
    }

    lines.push('### 학생이 낸 글')
    lines.push('')
    lines.push('```')
    lines.push(round.writing)
    lines.push('```')
    lines.push('')

    lines.push('### 디노의 채점기준 판정')
    lines.push('')
    lines.push('| 채점기준 | 판정 | 교사 보드 |')
    lines.push('|---|---|---|')
    for (const assessment of round.assessments) {
      const criterion = index.get(assessment.criterionId)
      const board = criterion && !showsAiVerdict(criterion) ? '— (선생님이 판정)' : '표시됨'
      const label = criterion?.shortLabel ?? criterion?.label ?? assessment.criterionId
      lines.push(`| ${label} <br>\`${assessment.criterionId}\` | ${STATUS_LABEL[assessment.status] ?? assessment.status} | ${board} |`)
    }
    lines.push('')

    lines.push('### 잘한 점')
    lines.push('')
    lines.push(`> ${round.strength || '(없음)'}`)
    lines.push('')

    lines.push('### 이번에 받은 수정 미션')
    lines.push('')
    round.missions.forEach((mission, order) => {
      const targets = (mission.criterionIds ?? [])
        .map((id) => index.get(id)?.shortLabel ?? id)
        .join(' + ')
      lines.push(`**${order + 1}. ${mission.title}** — \`${(mission.criterionIds ?? []).join(', ')}\` (${targets})`)
      lines.push('')
      lines.push(`> ${mission.instruction}`)
      lines.push('')
    })
  })

  return lines.join('\n')
}

const states = []
for (const entry of await fs.readdir(DEMO, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === '기록') continue
  for (const file of await fs.readdir(path.join(DEMO, entry.name))) {
    if (!file.endsWith('.json')) continue
    const state = JSON.parse(await fs.readFile(path.join(DEMO, entry.name, file), 'utf8'))
    states.push({ dir: entry.name, ...state })
  }
}

states.sort((a, b) => a.dir.localeCompare(b.dir) || a.student.localeCompare(b.student))

await fs.mkdir(OUT, { recursive: true })
const all = []
for (const state of states) {
  const text = renderStudent(state)
  const file = path.join(OUT, `${state.dir}-${state.student}.md`)
  await fs.writeFile(file, text, 'utf8')
  console.log(`${file}  (${state.rounds.length}라운드)`)
  all.push(text)
}

const combined = [
  '# 단원 채점기준 코칭 시범 기록',
  '',
  `학생 ${states.length}명 · 라운드 ${states.reduce((sum, s) => sum + s.rounds.length, 0)}회.`,
  'Gemini를 실제로 불러 받은 응답 그대로이며, 글은 6학년이 쓸 법하게 지어낸 것이다.',
  '',
  all.join('\n\n\n'),
].join('\n')

const combinedPath = path.join(DEMO, '기록.md')
await fs.writeFile(combinedPath, combined, 'utf8')
console.log(`\n합본: ${combinedPath}`)
