'use server'

import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from './prisma.js'

const DEV_TEACHER_EMAIL = 'dev-teacher@localhost.test'
const SESSION_COOKIE_NAME = 'authjs.session-token'
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days, matches Auth.js's default

// Local-only login bypass so teacher-gated flows can be developed and
// Playwright-tested without going through real Google OAuth each time.
// Never reachable in any deployed environment — Vercel sets NODE_ENV to
// "production" for both Preview and Production deployments.
//
// This bypasses next-auth's Credentials provider entirely and creates a
// database Session row + cookie directly, because Credentials sign-in issues
// a JWT-encoded cookie regardless of the app's `session.strategy: 'database'`
// setting, which auth() then fails to recognize (confirmed via /api/auth/session
// returning null right after a Credentials sign-in). Writing the same Session
// row + cookie a real OAuth login would produce sidesteps that incompatibility.
export async function devLogin() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('devLogin is not available in production.')
  }

  const user = await prisma.user.upsert({
    where: { email: DEV_TEACHER_EMAIL },
    update: {},
    create: { email: DEV_TEACHER_EMAIL, name: '테스트 교사' },
  })

  const sessionToken = randomUUID()
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS)
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires,
  })

  redirect('/dashboard')
}
