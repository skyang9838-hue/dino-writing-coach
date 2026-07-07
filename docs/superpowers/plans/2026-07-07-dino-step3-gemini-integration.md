# 디노 글쓰기 코치 3단계 — 실제 Gemini API 연동 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mock 코칭(`setTimeout` + 랜덤 문구)을 실제 Gemini API 호출로 교체한다. 사용자가 자신의 Gemini API 키를 직접 발급받아 앱에 입력("BYOK", bring your own key)하고, 그 키는 `localStorage`에만 저장되어 브라우저에서 Gemini API를 직접 호출한다. 서버/프록시 없음.

**핵심 결정 사항 (사용자 확정):**
1. **키 보호 방식:** BYOK — 공유 키를 번들/서버에 두지 않는다. 각 사용자가 자기 키를 직접 입력하고 자기 브라우저의 `localStorage`에만 저장한다. `.env`, 서버리스 프록시 불필요.
2. **키 입력 UI:** 별도 모달/설정 화면 없이, 키가 없을 때 "디노 코칭 받기" 버튼 자리에 인라인 입력창 표시.

**Architecture:** 새 순수 함수 모듈 `src/geminiCoachService.js` (React 비의존, fetch 기반)을 만들고, `App.jsx`에서 이 모듈을 호출한다. 기존 "컴포넌트 분리 없음" 원칙은 유지하되(App.jsx 하나), API 통신 로직만 별도 파일로 분리한다 (재사용/수동 테스트 용이성 때문).

**Tech Stack:** React 19, Vite 8, plain CSS, JavaScript (JSX), 외부 라이브러리 추가 없음 (SDK 대신 순수 `fetch` 사용).

## Global Constraints

- 컴포넌트 분리 없음 — `App.jsx` 하나에서 UI 처리 (API 통신 로직만 `geminiCoachService.js`로 분리)
- TypeScript 사용 안 함
- 외부 라이브러리(예: `@google/genai`) 추가 안 함 — REST 엔드포인트를 `fetch`로 직접 호출
- 테스트 프레임워크 없음 — 브라우저 수동 확인으로 대체
- 서버/백엔드/서버리스 프록시 없음 — 순수 프론트엔드 유지

---

## ⚠️ 먼저 확인할 위험 요소: 브라우저 CORS

`generativelanguage.googleapis.com`이 브라우저에서의 직접 `fetch()` 호출(origin `http://localhost:5173`)을 CORS로 허용하는지는 100% 확정된 정보가 아니다. BYOK 방식 전체가 이 전제 위에 있으므로, **Task 1 코드를 작성하기 전에 Task 0(코드 커밋 없는 스파이크)로 먼저 검증**한다. 실패 시 (a) 헤더 방식(`x-goog-api-key`)으로 재시도, (b) 그래도 안 되면 이 계획을 재검토하고 최소 서버리스 프록시 옵션을 사용자와 다시 논의해야 한다.

키를 헤더가 아닌 `?key=` 쿼리 파라미터로 보내는 이유도 이 때문이다 — `Content-Type: application/json`만으로 이미 preflight가 발생하는데, 커스텀 헤더까지 추가하면 preflight 실패 가능성이 늘어난다.

---

## 파일 구조

| 파일 | 변경 | 역할 |
|------|------|------|
| `src/geminiCoachService.js` | **신규 생성** | Gemini API 호출, 프롬프트 생성, 응답 파싱, 에러 분류 |
| `src/App.jsx` | **부분 수정** | API 키 상태/입력 UI, `handleCoachClick`을 실제 API 호출로 교체, `MOCK_FEEDBACK_SETS` 제거 |
| `src/App.css` | **추가만** | 키 입력창, 에러 메시지 스타일 추가 (기존 스타일 유지) |
| `docs/PROJECT_STATUS.md` | **부분 수정** | 3단계 완료 기록, 미해결 결정 사항 제거 |
| `src/main.jsx`, `src/index.css` | 변경 없음 | 그대로 유지 |

---

### Task 0: CORS 스파이크 (코드 커밋 없음)

**Files:** 없음 (브라우저 devtools에서만 확인)

- [x] **Step 1: 실제 Gemini API 키로 브라우저에서 직접 fetch 테스트**

  1. https://aistudio.google.com/apikey 에서 무료 API 키 발급
  2. `npm run dev` 실행 후 `http://localhost:5173` 접속
  3. devtools Console에서 아래 코드 실행 (키만 교체):

  ```js
  fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=여기에_실제_키',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: '안녕이라고 한 문장으로 답해줘' }] }],
      }),
    }
  ).then(r => r.json()).then(console.log).catch(console.error)
  ```

  4. 정상 응답(`candidates[0].content.parts[0].text`)이 콘솔에 찍히면 통과. CORS 에러가 뜨면 즉시 중단하고 사용자와 재논의.

---

### Task 1: `src/geminiCoachService.js` 생성

**Files:**
- Create: `src/geminiCoachService.js`

**Interfaces:**
- Produces: `getCoachingFeedback(apiKey, topic, writing) → Promise<string[]>`, `GeminiCoachingError`, `GeminiErrorType`
- Consumed by: `src/App.jsx`의 `handleCoachClick`

- [x] **Step 1: 서비스 모듈 작성**

  ```js
  const MODEL_ID = 'gemini-2.5-flash-lite'
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`

  export const GeminiErrorType = {
    AUTH: 'auth',
    NETWORK: 'network',
    UNKNOWN: 'unknown',
  }

  export class GeminiCoachingError extends Error {
    constructor(message, type = GeminiErrorType.UNKNOWN) {
      super(message)
      this.name = 'GeminiCoachingError'
      this.type = type
    }
  }

  function buildCoachingPrompt(topic, writing) {
    return `너는 초등학생 글쓰기를 도와주는 친절한 공룡 코치 '디노'야.
  아래는 아이가 "${topic}" 주제로 쓴 글이야.

  ---
  ${writing}
  ---

  이 글에 대해 칭찬 1가지와 개선 제안 2가지, 총 3줄의 피드백을 한국어로 작성해줘.
  반드시 아래 형식만 사용하고 다른 말은 하지 마:
  1. (피드백 1)
  2. (피드백 2)
  3. (피드백 3)`
  }

  function parseFeedbackText(rawText) {
    const numbered = [...rawText.matchAll(/^\s*(?:\d+[.)]|[-*•])\s*(.+)$/gm)].map((m) => m[1].trim())
    if (numbered.length > 0) return numbered.slice(0, 3)

    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length > 0) return lines.slice(0, 3)

    const fallback = rawText.trim()
    return fallback ? [fallback] : ['디노가 피드백을 만드는 데 실패했어요. 다시 시도해주세요.']
  }

  export async function getCoachingFeedback(apiKey, topic, writing) {
    const prompt = buildCoachingPrompt(topic, writing)
    const url = `${API_URL}?key=${encodeURIComponent(apiKey)}`

    let response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        }),
      })
    } catch {
      throw new GeminiCoachingError('네트워크 오류가 발생했어요.', GeminiErrorType.NETWORK)
    }

    if (!response.ok) {
      let body = null
      try { body = await response.json() } catch { /* ignore parse failure */ }
      const isAuthError =
        [400, 401, 403].includes(response.status) &&
        (['INVALID_ARGUMENT', 'PERMISSION_DENIED', 'UNAUTHENTICATED'].includes(body?.error?.status) ||
          /api key/i.test(body?.error?.message ?? ''))
      throw new GeminiCoachingError(
        body?.error?.message ?? 'API 요청이 실패했어요.',
        isAuthError ? GeminiErrorType.AUTH : GeminiErrorType.UNKNOWN
      )
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new GeminiCoachingError('디노가 답을 만들지 못했어요. 다시 시도해주세요.', GeminiErrorType.UNKNOWN)
    }
    return parseFeedbackText(text)
  }
  ```

**왜 이렇게 짜는가:**
- `?key=` 쿼리 파라미터: 커스텀 헤더를 추가하지 않아 CORS preflight 실패 가능성을 줄임 (위 CORS 스파이크 항목 참고).
- `GeminiCoachingError`에 `type`을 실어서, `App.jsx`가 "키가 틀렸다"와 "그 외 오류"를 구분해 다른 메시지를 보여줄 수 있게 함.
- `parseFeedbackText`는 모델이 형식을 안 지켜도 최소 하나의 문자열 배열을 반환하도록 3단계 fallback을 둠 (빈 배열/undefined로 UI가 깨지는 것 방지).

---

### Task 2: `src/App.jsx` 수정

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `getCoachingFeedback`, `GeminiCoachingError`, `GeminiErrorType` from `./geminiCoachService.js`

- [x] **Step 1: `MOCK_FEEDBACK_SETS` 제거**

  파일 상단의 `MOCK_FEEDBACK_SETS` 배열 전체 삭제. 실제 API가 그 역할을 대체하므로 죽은 코드로 남기지 않음.

- [x] **Step 2: import 및 상태 추가**

  ```jsx
  import { getCoachingFeedback, GeminiCoachingError, GeminiErrorType } from './geminiCoachService.js'

  const API_KEY_STORAGE_KEY = 'dino-writing-coach:gemini-api-key'
  ```

  컴포넌트 내부에 추가:
  ```jsx
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE_KEY) ?? '')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [isEditingKey, setIsEditingKey] = useState(false)
  const [error, setError] = useState(null) // { message } | null

  const hasKey = apiKey.length > 0
  const showKeyInput = !hasKey || isEditingKey
  ```

  > `useState(() => localStorage.getItem(...))` 처럼 초기값을 함수로 주는 이유: `useEffect`로 나중에 읽으면 첫 렌더링에 "키 없음" 화면이 한 프레임 깜빡였다가 버튼으로 바뀌는 현상이 생김. lazy initializer는 첫 렌더링부터 바로 올바른 값을 사용.

- [x] **Step 3: 핸들러 추가/수정**

  ```jsx
  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed)
    setApiKey(trimmed)
    setApiKeyInput('')
    setIsEditingKey(false)
    setError(null)
  }

  const handleChangeKeyClick = () => {
    setApiKeyInput('')
    setIsEditingKey(true)
  }

  const handleCancelEditKey = () => {
    setIsEditingKey(false)
    setApiKeyInput('')
  }

  const handleCoachClick = async () => {
    setIsCoaching(true)
    setFeedback(null)
    setError(null)
    try {
      const result = await getCoachingFeedback(apiKey, topic, writing)
      setFeedback(result)
    } catch (err) {
      if (err instanceof GeminiCoachingError && err.type === GeminiErrorType.AUTH) {
        setError({ message: 'API 키가 올바르지 않아요. 키를 다시 확인해주세요.' })
        setIsEditingKey(true)
      } else {
        setError({ message: '코칭을 받아오지 못했어요. 잠시 후 다시 시도해주세요.' })
      }
    } finally {
      setIsCoaching(false)
    }
  }
  ```

  기존 `handleCoachClick`(setTimeout 버전)을 위 코드로 완전히 교체.

- [x] **Step 4: 렌더링 — 버튼 자리를 조건부로 교체**

  기존 `<button className="coach-button" ...>` 블록을 아래로 교체:

  ```jsx
  {showKeyInput ? (
    <div className="api-key-row">
      <input
        type="password"
        className="api-key-input"
        placeholder="Gemini API 키를 입력하세요"
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
      />
      <button
        className="api-key-save-button"
        disabled={!apiKeyInput.trim()}
        onClick={handleSaveKey}
      >
        저장
      </button>
      {hasKey && (
        <button className="api-key-cancel-button" onClick={handleCancelEditKey}>
          취소
        </button>
      )}
    </div>
  ) : (
    <>
      <button
        className={`coach-button ${isCoaching ? 'loading' : ''}`}
        disabled={!isReady || isCoaching}
        onClick={handleCoachClick}
      >
        {isCoaching ? '코칭 준비 중...' : '디노 코칭 받기'}
      </button>
      <button className="change-key-link" disabled={isCoaching} onClick={handleChangeKeyClick}>
        키 변경
      </button>
    </>
  )}
  {showKeyInput && (
    <p className="api-key-hint">
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
        Google AI Studio
      </a>
      에서 무료로 API 키를 발급받을 수 있어요.
    </p>
  )}
  {error && <p className="error-message">{error.message}</p>}
  ```

  기존 feedback 카드 렌더링 블록은 그대로 유지 (변경 없음).

- [x] **Step 5: 브라우저에서 확인**

  `npm run dev` 실행 후 확인 (Task 4의 검증 체크리스트로 상세 진행).

---

### Task 3: `src/App.css` 스타일 추가

**Files:**
- Modify: `src/App.css` (기존 내용 유지, 아래 블록만 파일 끝에 추가)

- [x] **Step 1: 아래 CSS를 파일 끝에 추가**

  ```css
  .api-key-row {
    display: flex;
    gap: 0.6rem;
    align-items: stretch;
  }

  .api-key-input {
    flex: 1 1 auto;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.6rem 0.8rem;
    font-size: 1rem;
    border: 1.5px solid #ccc;
    border-radius: 8px;
    outline: none;
  }

  .api-key-input:focus {
    border-color: #4caf50;
  }

  .api-key-save-button {
    flex: 0 0 auto;
    padding: 0.6rem 1rem;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    background-color: #2e7d32;
    color: white;
    cursor: pointer;
  }

  .api-key-save-button:disabled {
    background-color: #e0e0e0;
    color: #9e9e9e;
    cursor: not-allowed;
  }

  .api-key-cancel-button {
    flex: 0 0 auto;
    padding: 0.6rem 1rem;
    border: 1.5px solid #ccc;
    border-radius: 8px;
    background-color: white;
    color: #666;
    cursor: pointer;
  }

  .api-key-hint {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: #888;
  }

  .api-key-hint a {
    color: #2e7d32;
  }

  .change-key-link {
    display: block;
    margin: 0.5rem auto 0;
    background: none;
    border: none;
    color: #666;
    font-size: 0.85rem;
    text-decoration: underline;
    cursor: pointer;
    padding: 0.2rem;
  }

  .error-message {
    margin-top: 0.8rem;
    color: #c62828;
    font-size: 0.9rem;
    text-align: center;
    overflow-wrap: anywhere;
  }
  ```

**왜 이렇게 짜는가:**
- `.api-key-input`의 `min-width: 0`: flex 아이템은 기본적으로 내용 길이만큼 최소 너비를 가지려고 해서, 긴 API 키 문자열이 `.container` 너비를 밀어낼 수 있음 (2단계에서 겪었던 "flex 자식 width 미지정 버그"와 같은 유형). `min-width: 0`으로 방지.
- `.error-message`의 `overflow-wrap: anywhere`: 에러 메시지나 실수로 붙여넣은 긴 키 문자열이 줄바꿈 없이 가로로 넘치는 것 방지.

- [x] **Step 2: 레이아웃 흔들림 없는지 확인**

  devtools Elements 패널에서 `.container`의 계산된 width를 지켜보며, 키 입력창 ↔ 버튼 전환, 에러 메시지 표시/숨김 시 너비가 변하지 않는지 확인 (높이만 변해야 함).

---

### Task 4: `docs/PROJECT_STATUS.md` 업데이트

**Files:**
- Modify: `docs/PROJECT_STATUS.md`

- [x] **Step 1: "완료된 기능"에 3단계 추가, TODO/기술 부채에서 관련 항목 제거**

  - TODO 1번("Gemini API 실제 연동") 항목을 "완료된 기능"으로 이동, BYOK 방식 채택 이유와 새 파일(`src/geminiCoachService.js`), 사용 모델(`gemini-2.5-flash-lite`), CORS 스파이크 결과를 기록.
  - "주의할 점 / 기술 부채"에서 "API 키 보안 결정이 아직 없음" 문단 제거.
  - "마지막 갱신"/"최신 커밋" 갱신 (커밋 완료 후).
  - TODO 2~4번(localStorage 저장, 디노 캐릭터, 라우팅)은 그대로 유지.

---

### Task 5: 최종 수동 검증

**Files:** 없음 (브라우저 확인만)

- [x] **Step 1: 아래 체크리스트를 모두 확인**

  | 확인 항목 | 기대 결과 |
  |----------|----------|
  | (a) 최초 진입, 키 없음 | 버튼 자리에 입력창+저장 버튼 표시. 빈 값이면 저장 비활성. 저장 후 버튼+"키 변경" 링크로 전환. devtools에서 `localStorage` 값 확인 |
  | (b) 실제 피드백 | 주제 입력 + 400자 이상 작성 후 클릭 → "코칭 준비 중..." → 실제 Gemini 응답 기반 피드백 카드 표시 (mock 문구 아님) |
  | (c) 잘못된 키 | 임의 문자열을 키로 저장 후 코칭 시도 → "API 키가 올바르지 않아요" 에러 표시 + 입력창 자동 재오픈 |
  | (d) 레이아웃 안정성 | 입력창↔버튼 전환, 에러 표시/숨김 시 `.container` 너비 불변 (Task 3 Step 2 참고) |
  | (e) 새로고침 후 유지 | 키 저장 후 하드 새로고침 → 깜빡임 없이 바로 버튼 표시 (localStorage에서 즉시 로드) |

  테스트 프레임워크가 없는 프로젝트 관례에 따라, 필요하면 스크래치패드에 임시 Playwright 스크립트를 작성해 (a)/(d)/(e)를 자동화해도 되지만 필수는 아님.

---

## 설계 가정 (사용자 확인 필요)

계획을 세우며 명시적으로 요청받지 않았지만 판단으로 추가한 부분들:

1. **"키 변경" 클릭 시 입력창은 빈 값으로 시작** (기존 키를 화면에 노출하지 않기 위해).
2. **"취소" 버튼**은 이미 키가 저장되어 있는 상태에서 "키 변경"을 눌렀을 때만 표시 (최초 입력 시엔 키가 필수라 취소 불가).
3. 키 입력창은 `type="password"`로 마스킹.
4. Google AI Studio 링크 힌트 문구 추가 (최소 UI를 원하시면 생략 가능).
5. 키를 헤더가 아닌 `?key=` 쿼리 파라미터로 전송 (CORS 리스크 최소화 목적의 기술적 판단).

이 중 바꾸고 싶은 부분이 있으면 알려주세요.
