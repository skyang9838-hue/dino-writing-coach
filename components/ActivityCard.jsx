'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteActivity } from '../lib/actions.js'

// Activity row for the teacher dashboard and the admin overview. The ⋯ menu
// deletes; the server action re-checks that the viewer owns the activity or
// is admin.
export function ActivityCard({ activity, icon, studentCount }) {
  const router = useRouter()
  const menuRef = useRef(null)
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

  // Close the menu on a click elsewhere or Esc — <details> alone stays open.
  useEffect(() => {
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) closeMenu()
    }
    const closeOnEsc = (event) => {
      if (event.key === 'Escape') closeMenu()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEsc)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEsc)
    }
  }, [])

  const handleDelete = () => {
    closeMenu()
    const warning = studentCount > 0 ? `\n학생 ${studentCount}명의 글도 같이 지워져요.` : ''
    if (!confirm(`'${activity.title}' 활동을 지울까요?${warning}\n되돌릴 수 없어요.`)) return
    run(() => deleteActivity(activity.id))
  }

  return (
    <div className="activity-card-wrap" aria-busy={isBusy}>
      <Link href={`/dashboard/${activity.id}`} className="activity-card">
        <span className="activity-card-icon">{icon}</span>
        <span className="activity-card-body">
          <h3>{activity.title}</h3>
          <p>
            {activity.topic || '자유 주제'} · 목표 {activity.targetLength}자 · 참여 학생 {studentCount}명
          </p>
        </span>
        <span className="activity-card-chevron">›</span>
      </Link>
      <details ref={menuRef} className="activity-card-menu">
        <summary aria-label="활동 메뉴">⋯</summary>
        <div className="activity-card-menu-list">
          <button type="button" className="danger" onClick={handleDelete}>
            🗑️ 삭제
          </button>
        </div>
      </details>
    </div>
  )
}
