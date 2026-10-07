// 지금 DB에 교사와 활동이 어떻게 들어 있는지 훑어본다. 읽기만 한다.
//
//   node scripts/show-db.js

import process from 'node:process'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const { prisma } = await import('../lib/prisma.js')

const teachers = await prisma.user.findMany({
  include: {
    activities: {
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { submissions: true } } },
    },
  },
})

for (const teacher of teachers) {
  console.log(`\n■ ${teacher.email ?? '(이메일 없음)'}  "${teacher.name ?? '-'}"  활동 ${teacher.activities.length}개`)
  for (const activity of teacher.activities) {
    console.log(
      `   [${activity.joinCode}] ${activity.title}`
      + `  unitId=${activity.unitId ?? '-'}`
      + `  학생 ${activity._count.submissions}명`
      + `  ${activity.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`,
    )
  }
}

const submissions = await prisma.submission.findMany({
  select: { studentName: true, attainment: true, rounds: true, activity: { select: { title: true } } },
})
console.log(`\n제출물 ${submissions.length}개`)
for (const submission of submissions) {
  const rounds = Array.isArray(submission.rounds) ? submission.rounds.length : 0
  console.log(`   ${submission.studentName}  도달도 ${submission.attainment ?? '-'}%  라운드 ${rounds}회  — ${submission.activity.title}`)
}

await prisma.$disconnect()
