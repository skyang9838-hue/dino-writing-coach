import { notFound } from 'next/navigation'
import { prisma } from '../../../lib/prisma.js'
import { WritingScreen } from '../../../components/WritingScreen.jsx'

export default async function WritePage({ params }) {
  const { submissionId } = await params
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { activity: true },
  })
  if (!submission) notFound()

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
