// demo/ 아래 시범 기록을 교사 대시보드에서 볼 수 있는 활동으로 넣는다.
//
// scripts/demo-unit-rounds.js가 만든 상태 JSON은 파일일 뿐이라 앱 화면에
// 나타나지 않는다. 이 스크립트는 그것을 Activity + Submission으로 옮겨,
// "내 활동" 목록과 학생별 수정 진행 보드에서 실제로 보이게 한다. 라운드
// 이력을 그대로 넣으므로 보드의 라운드별 판정과 도달도 변화까지 재현된다.
//
// ⚠️ .env.local의 DATABASE_URL은 프로덕션 Neon을 가리킨다. 여기 넣은 활동은
//    실서비스 데이터가 된다. --dry로 먼저 확인하고 --commit으로 넣는다.
//
//   node scripts/seed-demo-activities.js --dry
//   node scripts/seed-demo-activities.js --commit
//   node scripts/seed-demo-activities.js --commit --teacher me@example.com
//   node scripts/seed-demo-activities.js --remove          넣은 것을 도로 지운다

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import { generateJoinCode } from '../lib/joinCode.js'
import { getUnitById } from '../lib/curriculum.js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

// prisma.js는 불러오는 순간 DATABASE_URL로 풀을 연다. dotenv보다 먼저 돌면
// 안 되므로 정적 import가 아니라 여기서 부른다.
const { prisma } = await import('../lib/prisma.js')

// 활동 제목은 기존 활동들과 같은 꼴로 짓는다 — "장르 - 주제".
const TITLES = {
  'g6s2-unit2': '면담 보고서 - 우리 마을에서 오래 일하신 분',
  'g6s2-unit5': '기사문 - 우리 학교 소식',
  'g6s2-media': '매체 성찰 보고서 - 나의 매체 이용 습관',
  'g6s2-unit6': '이야기 바꾸어 쓰기 - 경험을 떠올리며',
}

function parseArgs(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (flag === '--dry') options.dry = true
    else if (flag === '--commit') options.commit = true
    else if (flag === '--remove') options.remove = true
    else if (flag === '--teacher') { options.teacher = args[index + 1]; index += 1 }
    else throw new Error(`알 수 없는 옵션: ${flag}`)
  }
  if (!options.dry && !options.commit && !options.remove) {
    throw new Error('--dry / --commit / --remove 가운데 하나가 필요합니다')
  }
  return options
}

// 단원별로 학생들을 모은다. 같은 단원의 두 학생은 한 활동에 함께 들어간다 —
// 교사 화면에서 잘 쓴 학생과 어려워하는 학생이 나란히 보이는 게 요점이다.
async function loadDemo() {
  const demoDir = path.resolve('demo')
  const byUnit = new Map()
  for (const entry of await fs.readdir(demoDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '기록') continue
    for (const file of await fs.readdir(path.join(demoDir, entry.name))) {
      if (!file.endsWith('.json')) continue
      const state = JSON.parse(await fs.readFile(path.join(demoDir, entry.name, file), 'utf8'))
      if (!byUnit.has(state.unitId)) byUnit.set(state.unitId, [])
      byUnit.get(state.unitId).push(state)
    }
  }
  for (const students of byUnit.values()) {
    students.sort((a, b) => a.student.localeCompare(b.student))
  }
  return byUnit
}

async function resolveTeacher(email) {
  if (email) {
    const teacher = await prisma.user.findUnique({ where: { email } })
    if (!teacher) throw new Error(`그런 교사가 없습니다: ${email}`)
    return teacher
  }
  // 활동을 가장 많이 만든 사람을 쓴다. 로그인해서 쓰고 있는 그 계정이다.
  const teachers = await prisma.user.findMany({
    include: { _count: { select: { activities: true } } },
  })
  if (teachers.length === 0) throw new Error('교사 계정이 하나도 없습니다. 먼저 로그인하세요.')
  teachers.sort((a, b) => b._count.activities - a._count.activities)
  return teachers[0]
}

// 마지막 라운드가 곧 지금 화면에 뜨는 피드백이다 (lib/interviewRound.js와 같은 모양).
const feedbackOf = (round) => ({
  strength: round.strength,
  missions: round.missions,
  assessments: round.assessments,
  priorMissionStatuses: round.priorMissionStatuses ?? [],
})

const options = parseArgs(process.argv.slice(2))
const byUnit = await loadDemo()
const teacher = await resolveTeacher(options.teacher)

console.log(`교사: ${teacher.email ?? teacher.id} (${teacher.name ?? '이름 없음'})`)
console.log(`단원 ${byUnit.size}개 · 학생 ${[...byUnit.values()].flat().length}명\n`)

if (options.remove) {
  let removed = 0
  for (const unitId of byUnit.keys()) {
    const result = await prisma.activity.deleteMany({
      where: { teacherId: teacher.id, title: TITLES[unitId] },
    })
    if (result.count) console.log(`  지움: ${TITLES[unitId]}`)
    removed += result.count
  }
  console.log(`\n활동 ${removed}개를 지웠습니다 (제출물도 함께).`)
  await prisma.$disconnect()
  process.exit(0)
}

for (const [unitId, students] of byUnit) {
  const unit = getUnitById(unitId)
  const title = TITLES[unitId] ?? `${unit?.genre} - ${unitId}`
  const topic = students[0].topic

  console.log(`■ ${title}`)
  console.log(`   단원 ${unitId} · 장르 ${unit?.genre} · 목표 ${unit?.recommendedLength}자 · 주제 "${topic}"`)
  for (const state of students) {
    const last = state.rounds.at(-1)
    console.log(
      `   └ ${state.student}: ${state.rounds.length}라운드 · 도달도 ${state.attainment}%`
      + ` · 마지막 글 ${last.writing.length}자`
      + ` · 판정 ${last.assessments.map((a) => a.status[0]).join('')}`,
    )
  }

  if (!options.commit) { console.log(''); continue }

  const existing = await prisma.activity.findFirst({
    where: { teacherId: teacher.id, title },
  })

  let activity = existing
  if (!activity) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        activity = await prisma.activity.create({
          data: {
            teacherId: teacher.id,
            title,
            topic,
            instructions: null,
            unitId,
            grade: '초5-6학년군',
            genre: unit?.genre ?? '보고서',
            targetLength: unit?.recommendedLength ?? 600,
            joinCode: generateJoinCode(),
          },
        })
        break
      } catch (err) {
        if (err?.code === 'P2002') continue // 참여 코드 충돌, 다시 뽑는다
        throw err
      }
    }
  }

  for (const state of students) {
    const last = state.rounds.at(-1)
    const data = {
      writing: last.writing,
      feedback: feedbackOf(last),
      attainment: state.attainment,
      lastSubmittedWriting: state.lastSubmittedWriting,
      lastImprovements: state.lastImprovements,
      rounds: state.rounds,
    }
    await prisma.submission.upsert({
      where: { activityId_studentName: { activityId: activity.id, studentName: state.student } },
      update: data,
      create: { activityId: activity.id, studentName: state.student, ...data },
    })
  }

  console.log(`   ✓ 참여 코드 ${activity.joinCode} · 제출물 ${students.length}개 저장\n`)
}

if (!options.commit) {
  console.log('--dry 였습니다. 실제로 넣으려면 --commit 을 붙이세요.')
  console.log('⚠️  .env.local의 DATABASE_URL은 프로덕션 Neon입니다 — 넣으면 실서비스 데이터가 됩니다.')
}

await prisma.$disconnect()
