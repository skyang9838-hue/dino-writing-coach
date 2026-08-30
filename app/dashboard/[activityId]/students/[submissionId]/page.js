import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '../../../../../auth.js'
import { prisma } from '../../../../../lib/prisma.js'
import { getMascotState } from '../../../../../lib/mascot.js'
import { RevisionBoard } from '../../../../../components/RevisionBoard.jsx'
import { ProfanityReviewPanel } from '../../../../../components/ProfanityReviewPanel.jsx'
import { SignOutButton } from '../../../../../components/SignOutButton.jsx'

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

  const { attainment, rounds } = submission
  const mascot = getMascotState(attainment)

  return (
    <div className="container-widest">
      {/* This page builds its own header instead of using TeacherHeader: the
          attainment card takes the space TeacherHeader gives the email. */}
      <div className="board-topbar">
        <Link href={`/dashboard/${activityId}`} className="new-writing-link">
          ← 학생 목록으로 돌아가기
        </Link>
        <div className="board-topbar-account">
          <span className="teacher-email">{session.user.email}</span>
          <SignOutButton />
        </div>
      </div>

      <div className="board-header">
        <div className="board-identity">
          <span className="board-avatar" aria-hidden="true">
            🙋
          </span>
          <div>
            <h1>
              {submission.studentName}
              <span className="board-grade-badge">{submission.activity.grade}</span>
            </h1>
            <p>
              {submission.activity.genre} 쓰기 · 총 {rounds.length}회 수정
            </p>
          </div>
        </div>

        {attainment !== null && (
          <div className="board-attainment-card">
            <img src={`/dino/${mascot.face}.png`} alt="" aria-hidden="true" />
            <div className="board-attainment-body">
              <p className="board-attainment-label">도달도 {attainment}%</p>
              <div className="board-attainment-bar">
                <div className="attainment-track-bg">
                  <div
                    className={`attainment-track-fill${attainment >= 100 ? ' full' : ''}`}
                    style={{ width: `${Math.min(attainment, 100)}%` }}
                  />
                </div>
                <span className="board-attainment-value">{attainment}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {submission.feedback?.pending && (
        <ProfanityReviewPanel submissionId={submission.id} writing={submission.writing} />
      )}

      {rounds.length > 0 ? (
        <RevisionBoard rounds={rounds} unitId={submission.activity.unitId} />
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
