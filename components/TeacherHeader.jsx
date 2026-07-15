import { signOut } from '../auth.js'

// Shared header for every teacher-facing page (dashboard, new-activity,
// activity detail, student growth view) — icon+title (+optional subtitle) on
// the left, signed-in email + logout on the right. A Server Component (no
// 'use client') so it can own the sign-out Server Action itself.
export function TeacherHeader({ icon = '🦕', title, subtitle, email }) {
  return (
    <div className="top-bar">
      <div>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>
          {icon} {title}
        </h1>
        {subtitle && (
          <p className="field-hint" style={{ marginTop: '0.3rem' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className="teacher-email">{email}</span>
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
  )
}
