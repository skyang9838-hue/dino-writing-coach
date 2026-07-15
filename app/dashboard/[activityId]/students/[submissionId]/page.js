import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '../../../../../auth.js'
import { prisma } from '../../../../../lib/prisma.js'
import { RevisionHistory } from '../../../../../components/RevisionHistory.jsx'
import { ProfanityReviewPanel } from '../../../../../components/ProfanityReviewPanel.jsx'
import { TeacherHeader } from '../../../../../components/TeacherHeader.jsx'

export default async function StudentGrowthPage({ params }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { activityId, submissionId } = await params
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { activity: true },
  })

  if (!submission || submission.activityId !== activityId || submission.activity.teacherId !== session.user.id) {
    notFound()
  }

  return (
    <div className="container-widest">
      <Link href={`/dashboard/${activityId}`} className="new-writing-link">
        ← 활동으로 돌아가기
      </Link>

      <TeacherHeader
        icon="🙋"
        title={submission.studentName}
        subtitle={`${submission.attainment !== null ? `도달도 ${submission.attainment}% · ` : ''}${submission.rounds.length}회 코칭`}
        email={session.user.email}
      />

      {submission.feedback?.pending && (
        <ProfanityReviewPanel submissionId={submission.id} writing={submission.writing} />
      )}

      {submission.rounds.length > 0 ? (
        <RevisionHistory rounds={submission.rounds} layout="horizontal" />
      ) : (
        <>
          <p className="empty-state">아직 코칭을 받지 않았어요.</p>
          {!submission.feedback?.pending && submission.writing && (
            <p className="history-item-writing">{submission.writing}</p>
          )}
        </>
      )}
    </div>
  )
}
