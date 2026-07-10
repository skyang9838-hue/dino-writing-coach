import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '../../../auth.js'
import { prisma } from '../../../lib/prisma.js'
import { JoinQrCode } from '../../../components/JoinQrCode.jsx'

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
    <div className="container">
      <h1 style={{ fontSize: '1.4rem' }}>{activity.title}</h1>
      <p className="page-subtitle">
        {activity.topic} · 목표 {activity.targetLength}자 · {activity.grade} · {activity.genre}
      </p>

      <div className="join-info-card">
        <p style={{ margin: 0, color: '#666' }}>참여 코드</p>
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
          <div key={submission.id} className="activity-card">
            <h3>{submission.studentName}</h3>
            <p>
              {submission.status === 'submitted' ? '제출 완료' : '작성 중'} · 도달도{' '}
              {submission.attainment ?? '-'}
              {submission.attainment !== null ? '%' : ''} · {submission.rounds.length}회 코칭
            </p>
          </div>
        ))
      )}
    </div>
  )
}
