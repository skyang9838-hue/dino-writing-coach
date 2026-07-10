'use client'

import { useActionState } from 'react'
import { joinActivity } from '../lib/actions.js'

export function JoinForm({ joinCode }) {
  const [state, formAction, isPending] = useActionState(joinActivity, null)

  return (
    <form action={formAction}>
      <input type="hidden" name="joinCode" value={joinCode} />
      <div className="field">
        <label htmlFor="studentName">이름</label>
        <input id="studentName" name="studentName" type="text" placeholder="이름을 입력하세요" required autoFocus />
      </div>
      {state?.error && <p className="error-message">{state.error}</p>}
      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? '입장하는 중...' : '글쓰기 시작하기'}
      </button>
    </form>
  )
}
