import { signOut } from '../auth.js'

// The logout form, on its own so pages that don't use TeacherHeader's layout
// (the student revision board builds its own header) can still offer it. A
// Server Component — it owns the sign-out Server Action itself.
export function SignOutButton() {
  return (
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
  )
}
