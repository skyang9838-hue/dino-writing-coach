import { DinoIcon } from './DinoIcon.jsx'
import { SignOutButton } from './SignOutButton.jsx'

// Shared header for the teacher-facing list pages (dashboard, new-activity,
// activity detail) — icon+title (+optional subtitle) on the left, signed-in
// email + logout on the right. The student revision board builds its own
// header instead: it puts the attainment card where this one puts the email.
//
// `icon` defaults to the dino mascot image, but the activity detail page
// passes a genre emoji (lib/curriculum.js getGenreIcon).
export function TeacherHeader({ icon, title, subtitle, email }) {
  return (
    <div className="top-bar">
      <div>
        <h1 className="page-title">
          {icon ?? <DinoIcon pose="wave" />} {title}
        </h1>
        {subtitle && (
          <p className="field-hint" style={{ marginTop: '0.3rem' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className="teacher-email">{email}</span>
        <SignOutButton />
      </div>
    </div>
  )
}
