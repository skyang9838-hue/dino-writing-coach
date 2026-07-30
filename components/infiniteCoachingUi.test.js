import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('continuous coaching UI copy and branches', () => {
  it('does not render a terminal completion branch on the writing screen', () => {
    const source = fs.readFileSync('components/WritingScreen.jsx', 'utf8')

    expect(source).not.toContain('feedback.complete')
    expect(source).not.toContain('루브릭의 기준을 모두 갖췄어요')
  })

  it('does not render terminal completion copy in revision history', () => {
    const source = fs.readFileSync('components/RevisionHistory.jsx', 'utf8')

    expect(source).not.toContain('round.complete')
    expect(source).not.toContain('루브릭의 기준을 모두 갖췄어요')
  })
})
