import { describe, expect, it } from 'vitest'
import { getMascotState } from './mascot.js'

describe('getMascotState', () => {
  it('shows the default face with no percentage before any coaching round', () => {
    expect(getMascotState(null)).toEqual({
      face: 'face-default',
      message: '글을 다 쓰면 코칭을 받을 수 있어요!',
    })
  })

  it('shows the thinking face in the 40-69% band (first round lands here)', () => {
    expect(getMascotState(40)).toMatchObject({ face: 'face-think' })
    expect(getMascotState(69)).toMatchObject({ face: 'face-think' })
  })

  it('shows the "good job" face in the 70-99% band', () => {
    expect(getMascotState(70)).toMatchObject({ face: 'face-good' })
    expect(getMascotState(99)).toMatchObject({ face: 'face-good' })
  })

  it('shows the celebratory face at 100% and above', () => {
    expect(getMascotState(100)).toMatchObject({ face: 'face-love' })
    expect(getMascotState(140)).toMatchObject({ face: 'face-love' })
  })

  it('falls back to the default face below 40% (e.g. a flagged round forced to 0)', () => {
    expect(getMascotState(0)).toMatchObject({ face: 'face-default' })
  })
})
