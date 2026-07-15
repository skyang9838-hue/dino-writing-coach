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
      <p className="page-subtitle">
        {activity.title}
        {activity.topic ? ` · ${activity.topic}` : ''}
      </p>
      <JoinForm joinCode={joinCode.toUpperCase()} />
    </div>
  )
}
