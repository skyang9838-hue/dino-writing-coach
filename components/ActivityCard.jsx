'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteActivity, renameActivity } from '../lib/actions.js'

// Activity row for the teacher dashboard and the admin overview. The ⋯ menu
// renames (title turns into an input; Enter saves, Esc cancels) or deletes.
// The server actions re-check that the viewer owns the activity or is admin.
export function ActivityCard({ activity, icon, studentCount }) {
  const router = useRouter()
  const menuRef = useRef(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false
  }

  const run = async (action) => {
    setIsBusy(true)
    try {
      await action()
      router.refresh()
    } catch (err) {
      alert(err.message)
    }
    setIsBusy(false)
  }

  const handleRenameKey = (event) => {
    if (event.key === 'Escape') setIsEditing(false)
    if (event.key !== 'Enter') return
    const title = event.currentTarget.value.trim()
    setIsEditing(false)
    if (title && title !== activity.title) run(() => renameActivity(activity.id, title))
  }

  const handleDelete = () => {
    closeMenu()
    const warning = studentCount > 0 ? `\n학생 ${studentCount}명의 글도 같이 지워져요.` : ''
    if (!confirm(`'${activity.title}' 활동을 지울까요?${warning}\n되돌릴 수 없어요.`)) return
    run(() => deleteActivity(activity.id))
  }

  const body = (
    <>
      <span className="activity-card-icon">{icon}</span>
      <span className="activity-card-body">
        {isEditing ? (
          <input
            className="activity-card-rename"
            defaultValue={activity.title}
            autoFocus
            maxLength={100}
            onKeyDown={handleRenameKey}
            onBlur={() => setIsEditing(false)}
            aria-label="활동 이름"
          />
        ) : (
          <h3>{activity.title}</h3>
        )}
        <p>
          {activity.topic || '자유 주제'} · 목표 {activity.targetLength}자 · 참여 학생 {studentCount}명
        </p>
      </span>
    </>
  )

  return (
    <div className="activity-card-wrap" aria-busy={isBusy}>
      {isEditing ? (
        <div className="activity-card">{body}</div>
      ) : (
        <Link href={`/dashboard/${activity.id}`} className="activity-card">
          {body}
          <span className="activity-card-chevron">›</span>
        </Link>
      )}
      <details ref={menuRef} className="activity-card-menu">
        <summary aria-label="활동 메뉴">⋯</summary>
        <div className="activity-card-menu-list">
          <button
            type="button"
            onClick={() => {
              closeMenu()
              setIsEditing(true)
            }}
          >
            ✏️ 이름 바꾸기
          </button>
          <button type="button" className="danger" onClick={handleDelete}>
            🗑️ 삭제
          </button>
        </div>
      </details>
    </div>
  )
}
