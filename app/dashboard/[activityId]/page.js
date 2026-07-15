import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '../../../auth.js'
import { prisma } from '../../../lib/prisma.js'
import { JoinQrCode } from '../../../components/JoinQrCode.jsx'
import { TeacherHeader } from '../../../components/TeacherHeader.jsx'
import { getGenreIcon } from '../../../lib/curriculum.js'

export default async function ActivityDetailPage({ params }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { activityId } = await params
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { submissions: { orderBy: { updatedAt: 'desc' } } },
  })

  if (!activity || activity.teacherId !== session.user.id) notFound()

  const headerList = await headers()
  const host = headerList.get('host')
  const protocol = host?.startsWith('localhost') ? 'http' : 'https'
  const joinUrl = `${protocol}://${host}/join/${activity.joinCode}`

  return (
    <div className="container-wide">
      <Link href="/dashboard" className="new-writing-link">
        ← 내 활동으로
      </Link>
      <TeacherHeader
        icon={getGenreIcon(activity.genre)}
        title={activity.title}
        subtitle={`${activity.topic ? `${activity.topic} · ` : ''}목표 ${activity.targetLength}자 · ${activity.grade} · ${activity.genre}`}
        email={session.user.email}
      />

      <div className="join-info-card">
        <p className="topic-card-label">🔑 참여 코드</p>
        <p className="join-code">{activity.joinCode}</p>
        <a className="join-link" href={joinUrl}>
          {joinUrl}
        </a>
        <JoinQrCode url={joinUrl} />
      </div>

      <h2 style={{ fontSize: '1.1rem' }}>참여 학생 ({activity.submissions.length}명)</h2>
      {activity.submissions.length === 0 ? (
        <p className="empty-state">아직 참여한 학생이 없어요.</p>
      ) : (
        activity.submissions.map((submission) => (
          <Link
            key={submission.id}
            href={`/dashboard/${activity.id}/students/${submission.id}`}
            className="activity-card"
          >
            <span className="activity-card-icon">🙋</span>
            <span className="activity-card-body">
              <h3>
                {submission.studentName}
                {submission.feedback?.pending && <span className="pending-badge"> ⏳ 검토 필요</span>}
              </h3>
              <p>
                도달도 {submission.attainment ?? '-'}
                {submission.attainment !== null ? '%' : ''} · {submission.rounds.length}회 코칭
              </p>
            </span>
            <span className="activity-card-chevron">›</span>
          </Link>
        ))
      )}
    </div>
  )
}
