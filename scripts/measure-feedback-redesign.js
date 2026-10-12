// 피드백 개편 설계(docs/superpowers/specs/2026-10-12-feedback-redesign-design.md)
// 5절 "측정해서 정할 것"을 실제 Gemini 호출로 잰다. 원시 기록만 남기고, 표는
// scripts/analyze-feedback-redesign.js가 만든다.
//
// DB는 건드리지 않는다. 판정 프롬프트는 lib/coaching.js 것을 그대로 쓰고,
// 아직 코드에 없는 새 프롬프트(하락 확인, 따로 떼어 낸 미션 판정, AI가 고르는
// 미션 3개)는 여기서 시제품으로 만든다.
//
//   node scripts/measure-feedback-redesign.js [--runs 5] [--concurrency 8] [--only e1,e2,e3,e4,e0]
//
// ⚠️ 유료. 기본 설정으로 2천 번 넘게 부른다.

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import {
  ACTION_INSTRUCTION_PATTERN,
  ACTION_TITLE_PATTERN,
  buildAssessmentPrompt,
  getRubricCoachingFeedback,
  getUnitCoachingSpec,
  validateAssessment,
} from '../lib/coaching.js'
import { GRADE6_SEMESTER2_UNITS } from '../lib/curriculum.js'
import { summarizeWritingChanges } from '../lib/interviewRound.js'

dotenv.config({ path: '.env.local', quiet: true })

export const MODELS = [
  { key: '2.5-lite', model: 'gemini-2.5-flash-lite' },
  { key: '3.5-lite', model: 'gemini-3.5-flash-lite' },
  { key: '3.8-low', model: 'gemini-3.8-flash', thinking: { thinkingLevel: 'low' } },
  { key: '3.8', model: 'gemini-3.8-flash' },
]

function parseArgs(args) {
  const options = { runs: 5, concurrency: 8, only: ['e1', 'e2', 'e3', 'e4', 'e0'] }
  for (let index = 0; index < args.length; index += 2) {
    const [flag, value] = [args[index], args[index + 1]]
    if (flag === '--runs') options.runs = Number(value)
    else if (flag === '--concurrency') options.concurrency = Number(value)
    else if (flag === '--only') options.only = value.split(',')
    else throw new Error(`알 수 없는 옵션: ${flag}`)
  }
  return options
}

// ── Gemini ──────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function gemini(cfg, prompt, schema, temperature) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`
  let lastError = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const startedAt = Date.now()
    let response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: schema,
            ...(cfg.thinking ? { thinkingConfig: cfg.thinking } : {}),
          },
        }),
      })
    } catch (error) {
      lastError = `network ${error.message}`
      await sleep(2000 * 2 ** attempt)
      continue
    }
    const ms = Date.now() - startedAt
    if (response.status === 429 || response.status >= 500) {
      lastError = `HTTP ${response.status}`
      await sleep(2000 * 2 ** attempt)
      continue
    }
    const data = await response.json()
    if (!response.ok) return { error: `HTTP ${response.status} ${data?.error?.message ?? ''}`, ms }
    const usage = data.usageMetadata ?? {}
    const text = data?.candidates?.[0]?.content?.parts?.find((part) => !part.thought)?.text
    if (!text) return { error: `빈 응답 (${data?.candidates?.[0]?.finishReason ?? '?'})`, ms, usage }
    try {
      return { json: JSON.parse(text), ms, usage }
    } catch {
      return { error: 'JSON 파싱 실패', ms, usage, raw: text.slice(0, 500) }
    }
  }
  return { error: lastError ?? '재시도 소진' }
}

const usageOf = (result) => ({
  ms: result.ms ?? null,
  inTokens: result.usage?.promptTokenCount ?? 0,
  outTokens: result.usage?.candidatesTokenCount ?? 0,
  thinkTokens: result.usage?.thoughtsTokenCount ?? 0,
})

async function pool(tasks, concurrency, label) {
  const out = new Array(tasks.length)
  let next = 0
  let done = 0
  const startedAt = Date.now()
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < tasks.length) {
      const index = next
      next += 1
      out[index] = await tasks[index]()
      done += 1
      if (done % 25 === 0 || done === tasks.length) {
        console.log(`  ${label} ${done}/${tasks.length} (${Math.round((Date.now() - startedAt) / 1000)}s)`)
      }
    }
  }))
  return out
}

// ── 데이터 ──────────────────────────────────────────────────────────────

const STATUS_RANK = { unmet: 0, partial: 1, met: 2 }
const bullets = (lines) => lines.filter(Boolean).map((line) => `- ${line}`).join('\n')

async function loadData() {
  const units = GRADE6_SEMESTER2_UNITS.filter((unit) => getUnitCoachingSpec(unit.id))
  const smoke = []
  for (const unit of units) {
    try {
      const cases = JSON.parse(await fs.readFile(path.resolve('evals', 'smoke', `${unit.id}.json`), 'utf8'))
      for (const testCase of cases) {
        smoke.push({ unitId: unit.id, id: testCase.id, topic: testCase.topic ?? null, writing: testCase.writing, intended: testCase.intended })
      }
    } catch { /* 샘플 없는 단원 */ }
  }
  const demo = []
  for (const dir of await fs.readdir('demo')) {
    if (!dir.startsWith('g6s2-')) continue
    for (const file of await fs.readdir(path.join('demo', dir))) {
      if (!file.endsWith('.json')) continue
      const state = JSON.parse(await fs.readFile(path.join('demo', dir, file), 'utf8'))
      demo.push({
        unitId: state.unitId,
        id: `${state.unitId}/${state.student}`,
        topic: state.topic ?? null,
        rounds: state.rounds.map((round) => ({ writing: round.writing, missions: round.missions ?? [], assessments: round.assessments ?? [] })),
      })
    }
  }
  return { smoke, demo }
}

const criteriaOf = (spec) => spec.rubrics.flatMap((rubric) => rubric.criteria)

function majority(statusLists) {
  const counts = {}
  for (const status of statusLists) counts[status] = (counts[status] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || STATUS_RANK[a[0]] - STATUS_RANK[b[0]])[0]?.[0] ?? null
}

// ── E1: 채점기준 판정 ──────────────────────────────────────────────────

function e1Tasks(data, runs) {
  const tasks = []
  const push = (cfg, meta, promptArgs, expectedMissions) => {
    const spec = getUnitCoachingSpec(meta.unitId)
    tasks.push(async () => {
      const result = await gemini(cfg, buildAssessmentPrompt({ spec, ...promptArgs }), spec.assessmentSchema, 0)
      let error = result.error ?? null
      if (!error) {
        try { validateAssessment(result.json, spec.rubrics, expectedMissions) } catch (validation) { error = `검증 ${validation.message}` }
      }
      return {
        exp: 'e1', cfg: cfg.key, ...meta, error,
        meaningless: result.json?.meaningless ?? null,
        statuses: Object.fromEntries((result.json?.criteria ?? []).map((c) => [c.criterionId, c.status])),
        priorMissions: result.json?.priorMissions ?? [],
        ...usageOf(result),
      }
    })
  }
  for (const cfg of MODELS) {
    for (let run = 1; run <= runs; run += 1) {
      for (const item of data.smoke) {
        push(cfg, { kind: 'smoke', unitId: item.unitId, id: item.id, run }, { topic: item.topic, writing: item.writing }, [])
      }
      for (const student of data.demo) {
        student.rounds.forEach((round, k) => {
          push(cfg, { kind: 'demo-independent', unitId: student.unitId, id: student.id, k, run }, { topic: student.topic, writing: round.writing }, [])
          if (k === 0) return
          const previous = student.rounds[k - 1]
          push(cfg, { kind: 'demo-combined', unitId: student.unitId, id: student.id, k, run }, {
            topic: student.topic,
            writing: round.writing,
            previousWriting: previous.writing,
            previousMissions: previous.missions,
            changes: summarizeWritingChanges(previous.writing, round.writing),
          }, previous.missions)
        })
      }
    }
  }
  return tasks
}

// ── E2: 하락 확인 ──────────────────────────────────────────────────────

export function buildRegressionCheckPrompt({ spec, previousWriting, writing, changes, drops }) {
  const byId = new Map(criteriaOf(spec).map((criterion) => [criterion.id, criterion]))
  const dropText = drops.map(({ criterionId, from, to }) => {
    const criterion = byId.get(criterionId)
    return `- criterionId=${criterionId}
  채점기준: ${criterion.label}
  고치기 전 판정: ${from} → 이번 판정: ${to}
   - met(충족): ${criterion.statuses.met}
   - partial(부분): ${criterion.statuses.partial}
   - unmet(미충족): ${criterion.statuses.unmet}`
  }).join('\n')

  return `너는 초등학교 6학년 학생 글의 채점기준 판정이 바르게 내려갔는지 다시 확인하는 판정자야.
아래 채점기준들은 고치기 전 글보다 이번 글에서 판정이 낮아졌어. 판정이 낮아진 것이 학생이 글을 실제로 나쁘게 고쳤기 때문인지 확인해.

[확인할 채점기준]
${dropText}

[고치기 전 글]
---
${previousWriting}
---

[이번 글]
---
${writing}
---

[이번 수정에서 새로 추가한 부분]
${changes.added || '(추가된 부분 없음)'}

[이번 수정에서 지운 부분]
${changes.removed || '(지운 부분 없음)'}

[확인 원칙]
- 그 채점기준에 관련된 내용이 이번 글에서 실제로 지워졌거나, 고쳐 쓰면서 분명히 약해졌으면 regressed를 true로 해.
- 관련 내용이 이번 글에도 그대로(또는 거의 그대로) 남아 있으면 regressed를 false로 해. 글의 다른 부분이 바뀐 것은 상관없어.
- 맞춤법이나 문장이 미숙한 것은 이유가 되지 않아.
- 모든 확인할 채점기준을 하나씩 판단해.`
}

function regressionSchema(drops) {
  return {
    type: 'object',
    properties: {
      checks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            criterionId: { type: 'string', enum: drops.map((drop) => drop.criterionId) },
            regressed: { type: 'boolean' },
          },
          required: ['criterionId', 'regressed'],
        },
        minItems: drops.length,
        maxItems: drops.length,
      },
    },
    required: ['checks'],
  }
}

function e2Tasks(data, e1) {
  const tasks = []
  const independent = e1.filter((record) => record.kind === 'demo-independent' && !record.error && !record.meaningless)
  const smokeRecords = e1.filter((record) => record.kind === 'smoke' && !record.error && !record.meaningless)

  const addTask = (cfg, meta, spec, previousWriting, writing, drops) => {
    const changes = summarizeWritingChanges(previousWriting, writing)
    tasks.push(async () => {
      const result = await gemini(cfg, buildRegressionCheckPrompt({ spec, previousWriting, writing, changes, drops }), regressionSchema(drops), 0)
      return { exp: 'e2', cfg: cfg.key, ...meta, drops, checks: result.json?.checks ?? null, error: result.error ?? null, ...usageOf(result) }
    })
  }

  for (const cfg of MODELS) {
    for (const student of data.demo) {
      const spec = getUnitCoachingSpec(student.unitId)
      const ids = criteriaOf(spec).map((criterion) => criterion.id)
      for (let k = 1; k < student.rounds.length; k += 1) {
        const previousRuns = independent.filter((r) => r.cfg === cfg.key && r.id === student.id && r.k === k - 1)
        const currentRuns = independent.filter((r) => r.cfg === cfg.key && r.id === student.id && r.k === k)
        if (!previousRuns.length) continue
        const previous = Object.fromEntries(ids.map((id) => [id, majority(previousRuns.map((r) => r.statuses[id]))]))
        for (const run of currentRuns) {
          const drops = ids
            .filter((id) => STATUS_RANK[run.statuses[id]] < STATUS_RANK[previous[id]])
            .map((id) => ({ criterionId: id, from: previous[id], to: run.statuses[id] }))
          if (drops.length) {
            addTask(cfg, { kind: 'demo', unitId: student.unitId, id: student.id, k, run: run.run }, spec,
              student.rounds[k - 1].writing, student.rounds[k].writing, drops)
          }
        }
      }
    }
    // 같은 글에 대한 흔들림. 고치기 전과 이번 글이 같으므로 하락 확인은 전부
    // false여야 한다 — 확인 프롬프트가 제정신인지 보는 대조군.
    for (const item of data.smoke) {
      const spec = getUnitCoachingSpec(item.unitId)
      const ids = criteriaOf(spec).map((criterion) => criterion.id)
      const runs = smokeRecords.filter((r) => r.cfg === cfg.key && r.id === item.id)
      const previous = Object.fromEntries(ids.map((id) => [id, majority(runs.map((r) => r.statuses[id]))]))
      for (const run of runs) {
        const drops = ids
          .filter((id) => STATUS_RANK[run.statuses[id]] < STATUS_RANK[previous[id]])
          .map((id) => ({ criterionId: id, from: previous[id], to: run.statuses[id] }))
        if (drops.length) {
          addTask(cfg, { kind: 'same-text', unitId: item.unitId, id: item.id, run: run.run }, spec, item.writing, item.writing, drops)
        }
      }
    }
  }
  return tasks
}

// ── E3: 미션 수행 판정 (따로 떼어 낸 호출, 엄격 vs 관대) ───────────────

const STRICT_RULES = [
  'done: 확인 기준을 분명히 만족하는 변화가 있다.',
  'partial: 그 방향으로 고친 흔적은 있지만 확인 기준을 아직 만족하지 못한다.',
  'not-done: 관련된 변화가 없다.',
  '확인 기준에서 요구한 내용이 새로 추가되었으면 짧아도 done이야. 이미 있던 내용만 조금 바꿨거나 요구한 내용의 일부만 추가했을 때 partial이야.',
  '글 전체가 아니라 고치기 전후의 변화와 확인 기준을 함께 근거로 삼아.',
]
const LENIENT_RULES = [
  'done: 미션 방향에 맞는 의미 있는 개선이 있다. 문장이 짧거나 표현이 서툴러도 미션이 요구한 행동을 했으면 done이야.',
  'partial: 고친 흔적은 있지만 미션과의 관련성이나 개선이 부족하다.',
  'not-done: 미션과 관련된 수정이 없다.',
  '완벽한 문장이나 높은 글쓰기 수준을 요구하지 마. 확인 기준은 참고하되, 미션 설명에 없는 새로운 요구나 지나치게 엄격한 조건을 덧붙이지 마.',
  '글자 수만 늘린 것, 미션과 관계없는 내용을 추가한 것, 의미 없는 수정은 done이 아니야.',
  '글 전체가 아니라 고치기 전후의 변화를 근거로 삼아.',
]

export function buildMissionCheckPrompt({ previousWriting, writing, changes, missions, rules }) {
  const missionText = missions.map((mission, index) => `${index + 1}. missionId: ${mission.id}
   제목: ${mission.title}
   설명: ${mission.instruction}
   확인 기준: ${mission.criterion}`).join('\n')
  return `너는 초등학교 6학년 학생이 지난번 받은 수정미션을 이번 퇴고에서 수행했는지 확인하는 도우미야.

[고치기 전 글]
---
${previousWriting}
---

[고친 후 글]
---
${writing}
---

[이번 수정에서 새로 추가한 부분]
${changes.added || '(추가된 부분 없음)'}

[이번 수정에서 지운 부분]
${changes.removed || '(지운 부분 없음)'}

[지난 수정미션]
${missionText}

[판정 기준]
${bullets(rules)}

각 미션의 missionId를 그대로 복사해 done, partial, not-done 중 하나로 판정해.`
}

function missionCheckSchema(missions) {
  return {
    type: 'object',
    properties: {
      priorMissions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            missionId: { type: 'string', enum: missions.map((mission) => mission.id) },
            status: { type: 'string', enum: ['done', 'partial', 'not-done'] },
          },
          required: ['missionId', 'status'],
        },
        minItems: missions.length,
        maxItems: missions.length,
      },
    },
    required: ['priorMissions'],
  }
}

const IRRELEVANT_ADDITION = '\n\n오늘 급식에 떡볶이가 나와서 정말 맛있었다. 내일도 떡볶이가 나왔으면 좋겠다.'

function paddingOf(writing) {
  const sentences = writing.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim().length > 4)
  const last = sentences.at(-1) ?? ''
  return `${writing} ${last} 정말 그랬다. 정말 정말 그랬다.`
}

function e3Tasks(data, runs) {
  const tasks = []
  const items = []
  for (const student of data.demo) {
    for (let k = 1; k < student.rounds.length; k += 1) {
      items.push({ kind: 'real', id: student.id, unitId: student.unitId, k, previous: student.rounds[k - 1], writing: student.rounds[k].writing })
    }
    const first = student.rounds[0]
    items.push({ kind: 'control-irrelevant', id: student.id, unitId: student.unitId, k: 1, previous: first, writing: first.writing + IRRELEVANT_ADDITION })
    items.push({ kind: 'control-padding', id: student.id, unitId: student.unitId, k: 1, previous: first, writing: paddingOf(first.writing) })
  }
  for (const cfg of MODELS) {
    for (const item of items) {
      if (!item.previous.missions.length) continue
      for (const [wording, rules] of [['strict', STRICT_RULES], ['lenient', LENIENT_RULES]]) {
        for (let run = 1; run <= runs; run += 1) {
          tasks.push(async () => {
            const changes = summarizeWritingChanges(item.previous.writing, item.writing)
            const result = await gemini(cfg, buildMissionCheckPrompt({
              previousWriting: item.previous.writing, writing: item.writing, changes, missions: item.previous.missions, rules,
            }), missionCheckSchema(item.previous.missions), 0)
            return {
              exp: 'e3', cfg: cfg.key, kind: item.kind, id: item.id, unitId: item.unitId, k: item.k, wording, run,
              missions: item.previous.missions.map((mission) => ({ id: mission.id, title: mission.title })),
              priorMissions: result.json?.priorMissions ?? null, error: result.error ?? null, ...usageOf(result),
            }
          })
        }
      }
    }
  }
  return tasks
}

// ── E4: AI가 고르는 미션 3개 ───────────────────────────────────────────

export function buildNewMissionPrompt({ spec, writing, statuses }) {
  const criteria = criteriaOf(spec)
  const allMet = criteria.every((criterion) => statuses[criterion.id] === 'met')
  const criterionText = criteria.map((criterion) => `- criterionId=${criterion.id}
  채점기준: ${criterion.label}
  판정: ${statuses[criterion.id]}
  선생님이 정한 미션 방향: ${criterion.missionSeed ?? '(없음)'}`).join('\n')
  const { grounding, selfFill } = spec.missionGuidance ?? {}
  const missionNotes = criteria.flatMap((criterion) => criterion.missionNotes ?? [])

  const choosing = allMet
    ? `[심화 미션]
모든 채점기준을 충족한 글이야. 부족한 점을 억지로 만들어 내지 마.
- 위 채점기준 가운데 하나와 연결해, 글의 구체성·표현력·생동감·내용의 깊이를 한 걸음 더 발전시키는 심화 미션 3개를 만들어.
- 새로운 평가 기준을 만들지 마.
- 잘한 점에서 이미 잘 썼다는 것을 충분히 칭찬해. 더 고칠지는 학생이 고른다.`
    : `[미션 고르는 원칙]
- 미션마다 위 채점기준 가운데 하나를 골라 criterionId에 그 id를 그대로 써.
- unmet과 partial을 모두 고려하되 무조건 unmet부터 고르지 마. 학생 글에서 고치면 가장 좋아지고 실행하기 쉬운 곳을 먼저 골라.
- 모자란 기준이 3개보다 적으면 한 기준에서 다른 곳을 짚거나, 이미 충족한 기준을 한 걸음 더 발전시키는 미션을 섞어도 돼.
- 미션은 한 번의 퇴고로 해낼 수 있게 작고 구체적으로 만들어.`

  return `너는 초등학교 6학년 글쓰기를 돕는 친절한 공룡 코치 '디노'야.
판정 결과와 학생 글을 보고, 학생이 이번 퇴고에서 골라 해 볼 수정미션 3개를 직접 골라 만들어.
미리 만든 문장을 복사하지 말고, 학생 글에 실제로 나온 내용과 선생님이 정한 미션 방향을 연결해 매번 새로 작성해.

[학생 글]
---
${writing}
---

[채점기준과 판정]
${criterionText}

${choosing}

[잘한 점 작성 규칙]
- 충족한 채점기준 하나를 골라 학생 글에 실제로 나온 부분을 짚어 칭찬해.
- 충족한 기준이 없으면 criterionId를 effort로 쓰고, 루브릭을 충족했다고 꾸미지 말고 글을 끝까지 쓴 노력처럼 사실인 점만 칭찬해.

[수정미션 작성 규칙]
${bullets([
    '수정미션은 정확히 3개 만들어.',
    "title은 반드시 행동을 나타내는 짧은 명사형 '-기'로 끝내. 예: '까닭 추가하기', '느낀 점 덧붙이기'.",
    'instruction에는 학생 글에서 어디를, 무엇으로, 어떻게 고칠지 드러내.',
    grounding,
    '완성 문장이나 모범답안을 대신 쓰지 마. 학생이 그대로 베낄 답을 주지 마.',
    "'예를 들어' 뒤에 학생이 베낄 문장을 제시하지 마. 글에 없는 이유나 상황을 선택지로 만들어 주지도 마.",
    selfFill,
    "'자세히 쓰기', '자세히 써 보세요', '구체적으로 쓰기', '내용 보충하기', '더 잘 다듬기'라는 막연한 표현은 사용하지 마. 글의 위치나 주제를 함께 언급해도 이 표현 자체를 쓰면 안 돼.",
    ...missionNotes,
    '세 미션이 서로 같은 행동을 요구하지 않게 해.',
    'criterion에는 다음 라운드에서 실제 변화로 확인할 수 있는 한 문장의 기준을 써.',
    '점수, 등급, 상·중·하 표현을 사용하지 마.',
  ])}`
}

function newMissionSchema(spec) {
  const ids = criteriaOf(spec).map((criterion) => criterion.id)
  return {
    type: 'object',
    properties: {
      strength: {
        type: 'object',
        properties: { criterionId: { type: 'string', enum: [...ids, 'effort'] }, text: { type: 'string' } },
        required: ['criterionId', 'text'],
      },
      missions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            criterionId: { type: 'string', enum: ids },
            title: { type: 'string' },
            instruction: { type: 'string' },
            criterion: { type: 'string' },
          },
          required: ['id', 'criterionId', 'title', 'instruction', 'criterion'],
        },
        minItems: 3,
        maxItems: 3,
      },
    },
    required: ['strength', 'missions'],
  }
}

// lib/coaching.js의 검사들을 하나씩 따로 건다 — 재시도 없이 첫 응답이 어느
// 규칙에 걸리는지 세려고. 정규식은 그 파일과 같게 둔다.
const VAGUE = /(자세히\s*(?:써|쓰)|구체적으로\s*(?:써|쓰)|내용\s*(?:을\s*)?보충|더\s*잘\s*다듬)/u
function isVagueOnly(mission) {
  if (!/(자세히|구체적으로|내용\s*보충|더\s*잘\s*다듬)/.test(`${mission.title} ${mission.instruction}`)) return false
  const rest = mission.instruction.replace(/자세히|구체적으로|내용을?|보충|더|잘|다듬|써\s*보세요|쓰기|해\s*보세요|하세요|[.\s]/g, '')
  return rest.length < 8
}
function hasUngroundedQuote(instruction, writing) {
  const normalized = writing.replace(/\s+/g, ' ')
  return [...instruction.matchAll(/['"‘“]([^'"’”]{4,})['"’”]/gu)]
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
    .some((part) => !normalized.includes(part))
}

export function checkMissionResult(json, { spec, writing, statuses }) {
  const ids = new Set(criteriaOf(spec).map((criterion) => criterion.id))
  const met = [...ids].filter((id) => statuses[id] === 'met')
  const missions = Array.isArray(json?.missions) ? json.missions : []
  const hits = {}
  const flag = (rule) => { hits[rule] = (hits[rule] ?? 0) + 1 }
  if (missions.length !== 3) flag('개수 3개 아님')
  if (!json?.strength?.text?.trim()) flag('잘한 점 비어 있음')
  else if (met.length && !met.includes(json.strength.criterionId)) flag('잘한 점이 met 기준을 안 가리킴')
  else if (!met.length && json.strength.criterionId !== 'effort') flag('잘한 점이 effort가 아님')
  const seenIds = new Set()
  for (const mission of missions) {
    if (!mission.id?.trim() || seenIds.has(mission.id)) flag('미션 id 비었거나 중복')
    seenIds.add(mission.id)
    if (!ids.has(mission.criterionId)) flag('모르는 기준')
    if (!mission.instruction?.trim()) { flag('설명 비어 있음'); continue }
    if (!mission.criterion?.trim()) flag('확인 기준 비어 있음')
    if (!ACTION_TITLE_PATTERN.test((mission.title ?? '').trim())) flag('제목 -기 목록 밖')
    if (!ACTION_INSTRUCTION_PATTERN.test(mission.instruction)) flag('설명에 동작 없음')
    if (VAGUE.test(`${mission.title} ${mission.instruction}`)) flag('막연한 표현')
    if (isVagueOnly(mission)) flag('막연하기만 함')
    if (/예를\s*들어|예시\s*문장|와\s*같이\s*써/.test(mission.instruction)) flag('예시 문장')
    if (/(듣지\s*못했다면|모른다면)[\s\S]*(생각|상상|추측)[\s\S]*(덧붙|써|쓰)/u.test(mission.instruction)) flag('사실 지어내기 요구')
    if (hasUngroundedQuote(mission.instruction, writing)) flag('글에 없는 인용')
  }
  return hits
}

function e4Tasks(data, runs) {
  const items = [
    ...data.smoke.map((item) => ({ kind: 'smoke', unitId: item.unitId, id: item.id, writing: item.writing, statuses: item.intended })),
    ...data.demo.map((student) => ({
      kind: 'demo-r1',
      unitId: student.unitId,
      id: student.id,
      writing: student.rounds[0].writing,
      statuses: Object.fromEntries(student.rounds[0].assessments.map((a) => [a.criterionId, a.status])),
    })),
  ]
  const tasks = []
  for (const cfg of MODELS) {
    for (const item of items) {
      const spec = getUnitCoachingSpec(item.unitId)
      // 의도 판정이 일부 기준만 적었으면 빈 칸은 partial로 둔다.
      const statuses = Object.fromEntries(criteriaOf(spec).map((c) => [c.id, item.statuses?.[c.id] ?? 'partial']))
      for (let run = 1; run <= runs; run += 1) {
        tasks.push(async () => {
          const result = await gemini(cfg, buildNewMissionPrompt({ spec, writing: item.writing, statuses }), newMissionSchema(spec), 0.7)
          return {
            exp: 'e4', cfg: cfg.key, kind: item.kind, unitId: item.unitId, id: item.id, run, statuses,
            allMet: Object.values(statuses).every((status) => status === 'met'),
            strength: result.json?.strength ?? null,
            missions: result.json?.missions ?? null,
            hits: result.json ? checkMissionResult(result.json, { spec, writing: item.writing, statuses }) : null,
            error: result.error ?? null,
            ...usageOf(result),
          }
        })
      }
    }
  }
  return tasks
}

// ── E0: 지금 파이프라인 기준선 (2.5-lite, 재시도 사유) ─────────────────

function e0Tasks(data, runs) {
  const tasks = []
  for (const item of data.smoke) {
    for (let run = 1; run <= runs; run += 1) {
      tasks.push(async () => {
        const reasons = []
        const original = console.error
        const startedAt = Date.now()
        // 동시에 여러 개가 돌면 console.error 가로채기가 섞이므로 E0은 하나씩 돈다.
        console.error = (...args) => {
          if (typeof args[0] === 'string' && args[0].startsWith('Gemini JSON validation failed:')) reasons.push(String(args[1] ?? ''))
        }
        process.env.DEBUG_INTERVIEW_PROMPT = '1'
        try {
          const result = await getRubricCoachingFeedback({ spec: getUnitCoachingSpec(item.unitId), topic: item.topic, writing: item.writing })
          return { exp: 'e0', cfg: '2.5-lite', id: item.id, unitId: item.unitId, run, reasons, ms: Date.now() - startedAt, missions: result.missions, error: null }
        } catch (error) {
          return { exp: 'e0', cfg: '2.5-lite', id: item.id, unitId: item.unitId, run, reasons, ms: Date.now() - startedAt, error: error.message }
        } finally {
          console.error = original
          delete process.env.DEBUG_INTERVIEW_PROMPT
        }
      })
    }
  }
  return tasks
}

// ── 실행 ────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("measure-feedback-redesign.js")) {
  const options = parseArgs(process.argv.slice(2))
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY 없음')
  const data = await loadData()
  console.log(`스모크 글 ${data.smoke.length}편 · 시범 학생 ${data.demo.length}명 · 모델 ${MODELS.map((m) => m.key).join(', ')}`)

  const outDir = path.resolve('.smoke-results')
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `measure-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  const records = []
  const save = () => fs.writeFile(outPath, JSON.stringify({ options, models: MODELS, records }, null, 2), 'utf8')

  let e1 = []
  if (options.only.includes('e1') || options.only.includes('e2')) {
    console.log('\nE1 채점기준 판정')
    e1 = await pool(e1Tasks(data, options.runs), options.concurrency, 'E1')
    records.push(...e1)
    await save()
  }
  if (options.only.includes('e2')) {
    console.log('\nE2 하락 확인')
    records.push(...await pool(e2Tasks(data, e1), options.concurrency, 'E2'))
    await save()
  }
  if (options.only.includes('e3')) {
    console.log('\nE3 미션 수행 판정')
    records.push(...await pool(e3Tasks(data, 3), options.concurrency, 'E3'))
    await save()
  }
  if (options.only.includes('e4')) {
    console.log('\nE4 미션 3개 생성')
    records.push(...await pool(e4Tasks(data, 3), options.concurrency, 'E4'))
    await save()
  }
  if (options.only.includes('e0')) {
    console.log('\nE0 지금 파이프라인 기준선')
    records.push(...await pool(e0Tasks(data, 2), 1, 'E0'))
    await save()
  }
  console.log(`\n기록: ${outPath}`)
}
