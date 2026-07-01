# 디노 글쓰기 코치 — 1단계 UI 스펙

**날짜:** 2026-07-01  
**범위:** 기본 UI 골격 (AI 연동 없음)

---

## 목표

Vite 기본 스캐폴드를 제거하고, 초등학생이 글쓰기 주제를 직접 입력한 뒤 글을 작성할 수 있는 최소한의 UI를 만든다.

---

## 화면 구성

```
┌─────────────────────────────────────┐
│  🦕 디노와 함께 글쓰기               │  ← h1 제목
├─────────────────────────────────────┤
│  오늘의 글쓰기 주제                   │  ← label
│  [                              ]   │  ← topic input (text)
├─────────────────────────────────────┤
│  내 글쓰기                           │  ← label
│  ┌───────────────────────────────┐  │
│  │                               │  │  ← writing textarea
│  └───────────────────────────────┘  │
│  ████████░░░░░░░░  120 / 400자      │  ← 진행 바 + 글자 수
├─────────────────────────────────────┤
│     [ 디노 코칭 받기 ]               │  ← 버튼
└─────────────────────────────────────┘
```

---

## 상태 (State)

| 변수 | 타입 | 설명 |
|------|------|------|
| `topic` | string | 글쓰기 주제 입력값 |
| `writing` | string | 학생 글쓰기 입력값 |

`isReady`는 `writing.length >= 400`으로 JSX 안에서 직접 계산 (별도 state 불필요).

---

## 컴포넌트 구조

**파일: `src/App.jsx`** — 모든 로직을 한 파일에 유지 (컴포넌트 분리 없음)

```jsx
function App() {
  const [topic, setTopic] = useState('')
  const [writing, setWriting] = useState('')
  const MIN_CHARS = 400

  const charCount = writing.length
  const isReady = charCount >= MIN_CHARS
  const progressPercent = Math.min((charCount / MIN_CHARS) * 100, 100)

  return (
    <div className="container">
      <h1>🦕 디노와 함께 글쓰기</h1>

      <label>오늘의 글쓰기 주제</label>
      <input type="text" value={topic} onChange={e => setTopic(e.target.value)} />

      <label>내 글쓰기</label>
      <textarea value={writing} onChange={e => setWriting(e.target.value)} />

      <div className="progress-bar-bg">
        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <p className="char-count">{charCount} / {MIN_CHARS}자</p>

      <button disabled={!isReady}>디노 코칭 받기</button>
    </div>
  )
}
```

---

## 스타일 (`src/App.css`)

기존 내용 전체 교체. 주요 스타일:

- `.container`: 중앙 정렬, max-width 700px, padding 2rem
- `input`, `textarea`: 전체 너비, 테두리 스타일
- `textarea`: height 200px, resize vertical
- `.progress-bar-bg`: 회색 배경 바, height 12px, border-radius
- `.progress-bar-fill`: 초록색, 동적 width, 400자 달성 시 진한 초록
- `button:disabled`: 회색 배경, cursor not-allowed
- `button:enabled`: 초록색 배경, pointer cursor

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/App.jsx` | 전체 교체 — Vite 스캐폴드 제거, 디노 UI 작성 |
| `src/App.css` | 전체 교체 — 기존 스타일 제거, 새 스타일 작성 |

`src/index.css`, `src/main.jsx`, `index.html` 등 나머지 파일은 수정하지 않음.

---

## 범위 외 (이번 단계에서 하지 않는 것)

- AI 피드백 기능 (Gemini API 연동은 2단계)
- 디노 캐릭터 이미지/애니메이션
- 라우팅
- 데이터 저장
