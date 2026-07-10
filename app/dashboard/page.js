import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, signOut } from '../../auth.js'
import { prisma } from '../../lib/prisma.js'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const activities = await prisma.activity.findMany({
    where: { teacherId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { submissions: true } } },
  })

  return (
    <div className="container">
      <div className="top-bar">
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>🦕 내 활동</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="teacher-email">{session.user.email}</span>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <button type="submit" className="sign-out-link">
              로그아웃
            </button>
          </form>
        </div>
      </div>

      <Link href="/dashboard/new" className="button-primary" style={{ marginBottom: '1.5rem', display: 'block' }}>
        + 새 활동 만들기
      </Link>

      {activities.length === 0 ? (
        <p className="empty-state">아직 만든 활동이 없어요. 위 버튼으로 첫 활동을 만들어보세요.</p>
      ) : (
        activities.map((activity) => (
          <Link key={activity.id} href={`/dashboard/${activity.id}`} className="activity-card">
            <h3>{activity.title}</h3>
            <p>
              {activity.topic} · 목표 {activity.targetLength}자 · 참여 학생 {activity._count.submissions}명
            </p>
          </Link>
        ))
      )}
    </div>
  )
}
