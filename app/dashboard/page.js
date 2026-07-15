import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '../../auth.js'
import { prisma } from '../../lib/prisma.js'
import { TeacherHeader } from '../../components/TeacherHeader.jsx'
import { NewActivityForm } from '../../components/NewActivityForm.jsx'
import { getGenreIcon } from '../../lib/curriculum.js'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const activities = await prisma.activity.findMany({
    where: { teacherId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { submissions: true } } },
  })

  const pendingReviews = await prisma.submission.findMany({
    where: {
      activity: { teacherId: session.user.id },
      feedback: { path: ['pending'], equals: true },
    },
    select: { id: true, studentName: true, activityId: true },
  })

  return (
    <div className="container-wide">
      <TeacherHeader title="내 활동" email={session.user.email} />

      {pendingReviews.length > 0 && (
        <div className="pending-banner">
          <p className="pending-banner-title">⏳ 검토가 필요한 글이 {pendingReviews.length}개 있어요</p>
          <ul>
            {pendingReviews.map((submission) => (
              <li key={submission.id}>
                <Link href={`/dashboard/${submission.activityId}/students/${submission.id}`}>
                  {submission.studentName} 학생 확인하기 →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a href="#new-activity" className="button-primary" style={{ marginBottom: '1.5rem', display: 'block' }}>
        + 새 활동 만들기
      </a>

      {activities.length === 0 ? (
        <p className="empty-state">아직 만든 활동이 없어요. 위 버튼으로 첫 활동을 만들어보세요.</p>
      ) : (
        activities.map((activity) => (
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
        ))
      )}

      <section id="new-activity" className="dashboard-new-section">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>🦕 새 활동 만들기</h2>
        <p className="field-hint" style={{ marginBottom: '1.2rem' }}>
          교육과정에 맞는 글쓰기 활동을 선택하고 설정해 보세요.
        </p>
        <NewActivityForm />
      </section>
    </div>
  )
}
