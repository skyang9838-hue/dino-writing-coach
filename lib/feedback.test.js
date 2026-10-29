import { describe, expect, it } from 'vitest'
import {
  getLastCoachedWriting,
  getMissionPick,
  getMissionStatusSymbol,
  getPriorMissionChecks,
  getVisibleMissions,
  isUnchangedWriting,
} from './feedback.js'

describe('getVisibleMissions', () => {
  it('normalizes dynamic interview-report missions', () => {
    expect(getVisibleMissions({
      missions: [{
        title: '까닭 추가하기',
        instruction: '첫 번째 사실 뒤에 면담에서 들은 까닭을 써보세요.',
      }],
    })).toEqual([{
      id: null,
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

describe('getMissionPick', () => {
  const rubricRound = {
    missions: [
      { id: 'm1', title: '까닭 쓰기', instruction: '까닭을 한 문장 써 보자.' },
      { id: 'm2', title: '느낀 점 쓰기', instruction: '느낀 점을 써 보자.' },
      { id: 'm3', title: '제목 바꾸기', instruction: '제목을 바꿔 보자.' },
    ],
  }

  it('requires at least one pick when the last round has mission ids', () => {
    const pick = getMissionPick({ rounds: [rubricRound], isFirstRound: false, selectedIds: [] })
    expect(pick.missions.map((mission) => mission.id)).toEqual(['m1', 'm2', 'm3'])
    expect(pick.mustPick).toBe(true)
    expect(pick.needsPick).toBe(true)
  })

  it('clears the gate once a mission is picked', () => {
    expect(getMissionPick({ rounds: [rubricRound], isFirstRound: false, selectedIds: ['m2'] }).needsPick).toBe(false)
  })

  it('keeps offering the last unflagged round after a rejected round', () => {
    const rejected = { writing: '...', flagged: true, flagReason: 'profanity' }
    const pick = getMissionPick({ rounds: [rubricRound, rejected], isFirstRound: false, selectedIds: [] })
    expect(pick.missions).toHaveLength(3)
    expect(pick.needsPick).toBe(true)
  })

  it('does not ask the general coach (missions without ids) to pick', () => {
    const generalRound = { improvements: ['문단을 나눠보세요', '느낀 점을 추가하세요'] }
    const pick = getMissionPick({ rounds: [generalRound], isFirstRound: false, selectedIds: [] })
    expect(pick.mustPick).toBe(false)
    expect(pick.needsPick).toBe(false)
  })

  it('lets a round with zero missions coach again without a pick', () => {
    const pick = getMissionPick({ rounds: [{ missions: [] }], isFirstRound: false, selectedIds: [] })
    expect(pick.missions).toEqual([])
    expect(pick.needsPick).toBe(false)
  })

  it('never gates the first round on a pick', () => {
    expect(getMissionPick({ rounds: [], isFirstRound: true, selectedIds: [] }).needsPick).toBe(false)
  })
})

describe('getPriorMissionChecks', () => {
  const previousRound = {
    missions: [
      { id: 'm1', title: '까닭 쓰기', instruction: '까닭을 써 보자.' },
      { id: 'm2', title: '느낀 점 쓰기', instruction: '느낀 점을 써 보자.' },
      { id: 'm3', title: '제목 바꾸기', instruction: '제목을 바꿔 보자.' },
    ],
  }

  it('lists only the missions the student picked', () => {
    const round = {
      selectedMissionIds: ['m3', 'm1'],
      priorMissionStatuses: [
        { missionId: 'm1', status: 'done' },
        { missionId: 'm3', status: 'partial' },
      ],
    }
    expect(getPriorMissionChecks(previousRound, round)).toEqual([
      { key: 'm1', title: '까닭 쓰기', instruction: '까닭을 써 보자.', status: 'done' },
      { key: 'm3', title: '제목 바꾸기', instruction: '제목을 바꿔 보자.', status: 'partial' },
    ])
  })

  it('lists every mission for rounds saved before picking existed', () => {
    const round = { priorMissionStatuses: [{ missionId: 'm2', status: 'not-done' }] }
    expect(getPriorMissionChecks(previousRound, round).map((check) => check.status)).toEqual([undefined, 'not-done', undefined])
  })

  it('reads legacy positional statuses', () => {
    const legacyPrevious = { improvements: ['첫 문단을 다듬자.', '느낀 점을 덧붙이자.'] }
    expect(getPriorMissionChecks(legacyPrevious, { addressed: [true, false] })).toEqual([
      { key: 0, title: null, instruction: '첫 문단을 다듬자.', status: true },
      { key: 1, title: null, instruction: '느낀 점을 덧붙이자.', status: false },
    ])
  })
})

describe('mission pick limit', () => {
  const round = { missions: [{ id: 'm1', instruction: 'a' }, { id: 'm2', instruction: 'b' }, { id: 'm3', instruction: 'c' }] }

  it('is full at two picks', () => {
    expect(getMissionPick({ rounds: [round], isFirstRound: false, selectedIds: ['m1'] }).isPickFull).toBe(false)
    expect(getMissionPick({ rounds: [round], isFirstRound: false, selectedIds: ['m1', 'm3'] }).isPickFull).toBe(true)
  })

  it('never applies to missions without ids', () => {
    const generalRound = { improvements: ['a', 'b', 'c'] }
    expect(getMissionPick({ rounds: [generalRound], isFirstRound: false, selectedIds: [] }).isPickFull).toBe(false)
  })
})

describe('isUnchangedWriting', () => {
  it('treats extra spaces and blank lines as unchanged', () => {
    expect(isUnchangedWriting('나는 학교에 갔다.', '나는 학교에 갔다.')).toBe(true)
    expect(isUnchangedWriting('나는 학교에 갔다.', '나는 학교에 갔다.  \n')).toBe(true)
    expect(isUnchangedWriting('나는 학교에 갔다.\n재밌었다.', '나는  학교에 갔다.\n\n재밌었다.')).toBe(true)
  })

  it('counts real edits, a new word space, and a paragraph split or merge', () => {
    expect(isUnchangedWriting('나는 학교에 갔다.', '나는 학교에 갔다!')).toBe(false)
    expect(isUnchangedWriting('나는학교에 갔다.', '나는 학교에 갔다.')).toBe(false)
    expect(isUnchangedWriting('나는 학교에 갔다. 재밌었다.', '나는 학교에 갔다.\n\n재밌었다.')).toBe(false)
    expect(isUnchangedWriting('나는 학교에 갔다.\n재밌었다.', '나는 학교에 갔다. 재밌었다.')).toBe(false)
  })

  it('is never unchanged before the first coaching', () => {
    expect(isUnchangedWriting(null, '')).toBe(false)
    expect(isUnchangedWriting(undefined, '글')).toBe(false)
  })
})

describe('getLastCoachedWriting', () => {
  it('skips rejected rounds', () => {
    expect(getLastCoachedWriting([{ writing: 'a' }, { writing: 'b', flagged: true }])).toBe('a')
    expect(getLastCoachedWriting([])).toBe(null)
  })
})
