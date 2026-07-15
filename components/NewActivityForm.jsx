'use client'

import { useState } from 'react'
import { GRADE6_SEMESTER1_UNITS, LENGTH_OPTIONS } from '../lib/curriculum.js'
import { createActivity } from '../lib/actions.js'

const TOPIC_MAX = 50
const INSTRUCTIONS_MAX = 100
const PRESET_LENGTHS = [200, 400, 600, 800, 1000]

export function NewActivityForm() {
  const [selectedUnitId, setSelectedUnitId] = useState(GRADE6_SEMESTER1_UNITS[0].id)
  const [topic, setTopic] = useState('')
  const [instructions, setInstructions] = useState('')
  const [targetLength, setTargetLength] = useState(GRADE6_SEMESTER1_UNITS[0].recommendedLength)
  const [isCustomLength, setIsCustomLength] = useState(false)

  const handleUnitSelect = (unit) => {
    setSelectedUnitId(unit.id)
    setTargetLength(unit.recommendedLength)
    setIsCustomLength(!LENGTH_OPTIONS.includes(unit.recommendedLength) && !PRESET_LENGTHS.includes(unit.recommendedLength))
  }

  const handlePresetLength = (length) => {
    setIsCustomLength(false)
    setTargetLength(length)
  }

  return (
    <form action={createActivity} className="form-narrow-wide">
      <div className="field">
        <label>📖 6학년 1학기 국어 활동 선택</label>
        <p className="field-hint">진행할 활동을 선택하면 기본 정보가 자동으로 설정돼요.</p>
        <div className="unit-grid">
          {GRADE6_SEMESTER1_UNITS.map((unit) => (
            <button
              key={unit.id}
              type="button"
              className={`unit-card ${selectedUnitId === unit.id ? 'unit-card-selected' : ''}`}
              aria-pressed={selectedUnitId === unit.id}
              onClick={() => handleUnitSelect(unit)}
            >
              {selectedUnitId === unit.id && <span className="unit-card-check">✓</span>}
              <span className="unit-card-icon">{unit.icon}</span>
              <span className="unit-card-number">{unit.unitNumber}단원</span>
              <span className="unit-card-title">{unit.title}</span>
              <span className="unit-card-desc">{unit.description}</span>
            </button>
          ))}
        </div>
        <input type="hidden" name="unitId" value={selectedUnitId} />
      </div>

      <div className="field-split">
        <div className="field-split-col">
          <div className="field">
            <label htmlFor="topic">오늘의 주제 (선택)</label>
            <p className="field-hint">비워두면 학생이 자유롭게 주제를 정합니다.</p>
            <input
              id="topic"
              name="topic"
              type="text"
              placeholder="예: 우리 학교를 더 좋게 만드는 방법"
              maxLength={TOPIC_MAX}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <p className="field-counter">
              {topic.length} / {TOPIC_MAX}
            </p>
          </div>

          <div className="field">
            <label htmlFor="instructions">학생에게 안내할 말 (선택)</label>
            <p className="field-hint">비워두면 별도의 안내 없이 글쓰기를 시작합니다.</p>
            <textarea
              id="instructions"
              name="instructions"
              placeholder="예: 자신의 주장과 근거를 2가지 이상 써보세요."
              maxLength={INSTRUCTIONS_MAX}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              style={{ height: '90px' }}
            />
            <p className="field-counter">
              {instructions.length} / {INSTRUCTIONS_MAX}
            </p>
          </div>
        </div>

        <div className="field-split-col">
          <div className="field">
            <label htmlFor="targetLength">목표 글자 수</label>
            <p className="field-hint">권장 글자 수는 활동에 따라 추천된 값이에요. 필요에 따라 변경할 수 있어요.</p>
            <div className="length-grid">
              {PRESET_LENGTHS.map((length) => (
                <button
                  key={length}
                  type="button"
                  className={`length-option ${!isCustomLength && targetLength === length ? 'length-option-selected' : ''}`}
                  aria-pressed={!isCustomLength && targetLength === length}
                  onClick={() => handlePresetLength(length)}
                >
                  {length}자
                </button>
              ))}
              <button
                type="button"
                className={`length-option ${isCustomLength ? 'length-option-selected' : ''}`}
                aria-pressed={isCustomLength}
                onClick={() => setIsCustomLength(true)}
              >
                직접 입력
              </button>
            </div>
            {isCustomLength && (
              <input
                id="targetLength"
                type="number"
                min="1"
                placeholder="목표 글자 수를 입력하세요"
                value={targetLength}
                onChange={(e) => setTargetLength(Number(e.target.value))}
              />
            )}
            <input type="hidden" name="targetLength" value={targetLength} />
          </div>
        </div>
      </div>

      <button type="submit" className="button-primary">
        🦕 활동 만들기
      </button>
    </form>
  )
}
