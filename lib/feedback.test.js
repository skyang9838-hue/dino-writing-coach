import { describe, expect, it } from 'vitest'
import { getMissionStatusSymbol, getVisibleMissions } from './feedback.js'

describe('getVisibleMissions', () => {
  it('normalizes dynamic interview-report missions', () => {
    expect(getVisibleMissions({
      missions: [{
        title: '까닭 추가하기',
        instruction: '첫 번째 사실 뒤에 면담에서 들은 까닭을 써보세요.',
      }],
    })).toEqual([{
      title: '까닭 추가하기',
      instruction: '첫 번째 사실 뒤에 면담에서 들은 까닭을 써보세요.',
    }])
  })

  it('normalizes legacy improvement strings', () => {
    expect(getVisibleMissions({
      improvements: ['문단을 나눠보세요', '느낀 점을 추가하세요'],
    })).toEqual([
      { title: null, instruction: '문단을 나눠보세요' },
      { title: null, instruction: '느낀 점을 추가하세요' },
    ])
  })

  it('returns an empty list for absent feedback', () => {
    expect(getVisibleMissions(null)).toEqual([])
  })
})

describe('getMissionStatusSymbol', () => {
  it('maps three-level and legacy mission states to symbols', () => {
    expect(getMissionStatusSymbol('done')).toBe('✅')
    expect(getMissionStatusSymbol('partial')).toBe('🔄')
    expect(getMissionStatusSymbol('attempted')).toBe('🔄')
    expect(getMissionStatusSymbol('not-done')).toBe('❌')
    expect(getMissionStatusSymbol(true)).toBe('✅')
    expect(getMissionStatusSymbol(false)).toBe('❌')
  })
})
