// Admins (ADMIN_EMAILS, comma-separated) can *read* every teacher's
// activities and student pages. Writes still go through the owner checks in
// lib/actions.js, so an admin can't change another teacher's data.
export function isAdmin(email) {
  if (!email) return false
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .includes(email.toLowerCase())
}
