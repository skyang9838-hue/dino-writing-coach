'use client'

import { useState } from 'react'
import { GENRES, GRADES, LENGTH_OPTIONS, getRecommendedLength } from '../lib/curriculum.js'
import { createActivity } from '../lib/actions.js'

function ChipGroup({ name, options, value, onChange }) {
  return (
    <div className="chip-group" role="radiogroup">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`chip ${value === option ? 'chip-selected' : ''}`}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
      <input type="hidden" name={name} value={value} />
    </div>
  )
}

export function NewActivityForm() {
  const [grade, setGrade] = useState(GRADES[1].value)
  const [genre, setGenre] = useState(GENRES[0])
  const [targetLength, setTargetLength] = useState(getRecommendedLength(GRADES[1].value))

  const handleGradeChange = (nextGrade) => {
    setGrade(nextGrade)
    setTargetLength(getRecommendedLength(nextGrade))
  }

  return (
    <form action={createActivity} className="form-narrow">
      <div className="field">
        <label>학년</label>
        <ChipGroup name="grade" options={GRADES.map((g) => g.value)} value={grade} onChange={handleGradeChange} />
      </div>

      <div className="field">
        <label>글의 종류</label>
        <ChipGroup name="genre" options={GENRES} value={genre} onChange={setGenre} />
      </div>

      <div className="field">
        <label htmlFor="material">소재</label>
        <input id="material" name="material" type="text" placeholder="예: 가을 소풍에서 있었던 일" required />
      </div>

      <div className="field">
        <label htmlFor="targetLength">목표 글자 수</label>
        <select
          id="targetLength"
          name="targetLength"
          value={targetLength}
          onChange={(e) => setTargetLength(Number(e.target.value))}
        >
          {LENGTH_OPTIONS.map((length) => (
            <option key={length} value={length}>
              {length}자
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="button-primary">
        활동 만들기
      </button>
    </form>
  )
}
