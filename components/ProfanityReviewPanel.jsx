'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resolveProfanityReview } from '../lib/actions.js'

// Teacher-only panel shown on a student's growth page when their latest
// submission is awaiting profanity review (submission.feedback.pending).
export function ProfanityReviewPanel({ submissionId, writing }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const resolve = (decision) => {
    startTransition(async () => {
      await resolveProfanityReview(submissionId, decision)
      router.refresh()
    })
  }

  return (
    <div className="review-panel">
      <p className="review-panel-title">🕒 검토가 필요한 글이에요</p>
      <p className="review-panel-writing">{writing}</p>
      <div className="review-panel-actions">
        <button
          type="button"
          className="chip chip-approve"
          disabled={isPending}
          onClick={() => resolve('approve')}
        >
          ✅ 승인 (정상 처리)
        </button>
        <button
          type="button"
          className="chip chip-reject"
          disabled={isPending}
          onClick={() => resolve('reject')}
        >
          🚫 반려 (부적절함)
        </button>
      </div>
    </div>
  )
}
