# 교실용 MVP 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BYOK(브라우저 API 키 입력) 방식을 제거하고 Vercel 서버리스 함수로 Gemini 키를 서버에 숨기며, 학생이 글을 고칠수록 오르는 "도달도" 시각화를 추가한다.

**Architecture:** 브라우저(React) → `POST /api/coach` (같은 도메인, 키 없음) → Vercel 서버리스 함수가 `GEMINI_API_KEY` 환경변수로 Gemini REST API 호출 → JSON 구조화 응답을 그대로 클라이언트에 반환. 서버는 완전히 무상태이며, 라운드 히스토리(직전 글/직전 보완점/현재 도달도)는 React state로만 유지한다.

**Tech Stack:** React 19, Vite 8, Vercel 서버리스 함수(Node.js, `api/` 디렉터리 컨벤션), Gemini REST API(`gemini-2.5-flash-lite`, JSON 구조화 출력). 테스트 프레임워크 없음(프로젝트 기존 관례).

## Global Constraints

- 도달도 시작값은 항상 **40%** (글 품질과 무관).
- 보완할 점 1개를 고칠 때마다 **+10%**, 상한 없음(100% 넘어 계속 증가 가능).
- 점수 계산은 **클라이언트 코드**가 수행 — Gemini는 각 보완점의 O/X(고쳤는지 여부)만 반환.
- 400자 최소 글자 수 조건은 **1회차 코칭 진입 조건**으로만 유지, 2회차 이후 제출엔 글자 수 제한 없음.
- 서버는 무상태 — DB/세션 저장소 없음. 로그인/계정 없음.
- Gemini 응답은 `responseMimeType: application/json` + `responseSchema`로 구조화 출력을 강제 — 정규식 텍스트 파싱 금지.
- 이 프로젝트는 테스트 프레임워크가 없다. 검증은 (a) 임시 Node 스크립트로 서버 함수 로직 확인, (b) `npm run lint`, (c) `npm run dev`로 브라우저 수동 확인을 조합해서 한다.
- 실제 Gemini 키를 이용한 end-to-end 확인과 Vercel 배포(로그인/프로젝트 연결/환경변수 설정)는 이 계획의 범위 밖이며, 문서 맨 끝의 안내를 따라 **사용자가 직접** 수행한다.

---

### Task 1: Vercel 서버리스 함수 — `api/coach.js`

**Files:**
- Create: `api/coach.js`
- Modify: `.gitignore`
- Create: `.env.example`
- Test: 임시 스크립트 `verify-coach.tmp.mjs` (검증 후 삭제, 커밋하지 않음)

**Interfaces:**
- Produces: `POST /api/coach` — 요청 바디 `{ topic: string, writing: string, previousWriting?: string, previousImprovements?: [string, string] }`. 응답 바디(1회차): `{ strength: string, improvements: [string, string] }`. 응답 바디(2회차 이후): `{ addressed: [boolean, boolean], strength: string, improvements: [string, string] }`. 실패 시 `{ error: string }` + 4xx/5xx 상태 코드.

- [ ] **Step 1: `.gitignore`에 환경변수/Vercel 관련 항목 추가**

`.gitignore` 파일 끝에 추가:

```
# Environment variables
.env
.env*.local

# Vercel
.vercel
```

- [ ] **Step 2: `.env.example` 생성**

```
GEMINI_API_KEY=your-gemini-api-key-here
```

- [ ] **Step 3: `api/coach.js` 작성**

```js
const MODEL_ID = 'gemini-2.5-flash-lite'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`

const FIRST_ROUND_SCHEMA = {
  type: 'object',
  properties: {
    strength: { type: 'string' },
    improvements: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['strength', 'improvements'],
}

const REVISION_SCHEMA = {
  type: 'object',
  properties: {
    addressed: {
      type: 'array',
      items: { type: 'boolean' },
      minItems: 2,
      maxItems: 2,
    },
    strength: { type: 'string' },
    improvements: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['addressed', 'strength', 'improvements'],
}

function buildFirstRoundPrompt(topic, writing) {
  return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
아래는 아이가 "${topic}" 주제로 쓴 글이야.

---
${writing}
---

이 글에서 잘한 점 1가지와 보완하면 좋을 점 2가지를 한국어로 알려줘.
보완할 점은 아이가 실제로 고칠 수 있는 구체적인 내용으로 써줘.`
}

function buildRevisionPrompt(topic, previousWriting, previousImprovements, writing) {
  return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
아이가 "${topic}" 주제로 쓴 글을 고쳐썼어.

[고치기 전 글]
${previousWriting}

[지난번에 알려준 보완할 점 2가지]
1. ${previousImprovements[0]}
2. ${previousImprovements[1]}

[고친 후 글]
${writing}

먼저 지난번 보완할 점 1번과 2번을 각각 이번 글에서 고쳤는지 판단해줘(고쳤으면 true, 안 고쳤으면 false).
그다음 고친 후 글을 기준으로 새로운 잘한 점 1가지와 보완하면 좋을 점 2가지를 한국어로 알려줘.`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: '서버에 API 키가 설정되어 있지 않아요.' })
    return
  }

  const { topic, writing, previousWriting, previousImprovements } = req.body ?? {}
  if (!topic || !writing) {
    res.status(400).json({ error: 'topic과 writing이 필요해요.' })
    return
  }

  const isRevision = Boolean(previousWriting && previousImprovements)
  const prompt = isRevision
    ? buildRevisionPrompt(topic, previousWriting, previousImprovements, writing)
    : buildFirstRoundPrompt(topic, writing)
  const schema = isRevision ? REVISION_SCHEMA : FIRST_ROUND_SCHEMA

  let geminiResponse
  try {
    geminiResponse = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
    })
  } catch {
    res.status(502).json({ error: '네트워크 오류가 발생했어요.' })
    return
  }

  if (!geminiResponse.ok) {
    res.status(502).json({ error: 'AI 응답을 받아오지 못했어요.' })
    return
  }

  const data = await geminiResponse.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    res.status(502).json({ error: '디노가 답을 만들지 못했어요.' })
    return
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    res.status(502).json({ error: '디노 응답을 이해하지 못했어요.' })
    return
  }

  res.status(200).json(parsed)
}
```

- [ ] **Step 4: 임시 검증 스크립트 작성 — `verify-coach.tmp.mjs` (프로젝트 루트)**

실제 Gemini를 호출하지 않도록 `fetch`를 스텁으로 교체하고, `handler`가 각 상황에서 올바른 상태 코드/바디를 만드는지 확인한다.

```js
import assert from 'node:assert/strict'
import handler from './api/coach.js'

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(obj) {
      this.body = obj
    },
  }
}

process.env.GEMINI_API_KEY = 'fake-key-for-verification'

// 1. GET 요청은 405
{
  const res = makeRes()
  await handler({ method: 'GET', body: {} }, res)
  assert.equal(res.statusCode, 405)
  console.log('OK: GET -> 405')
}

// 2. topic/writing 없으면 400
{
  const res = makeRes()
  await handler({ method: 'POST', body: {} }, res)
  assert.equal(res.statusCode, 400)
  console.log('OK: 빈 바디 -> 400')
}

// 3. 1회차: previousWriting 없을 때 FIRST_ROUND_SCHEMA로 호출하고, 정상 JSON을 그대로 반환
{
  let capturedBody
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options.body)
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    strength: '문장이 또렷해요',
                    improvements: ['예시를 더 넣어보세요', '마무리 문장을 추가해보세요'],
                  }),
                },
              ],
            },
          },
        ],
      }),
    }
  }

  const res = makeRes()
  await handler(
    { method: 'POST', body: { topic: '가을', writing: '가을은 선선해요.' } },
    res
  )

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.strength, '문장이 또렷해요')
  assert.equal(capturedBody.generationConfig.responseSchema.required.includes('addressed'), false)
  console.log('OK: 1회차 -> FIRST_ROUND_SCHEMA, 200 응답')
}

// 4. 2회차: previousWriting + previousImprovements 있을 때 REVISION_SCHEMA로 호출
{
  let capturedBody
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options.body)
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    addressed: [true, false],
                    strength: '예시가 좋아졌어요',
                    improvements: ['맞춤법을 확인해보세요', '문단을 나눠보세요'],
                  }),
                },
              ],
            },
          },
        ],
      }),
    }
  }

  const res = makeRes()
  await handler(
    {
      method: 'POST',
      body: {
        topic: '가을',
        writing: '가을은 선선해요. 예를 들면 단풍이 들어요.',
        previousWriting: '가을은 선선해요.',
        previousImprovements: ['예시를 더 넣어보세요', '마무리 문장을 추가해보세요'],
      },
    },
    res
  )

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.addressed, [true, false])
  assert.equal(capturedBody.generationConfig.responseSchema.required.includes('addressed'), true)
  console.log('OK: 2회차 -> REVISION_SCHEMA, addressed 포함 응답')
}

console.log('모든 검증 통과')
```

- [ ] **Step 5: 검증 스크립트 실행**

Run: `node verify-coach.tmp.mjs`
Expected:
```
OK: GET -> 405
OK: 빈 바디 -> 400
OK: 1회차 -> FIRST_ROUND_SCHEMA, 200 응답
OK: 2회차 -> REVISION_SCHEMA, addressed 포함 응답
모든 검증 통과
```

- [ ] **Step 6: 검증 스크립트 삭제**

```bash
rm verify-coach.tmp.mjs
```

- [ ] **Step 7: Lint 확인 및 커밋**

Run: `npm run lint`
Expected: 에러 없음(경고만 있다면 기존 관례상 무시 가능, 에러가 있으면 수정 후 재실행)

```bash
git add api/coach.js .gitignore .env.example
git commit -m "feat: Gemini 키를 서버로 옮기는 Vercel 서버리스 함수 추가"
```

---

### Task 2: 클라이언트 리팩터 — API 키 UI 제거 + 도달도 시각화 추가

**Files:**
- Modify: `src/geminiCoachService.js` (전체 교체)
- Modify: `src/App.jsx` (전체 교체)
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `POST /api/coach` (Task 1에서 정의한 요청/응답 형태)
- Produces: `getCoachingFeedback({ topic, writing, previousWriting, previousImprovements })` → `Promise<{ strength, improvements, addressed? }>`, `CoachingError`(`.type`이 `CoachingErrorType.NETWORK` 또는 `CoachingErrorType.UNKNOWN`), `CoachingErrorType`

- [ ] **Step 1: `src/geminiCoachService.js` 전체 교체**

```js
export const CoachingErrorType = {
  NETWORK: 'network',
  UNKNOWN: 'unknown',
}

export class CoachingError extends Error {
  constructor(message, type = CoachingErrorType.UNKNOWN) {
    super(message)
    this.name = 'CoachingError'
    this.type = type
  }
}

export async function getCoachingFeedback({ topic, writing, previousWriting, previousImprovements }) {
  const body = { topic, writing }
  if (previousWriting && previousImprovements) {
    body.previousWriting = previousWriting
    body.previousImprovements = previousImprovements
  }

  let response
  try {
    response = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new CoachingError('네트워크 오류가 발생했어요.', CoachingErrorType.NETWORK)
  }

  if (!response.ok) {
    throw new CoachingError('코칭을 받아오지 못했어요. 잠시 후 다시 시도해주세요.', CoachingErrorType.UNKNOWN)
  }

  return response.json()
}
```

- [ ] **Step 2: `src/App.jsx` 전체 교체**

```jsx
import { useState } from 'react'
import './App.css'
import { getCoachingFeedback, CoachingError, CoachingErrorType } from './geminiCoachService.js'

const MIN_CHARS = 400
const ATTAINMENT_START = 40
const ATTAINMENT_PER_POINT = 10

function App() {
  const [topic, setTopic] = useState('')
  const [writing, setWriting] = useState('')
  const [isCoaching, setIsCoaching] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [attainment, setAttainment] = useState(null)
  const [lastSubmittedWriting, setLastSubmittedWriting] = useState(null)
  const [lastImprovements, setLastImprovements] = useState(null)
  const [error, setError] = useState(null)

  const charCount = writing.length
  const isFirstRound = feedback === null
  const isReady = charCount >= MIN_CHARS
  const progressPercent = Math.min((charCount / MIN_CHARS) * 100, 100)
  const canCoach = isFirstRound ? isReady : true

  const handleCoachClick = async () => {
    setIsCoaching(true)
    setError(null)

    try {
      const result = await getCoachingFeedback({
        topic,
        writing,
        previousWriting: lastSubmittedWriting,
        previousImprovements: lastImprovements,
      })

      setAttainment((prev) => {
        if (!result.addressed) return ATTAINMENT_START
        const fixedCount = result.addressed.filter(Boolean).length
        return (prev ?? ATTAINMENT_START) + fixedCount * ATTAINMENT_PER_POINT
      })
      setFeedback({ strength: result.strength, improvements: result.improvements })
      setLastSubmittedWriting(writing)
      setLastImprovements(result.improvements)
    } catch (err) {
      const message =
        err instanceof CoachingError && err.type === CoachingErrorType.NETWORK
          ? '네트워크 오류가 발생했어요. 다시 시도해주세요.'
          : '코칭을 받아오지 못했어요. 잠시 후 다시 시도해주세요.'
      setError({ message })
    } finally {
      setIsCoaching(false)
    }
  }

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

      {attainment !== null && (
        <div className="attainment-section">
          <div className="attainment-bar-bg">
            <div
              className={`attainment-bar-fill ${attainment >= 100 ? 'full' : ''}`}
              style={{ width: `${Math.min(attainment, 100)}%` }}
            />
          </div>
          <p className="attainment-label">도달도 {attainment}%</p>
        </div>
      )}

      <button
        className={`coach-button ${isCoaching ? 'loading' : ''}`}
        disabled={!canCoach || isCoaching}
        onClick={handleCoachClick}
      >
        {isCoaching ? '코칭 준비 중...' : isFirstRound ? '디노 코칭 받기' : '다시 코칭 받기'}
      </button>

      {error && <p className="error-message">{error.message}</p>}

      {feedback && (
        <div className="feedback-card">
          <p className="feedback-title">🦕 디노의 코칭</p>
          <ul>
            <li>👍 {feedback.strength}</li>
            <li>✏️ {feedback.improvements[0]}</li>
            <li>✏️ {feedback.improvements[1]}</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 3: `src/App.css`에서 API 키 관련 클래스 삭제**

다음 클래스 블록을 파일에서 통째로 제거한다: `.api-key-row`, `.api-key-input`, `.api-key-input:focus`, `.api-key-save-button`, `.api-key-save-button:disabled`, `.api-key-cancel-button`, `.api-key-hint`, `.api-key-hint a`, `.change-key-link` (파일 끝부분, `.error-message` 바로 위까지).

- [ ] **Step 4: `src/App.css`에 도달도 게이지 스타일 추가**

`.progress-section` 블록 뒤, `.coach-button` 블록 앞에 추가:

```css
.attainment-section {
  margin: 0 0 1.5rem;
}

.attainment-bar-bg {
  height: 14px;
  background-color: #e0e0e0;
  border-radius: 7px;
  overflow: hidden;
  margin-bottom: 0.4rem;
}

.attainment-bar-fill {
  height: 100%;
  background-color: #64b5f6;
  border-radius: 7px;
  transition: width 0.3s ease;
}

.attainment-bar-fill.full {
  background-color: #1565c0;
}

.attainment-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1565c0;
  margin: 0;
  text-align: right;
}
```

- [ ] **Step 5: Lint 확인**

Run: `npm run lint`
Expected: 에러 없음

- [ ] **Step 6: 브라우저 수동 확인 (`npm run dev`)**

Run: `npm run dev`, `http://localhost:5173` 접속 후 확인:
1. API 키 입력창이 더 이상 보이지 않음 (즉시 주제/글쓰기 입력 화면).
2. 400자 미만 입력 시 "디노 코칭 받기" 버튼 비활성.
3. 400자 이상 입력 시 버튼 활성 (실제 클릭은 `/api/coach`가 아직 배포/연결 안 되어 있어 네트워크 에러가 뜨는 게 정상 — Task 1에서 만든 함수는 이 순수 `vite dev`로는 뜨지 않음. 에러 메시지가 "네트워크 오류가 발생했어요"로 뜨는지만 확인).

브라우저 콘솔(F12)에 렌더링 관련 에러가 없는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add src/geminiCoachService.js src/App.jsx src/App.css
git commit -m "feat: API 키 입력 UI 제거하고 서버 프록시 연동 + 도달도 시각화 추가"
```

---

### Task 3: 미사용 에셋 삭제

**Files:**
- Delete: `src/assets/hero.png`
- Delete: `src/assets/react.svg`
- Delete: `src/assets/vite.svg`
- Delete: `public/icons.svg`

- [ ] **Step 1: 참조 여부 재확인**

Run: `grep -rE "hero\.png|react\.svg|vite\.svg|icons\.svg" src index.html`
Expected: 아무 결과 없음 (참조하는 곳이 없어야 삭제 가능)

- [ ] **Step 2: 파일 삭제**

```bash
git rm src/assets/hero.png src/assets/react.svg src/assets/vite.svg public/icons.svg
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 성공 (`dist/` 생성)

- [ ] **Step 4: 커밋**

```bash
git commit -m "chore: 미사용 에셋 삭제"
```

---

### Task 4: 문서 갱신 — README + PROJECT_STATUS

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

- [ ] **Step 1: `README.md`의 BYOK 관련 문단을 서버 프록시 방식 설명으로 교체**

"BYOK(Bring Your Own Key)" 문단을 다음 내용으로 교체:

```markdown
- **API 키는 서버에만 저장** — Gemini API 키는 Vercel 서버리스 함수(`api/coach.js`)의 환경변수로만 존재하고 브라우저에는 절대 노출되지 않음
```

"시작하기" 섹션에 로컬에서 서버리스 함수까지 테스트하는 방법 추가:

```markdown
## 시작하기

```bash
npm install
npm run dev
```

`/api/coach`까지 포함해서 로컬에서 테스트하려면 [Vercel CLI](https://vercel.com/docs/cli)로 실행해야 합니다:

```bash
npx vercel dev
```

이 경우 프로젝트 루트에 `.env` 파일을 만들고 `GEMINI_API_KEY=발급받은_키`를 넣어야 합니다 (`.env.example` 참고).
```

- [ ] **Step 2: `docs/PROJECT_STATUS.md`에 이번 재구성 반영**

파일 맨 위 "완료된 기능" 앞에 새 섹션 추가:

```markdown
**5단계 — 교실용 MVP 재구성 (BYOK 제거 + 도달도 시각화)**
- API 키 입력 UI를 완전히 제거하고, Vercel 서버리스 함수(`api/coach.js`)가 `GEMINI_API_KEY` 환경변수로 Gemini를 호출하는 구조로 전환. 브라우저에는 키가 전혀 노출되지 않음.
- Gemini 응답을 정규식 텍스트 파싱 대신 `responseSchema` 기반 JSON 구조화 출력으로 받도록 변경.
- "도달도" 시각화 추가: 40%로 시작, 직전 라운드의 보완할 점 2개 중 고친 개수 × 10%씩 증가, 상한 없음. 점수 계산은 클라이언트가 수행하고 AI는 O/X 판단만 함.
- 미사용 에셋(`hero.png`, `react.svg`, `vite.svg`, `icons.svg`) 삭제.
- 상세 설계는 [`docs/superpowers/specs/2026-07-09-classroom-mvp-design.md`](superpowers/specs/2026-07-09-classroom-mvp-design.md) 참고.
```

"다음 작업 우선순위 (TODO)" 목록에서 이번에 다룬 항목은 없으므로 기존 목록 유지, 맨 끝에 추가:

```markdown
4. **Vercel 배포** — `vercel link` → 대시보드에서 `GEMINI_API_KEY` 환경변수 설정 → git push로 자동 배포 (docs/superpowers/specs/2026-07-09-classroom-mvp-design.md의 "로컬 개발 / 배포" 참고)
```

- [ ] **Step 3: 커밋**

```bash
git add README.md docs/PROJECT_STATUS.md
git commit -m "docs: 교실용 MVP 재구성(서버 키 은닉 + 도달도) 반영"
```

---

## 계획 범위 밖 — 배포는 사용자가 직접 수행

아래는 실제 Gemini 키와 Vercel 계정 권한이 필요해서 이 계획에 포함하지 않았다. Task 1~4가 모두 끝난 뒤 사용자가 직접 진행한다.

```bash
npx vercel login          # 이미 로그인되어 있으면 생략 (skyang9838-2320 계정으로 이미 1회 로그인됨)
npx vercel link           # 프로젝트를 Vercel에 연결 (최초 1회, 질문에 답하면서 진행)
npx vercel env add GEMINI_API_KEY development   # 로컬 vercel dev용 키 등록
npx vercel env add GEMINI_API_KEY production    # 실제 배포용 키 등록
npx vercel dev             # 로컬에서 /api/coach까지 포함해 실제 흐름 확인
```

`vercel dev`로 브라우저에서 직접 확인할 것:
1. 400자 이상 글쓰기 → 코칭 받기 → 도달도 40% + 잘한점 1 + 보완점 2 표시.
2. 보완점 하나만 고쳐서 재제출 → 도달도 정확히 +10%.
3. 둘 다 고쳐서 재제출 → 도달도 정확히 +20%.
4. 이 과정을 3라운드 반복하면 정확히 100%가 되는지, 그 이후로도 계속 반복 가능한지.

문제 없으면 `npx vercel --prod`로 배포하거나, GitHub 저장소를 Vercel 대시보드에 연결해 push마다 자동 배포되게 설정한다.
