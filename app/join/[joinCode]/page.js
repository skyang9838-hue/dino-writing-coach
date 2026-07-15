import { notFound } from 'next/navigation'
import { prisma } from '../../../lib/prisma.js'
import { JoinForm } from '../../../components/JoinForm.jsx'

export default async function JoinPage({ params }) {
  const { joinCode } = await params
  const activity = await prisma.activity.findUnique({
    where: { joinCode: joinCode.toUpperCase() },
  })
  if (!activity) notFound()

  return (
    <div className="container">
      <h1>🦕 디노와 함께 글쓰기</h1>
      <p className="page-subtitle">이름을 입력하고 오늘의 글쓰기를 시작해요.</p>

      <div className="topic-card">
        <div>
          <p className="topic-card-label">✍️ 오늘의 활동</p>
          <h2 className="topic-card-title">{activity.title}</h2>
          {activity.topic && (
            <p className="field-hint" style={{ marginTop: '0.4rem' }}>
              {activity.topic}
            </p>
          )}
        </div>
      </div>

      <JoinForm joinCode={joinCode.toUpperCase()} />
    </div>
  )
}
