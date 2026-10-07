// 로그인한 교사의 눈으로 주요 화면을 한 번씩 열어 본다. 렌더링이 실제로
// 되는지(=서버 워커가 죽지 않는지)를 브라우저 없이 확인하는 용도다.
//
// 교사 세션 쿠키는 DB의 Session 행에서 가져온다. 토큰은 출력하지 않는다.
// 읽기만 하며, 아무것도 바꾸지 않는다.
//
//   node scripts/probe-pages.js

import process from 'node:process'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const BASE = process.env.PROBE_BASE ?? 'http://localhost:3000'
const { prisma } = await import('../lib/prisma.js')

const session = await prisma.session.findFirst({
  where: { expires: { gt: new Date() }, user: { email: 'dev-teacher@localhost.test' } },
  orderBy: { expires: 'desc' },
  include: { user: { select: { email: true, id: true } } },
})

if (!session) {
  console.log('유효한 테스트 교사 세션이 없습니다. 브라우저에서 /login → 🧪 버튼을 한 번 누르세요.')
  await prisma.$disconnect()
  process.exit(1)
}

const cookie = `authjs.session-token=${session.sessionToken}`
console.log(`세션: ${session.user.email} (만료 ${session.expires.toISOString().slice(0, 10)})\n`)

const demoTitles = [
  '면담 보고서 - 우리 마을에서 오래 일하신 분',
  '기사문 - 우리 학교 소식',
  '매체 성찰 보고서 - 나의 매체 이용 습관',
  '이야기 바꾸어 쓰기 - 경험을 떠올리며',
]

const activities = await prisma.activity.findMany({
  where: { teacherId: session.user.id, title: { in: demoTitles } },
  include: { submissions: { select: { id: true, studentName: true } } },
})

const targets = [{ label: '교사 대시보드', url: `${BASE}/dashboard` }]
for (const activity of activities) {
  targets.push({ label: `활동: ${activity.title}`, url: `${BASE}/dashboard/${activity.id}` })
  for (const submission of activity.submissions) {
    targets.push({
      label: `  └ 학생 보드: ${submission.studentName}`,
      url: `${BASE}/dashboard/${activity.id}/students/${submission.id}`,
    })
  }
}

let failures = 0
for (const target of targets) {
  const startedAt = Date.now()
  try {
    const response = await fetch(target.url, { headers: { cookie }, redirect: 'manual' })
    const body = response.status === 200 ? await response.text() : ''
    // 워커가 죽으면 200이 아니라 500이 오거나, 200이어도 본문에 오류 화면이 담긴다.
    const broken = /Runtime Error|child process exceptions|Internal Server Error/i.test(body)
    const ok = response.status === 200 && !broken
    if (!ok) failures += 1
    console.log(
      `${ok ? '✓' : '✗'} ${String(response.status).padEnd(4)}`
      + `${String(Date.now() - startedAt).padStart(5)}ms  ${target.label}`
      + (broken ? '   ← 본문에 오류 화면' : ''),
    )
  } catch (error) {
    failures += 1
    console.log(`✗ ---  ${target.label}  — ${error.message}`)
  }
}

console.log(`\n${targets.length}개 화면 중 문제 ${failures}건`)
await prisma.$disconnect()
process.exit(failures > 0 ? 1 : 0)
