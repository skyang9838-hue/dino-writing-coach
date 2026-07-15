import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '../../../auth.js'
import { NewActivityForm } from '../../../components/NewActivityForm.jsx'
import { TeacherHeader } from '../../../components/TeacherHeader.jsx'

export default async function NewActivityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="container-wide">
      <Link href="/dashboard" className="new-writing-link">
        ← 내 활동으로
      </Link>
      <TeacherHeader
        title="새 활동 만들기"
        subtitle="교육과정에 맞는 글쓰기 활동을 선택하고 설정해 보세요."
        email={session.user.email}
      />
      <NewActivityForm />
    </div>
  )
}
