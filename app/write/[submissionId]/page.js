import { prisma } from '../../../lib/prisma.js'
import { WritingScreen } from '../../../components/WritingScreen.jsx'
import { DinoIcon } from '../../../components/DinoIcon.jsx'

export default async function WritePage({ params }) {
  const { submissionId } = await params
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { activity: true },
  })
  // The teacher deleted the activity (its submissions go with it).
  if (!submission) {
    return (
      <div className="container">
      <h1>
        <DinoIcon pose="wave" size="lg" /> 디노와 함께 글쓰기
      </h1>
      <p className="empty-state">선생님이 활동을 닫았어요.</p>
      </div>
    )
  }

  return (
    <WritingScreen
      submissionId={submission.id}
      studentName={submission.studentName}
      activity={{
        topic: submission.activity.topic,
        instructions: submission.activity.instructions,
        targetLength: submission.activity.targetLength,
      }}
      initial={{
        writing: submission.writing,
        feedback: submission.feedback,
        attainment: submission.attainment,
        rounds: submission.rounds,
      }}
    />
  )
}
