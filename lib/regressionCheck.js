// 판정은 회차마다 지금 글만 보고 새로 매긴다. 그래서 학생이 건드리지 않은
// 기준이 글의 다른 곳이 바뀌었다는 이유로 내려가는 일이 생길 수 있다.
//
// 예전에는 아예 잠갔다(한 번 올라간 판정은 내려오지 않음). 그러면 잘못 올라간
// 판정도 영영 굳는다. 이제는 내려간 기준이 있을 때만 고치기 전후 글을 한 번 더
// 보여 주고 "관련 내용이 실제로 지워지거나 약해졌는가"를 묻는다. 아니라면
// 직전 판정을 지킨다. 모델의 원래 판정은 라운드의 rawAssessments에 남는다.
//
// 측정(2026-10-12, 스펙 5-1절): 흔들린 하락 10칸 중 9칸이 확인 뒤 되돌아왔고,
// 같은 글 대조군에서 하락을 잘못 인정한 경우는 0건이었다.
export const STATUS_ORDER = { unmet: 0, partial: 1, met: 2 }

// 직전 회차보다 내려간 기준. 직전 판정이 없는 기준은 비교하지 않는다.
export function findDrops(current, previous) {
  if (!previous?.length) return []
  const previousById = new Map(previous.map((assessment) => [assessment.criterionId, assessment.status]))
  return current.flatMap((assessment) => {
    const from = previousById.get(assessment.criterionId)
    if (from === undefined || STATUS_ORDER[assessment.status] >= STATUS_ORDER[from]) return []
    return [{ criterionId: assessment.criterionId, from, to: assessment.status }]
  })
}

export function buildRegressionCheckPrompt({ spec, previousWriting, writing, changes, drops }) {
  const byId = new Map(spec.rubrics.flatMap((rubric) => rubric.criteria).map((criterion) => [criterion.id, criterion]))
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
${changes?.added || '(추가된 부분 없음)'}

[이번 수정에서 지운 부분]
${changes?.removed || '(지운 부분 없음)'}

[확인 원칙]
- 그 채점기준에 관련된 내용이 이번 글에서 실제로 지워졌거나, 고쳐 쓰면서 분명히 약해졌으면 regressed를 true로 해.
- 관련 내용이 이번 글에도 그대로(또는 거의 그대로) 남아 있으면 regressed를 false로 해. 글의 다른 부분이 바뀐 것은 상관없어.
- 맞춤법이나 문장이 미숙한 것은 이유가 되지 않아.
- 모든 확인할 채점기준을 하나씩 판단해.`
}

export function buildRegressionCheckSchema(drops) {
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

export function validateRegressionChecks(result, drops) {
  const ids = (result?.checks ?? []).map((check) => check?.criterionId).sort()
  const expected = drops.map((drop) => drop.criterionId).sort()
  if (
    ids.length !== expected.length
    || ids.some((id, index) => id !== expected[index])
    || result.checks.some((check) => typeof check.regressed !== 'boolean')
  ) {
    throw new Error('하락 확인 응답이 내려간 기준과 일치해야 함')
  }
  return result
}

// 회차에 남길 기록: [{ criterionId, from, to, regressed }]. regressed가 false인
// 기준만 직전 판정으로 되돌린다.
export function applyRegressionChecks(current, checks) {
  const kept = new Map(checks
    .filter((check) => !check.regressed)
    .map((check) => [check.criterionId, check.from]))
  if (!kept.size) return current
  return current.map((assessment) => kept.has(assessment.criterionId)
    ? { ...assessment, status: kept.get(assessment.criterionId) }
    : assessment)
}
