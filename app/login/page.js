import { redirect } from 'next/navigation'
import { auth, signIn } from '../../auth.js'
import { devLogin } from '../../lib/devLogin.js'

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <div className="container">
      <h1>🦕 디노 글쓰기 코치</h1>
      <p className="page-subtitle">교사 로그인</p>
      <form
        action={async () => {
          'use server'
          await signIn('google', { redirectTo: '/dashboard' })
        }}
      >
        <button type="submit" className="button-primary">
          Google 계정으로 로그인
        </button>
      </form>

      {process.env.NODE_ENV !== 'production' && (
        <form action={devLogin} style={{ marginTop: '0.8rem' }}>
          <button type="submit" className="button-secondary">
            🧪 테스트 교사로 로그인 (로컬 전용)
          </button>
        </form>
      )}
    </div>
  )
}
