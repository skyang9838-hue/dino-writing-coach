import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '../../auth.js'
import { prisma } from '../../lib/prisma.js'
import { isAdmin } from '../../lib/admin.js'
import { TeacherHeader } from '../../components/TeacherHeader.jsx'
import { getGenreIcon } from '../../lib/curriculum.js'

// Read-only overview of every teacher → their activities. Each activity links
// to the normal teacher pages, which let admins in (see lib/admin.js).
export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!isAdmin(session.user.email)) notFound()

  const teachers = await prisma.user.findMany({
    orderBy: { email: 'asc' },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { submissions: true } } },
      },
    },
  })

  return (
    <div className="container-wide">
      <Link href="/dashboard" className="new-writing-link">
        ← 내 활동으로
      </Link>
      <TeacherHeader
        title="전체 보기"
        subtitle={`선생님 ${teachers.length}명 · 보기 전용`}
        email={session.user.email}
      />

      {teachers.map((teacher) => {
        const students = teacher.activities.reduce((sum, a) => sum + a._count.submissions, 0)
        return (
          <section key={teacher.id} className="dashboard-list-section">
            <h2 className="section-heading">
              👩‍🏫 {teacher.name || '(이름 없음)'} · {teacher.email}
            </h2>
            <p className="field-hint">
              활동 {teacher.activities.length}개 · 학생 {students}명
            </p>
            {teacher.activities.map((activity) => (
              <Link key={activity.id} href={`/dashboard/${activity.id}`} className="activity-card">
                <span className="activity-card-icon">{getGenreIcon(activity.genre)}</span>
                <span className="activity-card-body">
                  <h3>{activity.title}</h3>
                  <p>
                    {activity.topic || '자유 주제'} · 목표 {activity.targetLength}자 · 참여 학생{' '}
                    {activity._count.submissions}명
                  </p>
                </span>
                <span className="activity-card-chevron">›</span>
              </Link>
            ))}
          </section>
        )
      })}
    </div>
  )
}
