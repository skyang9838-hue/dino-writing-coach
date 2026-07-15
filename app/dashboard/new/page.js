import { redirect } from 'next/navigation'
import { auth, signOut } from '../../../auth.js'
import { NewActivityForm } from '../../../components/NewActivityForm.jsx'

export default async function NewActivityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="container-wide">
      <div className="top-bar">
        <div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>🦕 새 활동 만들기</h1>
          <p className="field-hint" style={{ marginTop: '0.3rem' }}>
            교육과정에 맞는 글쓰기 활동을 선택하고 설정해 보세요.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="teacher-email">{session.user.email}</span>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <button type="submit" className="sign-out-link">
              로그아웃
            </button>
          </form>
        </div>
      </div>
      <NewActivityForm />
    </div>
  )
}
