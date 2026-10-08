import { afterEach, describe, expect, it } from 'vitest'
import { isAdmin } from './admin.js'

describe('isAdmin', () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS
  })

  it('nobody is admin when ADMIN_EMAILS is unset or empty', () => {
    expect(isAdmin('a@x.com')).toBe(false)
    process.env.ADMIN_EMAILS = ''
    expect(isAdmin('a@x.com')).toBe(false)
    expect(isAdmin('')).toBe(false)
  })

  it('matches any listed email, ignoring spaces and case', () => {
    process.env.ADMIN_EMAILS = 'a@x.com, B@y.com'
    expect(isAdmin('a@x.com')).toBe(true)
    expect(isAdmin('b@y.com')).toBe(true)
    expect(isAdmin('c@z.com')).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})
