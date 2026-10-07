// 방금 넣은 시범 제출물과 앱이 원래 만들어 온 제출물의 모양을 나란히 놓고 본다.
// 화면이 깨졌을 때 "내가 넣은 것이 앱이 기대하는 모양과 다른가"를 먼저 가른다.
// 읽기만 한다.

import process from 'node:process'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const { prisma } = await import('../lib/prisma.js')

const shape = (value, depth = 0) => {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[${value.length} × ${depth > 1 ? '…' : shape(value[0], depth + 1)}]`
  }
  if (typeof value === 'object') {
    if (depth > 1) return '{…}'
    return `{ ${Object.entries(value).map(([k, v]) => `${k}: ${shape(v, depth + 1)}`).join(', ')} }`
  }
  return typeof value
}

const SEEDED = ['정우진', '강예린', '민재', '수아', '김도윤', '이서연', '서준', '하은']

const all = await prisma.submission.findMany({
  include: { activity: { select: { title: true, unitId: true } } },
  orderBy: { updatedAt: 'desc' },
})

const seeded = all.filter((s) => SEEDED.includes(s.studentName))
// 비교 대상: 라운드가 실제로 쌓인 옛 제출물 가운데 가장 최근 것.
const organic = all.find((s) => !SEEDED.includes(s.studentName) && Array.isArray(s.rounds) && s.rounds.length > 0)

function describe(label, submission) {
  if (!submission) { console.log(`\n### ${label}: 없음`); return }
  const rounds = Array.isArray(submission.rounds) ? submission.rounds : []
  console.log(`\n### ${label} — ${submission.studentName} / ${submission.activity.title} (unitId=${submission.activity.unitId ?? '-'})`)
  console.log(`  attainment: ${submission.attainment}`)
  console.log(`  writing: ${submission.writing?.length ?? 0}자`)
  console.log(`  lastSubmittedWriting: ${submission.lastSubmittedWriting?.length ?? 'null'}`)
  console.log(`  lastImprovements: ${shape(submission.lastImprovements)}`)
  console.log(`  feedback: ${shape(submission.feedback)}`)
  console.log(`  rounds: ${rounds.length}개`)
  if (rounds.length) {
    console.log(`  rounds[0] 키: ${Object.keys(rounds[0]).join(', ')}`)
    console.log(`  rounds[0]: ${shape(rounds[0])}`)
    const last = rounds.at(-1)
    if (last !== rounds[0]) console.log(`  rounds[마지막] 키: ${Object.keys(last).join(', ')}`)
    const mission = rounds[0].missions?.[0]
    if (mission) console.log(`  미션 하나: ${JSON.stringify(mission)}`)
    const assessment = rounds[0].assessments?.[0]
    if (assessment) console.log(`  판정 하나: ${JSON.stringify(assessment)}`)
  }
}

describe('앱이 만든 것(대조군)', organic)
describe('이번에 넣은 것', seeded[0])

console.log('\n\n=== 넣은 제출물 8개 훑기 ===')
for (const submission of seeded) {
  const rounds = Array.isArray(submission.rounds) ? submission.rounds : []
  const problems = []
  for (const [i, round] of rounds.entries()) {
    if (typeof round.writing !== 'string') problems.push(`R${i + 1} writing 없음`)
    if (!Array.isArray(round.missions)) problems.push(`R${i + 1} missions 배열 아님`)
    if (!Array.isArray(round.assessments)) problems.push(`R${i + 1} assessments 배열 아님`)
    for (const mission of round.missions ?? []) {
      if (!mission.id) problems.push(`R${i + 1} 미션에 id 없음`)
      if (!Array.isArray(mission.criterionIds)) problems.push(`R${i + 1} 미션 criterionIds 배열 아님`)
    }
    for (const assessment of round.assessments ?? []) {
      if (!assessment.criterionId) problems.push(`R${i + 1} 판정에 criterionId 없음`)
      if (!assessment.status) problems.push(`R${i + 1} 판정에 status 없음`)
    }
  }
  console.log(`  ${submission.studentName}: 라운드 ${rounds.length} · ${problems.length ? `⚠️ ${problems.join(' / ')}` : '구조 이상 없음'}`)
}

await prisma.$disconnect()
