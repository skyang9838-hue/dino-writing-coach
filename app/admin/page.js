import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '../../auth.js'
import { prisma } from '../../lib/prisma.js'
import { isAdmin } from '../../lib/admin.js'
import { ActivityCard } from '../../components/ActivityCard.jsx'
import { TeacherHeader } from '../../components/TeacherHeader.jsx'
import { getGenreIcon } from '../../lib/curriculum.js'

// Overview of every teacher → their activities, most recently active first.
// Pages are read-only for admins (see lib/admin.js); the ⋯ menu can still
// delete an activity.
export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!isAdmin(session.user.email)) notFound()

  const teachers = await prisma.user.findMany({
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { submissions: true } } },
      },
    },
  })

  // Newest activity first; teachers with no activity sink to the bottom.
  const latest = (teacher) => teacher.activities[0]?.createdAt.getTime() ?? 0
  teachers.sort((a, b) => latest(b) - latest(a))

  return (
    <div className="container-wide">
      <Link href="/dashboard" className="new-writing-link">
        ← 내 활동으로
      </Link>
      <TeacherHeader
        title="전체 보기"
        subtitle={`선생님 ${teachers.length}명`}
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
              <ActivityCard
                key={activity.id}
                activity={activity}
                icon={getGenreIcon(activity.genre)}
                studentCount={activity._count.submissions}
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}
