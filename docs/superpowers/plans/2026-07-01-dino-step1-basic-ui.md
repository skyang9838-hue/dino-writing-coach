# 디노 글쓰기 코치 1단계 — 기본 UI 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vite 기본 스캐폴드를 제거하고, 초등학생이 글쓰기 주제를 입력한 뒤 글을 작성하고 글자 수 진행 바를 확인할 수 있는 UI를 만든다.

**Architecture:** App.jsx 단일 컴포넌트에 모든 로직을 담는다. App.css는 전체 교체한다. 나머지 파일은 변경하지 않는다.

**Tech Stack:** React 19, Vite 8, plain CSS, JavaScript (JSX)

## Global Constraints

- 컴포넌트 분리 없음 — App.jsx 하나에서 모두 처리
- TypeScript 사용 안 함
- 외부 라이브러리 추가 없음
- 테스트 프레임워크 없음 — 브라우저 수동 확인으로 대체
- git 저장소 없음 — commit 단계 생략

---

## 파일 구조

| 파일 | 변경 | 역할 |
|------|------|------|
| `src/App.jsx` | **전체 교체** | 글쓰기 UI 전체 (상태, 이벤트, 렌더링) |
| `src/App.css` | **전체 교체** | 컨테이너, 입력창, 진행 바, 버튼 스타일 |
| `src/main.jsx` | 변경 없음 | React 앱 마운트 (그대로 유지) |
| `src/index.css` | 변경 없음 | 전역 폰트/색상 (그대로 유지) |

---

### Task 1: App.jsx 교체

**Files:**
- Modify: `src/App.jsx` (전체 내용 교체)

**Interfaces:**
- Produces: `<App />` 컴포넌트 — topic, writing state, 진행 바, 버튼 렌더링

- [ ] **Step 1: App.jsx 전체 내용을 아래 코드로 교체**

`src/App.jsx`의 현재 내용을 모두 지우고 다음으로 교체한다:

```jsx
import { useState } from 'react'
import './App.css'

const MIN_CHARS = 400

function App() {
  const [topic, setTopic] = useState('')
  const [writing, setWriting] = useState('')

  const charCount = writing.length
  const isReady = charCount >= MIN_CHARS
  const progressPercent = Math.min((charCount / MIN_CHARS) * 100, 100)

  return (
    <div className="container">
      <h1>🦕 디노와 함께 글쓰기</h1>

      <div className="field">
        <label htmlFor="topic">오늘의 글쓰기 주제</label>
        <input
          id="topic"
          type="text"
          placeholder="글쓰기 주제를 입력하세요"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="writing">내 글쓰기</label>
        <textarea
          id="writing"
          placeholder="여기에 글을 써보세요!"
          value={writing}
          onChange={(e) => setWriting(e.target.value)}
        />
      </div>

      <div className="progress-section">
        <div className="progress-bar-bg">
          <div
            className={`progress-bar-fill ${isReady ? 'complete' : ''}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="char-count">
          {charCount} / {MIN_CHARS}자
          {isReady && <span className="ready-badge"> ✅ 준비 완료!</span>}
        </p>
      </div>

      <button className="coach-button" disabled={!isReady}>
        디노 코칭 받기
      </button>
    </div>
  )
}

export default App
```

**왜 이렇게 짜는가 (React 초보자 설명):**
- `useState('')`: React가 입력값을 기억하게 하는 "상태(state)". 값이 바뀌면 화면을 자동으로 다시 그린다.
- `value={topic}` + `onChange`: input을 React가 직접 관리하는 "제어 컴포넌트" 패턴. React가 항상 최신 값을 알 수 있다.
- `disabled={!isReady}`: 버튼의 활성/비활성을 조건으로 제어. `!isReady`가 true이면 비활성.
- `style={{ width: \`${progressPercent}%\` }}`: 인라인 스타일로 진행 바 너비를 동적으로 설정.

- [ ] **Step 2: 브라우저에서 확인**

터미널에서 실행:
```
npm run dev
```

브라우저에서 `http://localhost:5173` 열고 다음을 확인:
- 🦕 제목이 보인다
- 주제 입력창에 텍스트를 입력할 수 있다
- 글쓰기 textarea에 텍스트를 입력할 수 있다
- 글자를 입력하면 `0 / 400자` 숫자가 바뀐다
- 진행 바가 글자 수에 따라 늘어난다
- 버튼은 회색(비활성) 상태이다

---

### Task 2: App.css 교체

**Files:**
- Modify: `src/App.css` (전체 내용 교체)

**Interfaces:**
- Consumes: Task 1에서 정의한 CSS 클래스들 (`.container`, `.field`, `.progress-section`, `.progress-bar-bg`, `.progress-bar-fill`, `.complete`, `.char-count`, `.ready-badge`, `.coach-button`)

- [ ] **Step 1: App.css 전체 내용을 아래 코드로 교체**

`src/App.css`의 현재 내용을 모두 지우고 다음으로 교체한다:

```css
.container {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.container h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.field label {
  font-weight: 600;
  font-size: 1rem;
}

.field input {
  padding: 0.6rem 0.8rem;
  font-size: 1rem;
  border: 1.5px solid #ccc;
  border-radius: 8px;
  outline: none;
}

.field input:focus {
  border-color: #4caf50;
}

.field textarea {
  padding: 0.8rem;
  font-size: 1rem;
  border: 1.5px solid #ccc;
  border-radius: 8px;
  height: 200px;
  resize: vertical;
  outline: none;
  font-family: inherit;
  line-height: 1.6;
}

.field textarea:focus {
  border-color: #4caf50;
}

.progress-section {
  margin-bottom: 1.5rem;
}

.progress-bar-bg {
  height: 12px;
  background-color: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.4rem;
}

.progress-bar-fill {
  height: 100%;
  background-color: #81c784;
  border-radius: 6px;
  transition: width 0.2s ease;
}

.progress-bar-fill.complete {
  background-color: #2e7d32;
}

.char-count {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
  text-align: right;
}

.ready-badge {
  color: #2e7d32;
  font-weight: 600;
}

.coach-button {
  display: block;
  width: 100%;
  padding: 0.9rem;
  font-size: 1.1rem;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.coach-button:disabled {
  background-color: #e0e0e0;
  color: #9e9e9e;
  cursor: not-allowed;
}

.coach-button:not(:disabled) {
  background-color: #2e7d32;
  color: white;
}

.coach-button:not(:disabled):hover {
  background-color: #1b5e20;
}
```

**왜 이렇게 짜는가 (CSS 설명):**
- `.progress-bar-fill` width를 동적으로 바꾸면 `transition: width 0.2s ease`가 부드럽게 애니메이션해준다.
- `.coach-button:disabled`: 버튼에 `disabled` 속성이 있을 때의 스타일.
- `.coach-button:not(:disabled)`: `disabled`가 없을 때(활성 상태)의 스타일.
- `resize: vertical`: textarea를 세로로만 크기 조절 가능하게 제한.

- [ ] **Step 2: 브라우저에서 최종 확인**

`npm run dev`가 실행 중인 상태에서 브라우저를 새로 고침하고 다음을 전부 확인:

| 확인 항목 | 기대 결과 |
|----------|----------|
| 전체 레이아웃 | 중앙 정렬, 최대 700px 너비 |
| 주제 입력창 클릭 | 테두리가 초록색으로 변함 |
| textarea 클릭 | 테두리가 초록색으로 변함 |
| 글자 1~399자 입력 | 진행 바 연한 초록색, 버튼 회색 비활성 |
| 글자 400자 이상 입력 | 진행 바 진한 초록색, "✅ 준비 완료!" 표시, 버튼 초록색 활성화 |
| 활성 버튼 hover | 더 진한 초록색으로 변함 |
| 활성 버튼 클릭 | 아직 아무 일도 안 일어남 (2단계에서 구현) |
