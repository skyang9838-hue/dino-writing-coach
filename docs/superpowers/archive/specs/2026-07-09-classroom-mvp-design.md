# 디노 글쓰기 코치 — 교실용 MVP 재구성 스펙

**날짜:** 2026-07-09
**범위:** BYOK 제거 + 키 서버 은닉(Vercel 서버리스) + 도달도(수정 루프) 시각화
**배경:** 기능을 더 만드는 대신, 교실에서 바로 쓸 수 있는 최소 구조로 정리한다. 핵심 4가지만 남긴다 — 학생 글쓰기, AI 코칭, 수정할수록 오르는 도달도, 안전하게 숨긴 API 키.

---

## 목표

1. 학생이 글을 작성한다. *(기존 UI 유지)*
2. AI가 잘한 점 1개 + 보완할 점 2개로 코칭한다. *(기존 유지, 응답 형식만 JSON으로 견고화)*
3. 학생이 수정할수록 **도달도**가 시각적으로 올라간다. *(신규)*
4. API 키는 브라우저에 절대 노출되지 않고 배포 가능하다. *(BYOK 제거, Vercel 서버리스 함수로 전환)*

---

## 전체 아키텍처

```
브라우저 (React, 키 없음)
   │  POST /api/coach  { topic, writing, previousWriting?, previousImprovements? }
   ▼
Vercel 서버리스 함수 (api/coach.js)
   │  Gemini 키는 Vercel 환경변수(GEMINI_API_KEY)에서만 읽음
   ▼
Gemini API (gemini-2.5-flash-lite, JSON 구조화 응답)
```

- 서버는 **완전히 무상태(stateless)** — DB, 세션 저장소 없음.
- 라운드 히스토리(직전 글, 직전 보완점, 현재 도달도)는 **React state로만** 유지하고, 매 요청마다 필요한 문맥을 그대로 실어 보낸다.
- 로그인/계정 없음. 반 전체가 배포된 한 앱을 공유해서 사용(현재 BYOK와 동일한 무계정 전제, 키만 서버로 이동).

---

## 도달도(수정 루프) 로직

### 1회차
- 학생이 **400자 이상** 쓰고 "디노 코칭 받기" 클릭 (400자 미만이면 버튼 비활성 — 기존 동작 유지).
- 서버리스 함수가 Gemini에 `topic + writing`만 보냄.
- Gemini 응답: `{ strength: string, improvements: [string, string] }`
- 도달도는 글 품질과 무관하게 **항상 40%**로 시작.

### 2회차 이후
- 학생이 같은 textarea에서 글을 고치고 "다시 코칭 받기" 클릭.
- 서버리스 함수가 Gemini에 `topic + 직전 writing + 직전 improvements 2개 + 새 writing`을 보냄.
- Gemini 응답: `{ addressed: [boolean, boolean], strength: string, improvements: [string, string] }`
  - `addressed[i]`는 직전 보완점 i번을 새 글에서 고쳤는지 여부.
  - `strength`/`improvements`는 **새 글 기준**으로 새로 생성한 잘한점 1개 + 보완점 2개(다음 라운드용).
- **점수 계산은 클라이언트(앱)가 직접 함**: `addressed`에서 `true`인 개수 × 10%를 이전 도달도에 더함. (AI는 O/X 판단만 하고 숫자 계산은 하지 않음 → 계산 오류 방지)
- 예시: 40% 시작 → 2개 다 고치면 60% → 또 2개 다 고치면 80% → 또 2개 다 고치면 **정확히 100%**.
- **상한 없음.** 100% 이후에도 계속 반복 가능하며 120%, 150%까지 올라갈 수 있음. 학생이 원하는 만큼 반복.

### Gemini 응답 형식
- `responseMimeType: application/json` + `responseSchema`로 구조화 출력을 강제한다.
- 기존의 정규식 기반 텍스트 파싱(`parseFeedbackText`)은 제거한다 — JSON 파싱으로 대체하여 더 견고하게 만든다.

---

## UI 변경

### 삭제
- API 키 입력 UI 전체: `apiKey`/`apiKeyInput`/`isEditingKey` state, 키 입력 `<input type="password">`, "저장"/"취소"/"키 변경" 버튼, `localStorage` 키 저장/조회 로직, `API_KEY_STORAGE_KEY` 상수, Google AI Studio 안내 링크.
- `GeminiCoachingError`의 `AUTH` 에러 타입과 그 UI 분기(사용자가 더 이상 키를 다루지 않으므로 "키가 틀렸어요" 케이스가 사용자 책임이 아님). 에러는 네트워크/일반 실패 메시지 하나로 단순화.

### 추가
- **도달도 게이지**: 코칭을 한 번이라도 받은 뒤부터 표시. 퍼센트 숫자 + 진행 바. 바의 시각적 너비는 100%에서 고정(꽉 채움)하되, 숫자는 100% 이후에도 실제 값(120%, 150% 등)을 그대로 계속 표시한다. 100% 도달 시 바 색상을 강조색으로 바꿔 "가득 찼다"는 것을 표현한다.
- 코칭 버튼 라벨: 최초 "디노 코칭 받기" → 첫 피드백 이후 "다시 코칭 받기"로 텍스트만 전환(기존 버튼 재사용).
- 라운드가 늘어나도 화면 흐름은 동일 — topic/writing 입력 위치 그대로, 그 아래 피드백 카드가 매 라운드 갱신됨.

### 유지
- 400자 글자 수 진행 바는 **1회차 진입 조건**으로 그대로 유지. 2회차 이후 재제출에는 글자 수 제한 없음(줄어들어도 재제출 가능).

---

## 상태 (State) — `src/App.jsx`

| 변수 | 타입 | 설명 |
|------|------|------|
| `topic` | string | 글쓰기 주제 (기존 유지) |
| `writing` | string | 현재 글쓰기 입력값 (기존 유지) |
| `isCoaching` | boolean | API 호출 중 여부 (기존 유지) |
| `feedback` | `{ strength, improvements: [string,string] } \| null` | 최신 피드백 |
| `attainment` | `number \| null` | 현재 도달도(%). `null`이면 아직 1회차도 안 함 |
| `lastSubmittedWriting` | string | 직전 라운드에 제출한 글(다음 라운드 비교용) |
| `lastImprovements` | `[string,string] \| null` | 직전 라운드의 보완점 2개(다음 라운드 비교용) |
| `error` | `{ message } \| null` | 에러 메시지 (기존 유지, AUTH 분기만 제거) |

`apiKey`, `apiKeyInput`, `isEditingKey`는 삭제.

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `api/coach.js` | **신규.** Vercel 서버리스 함수. `topic`, `writing`, (있으면) `previousWriting`+`previousImprovements`를 받아 Gemini 호출, JSON 구조화 응답을 그대로 반환. `GEMINI_API_KEY` 환경변수 사용. |
| `src/geminiCoachService.js` | Gemini 직접 호출 로직 제거. `/api/coach`를 fetch하는 얇은 클라이언트 함수로 축소. `apiKey` 파라미터 제거. |
| `src/App.jsx` | 키 입력 UI 전체 제거. 도달도 계산(`+10%`/보완점, 40% 시작, 상한 없음) 및 게이지 UI 추가. 라운드 히스토리 state 추가. |
| `src/App.css` | 키 입력 관련 클래스(`.api-key-row` 등) 제거. 도달도 게이지 스타일 추가. |
| `vercel.json` | **신규(필요 시).** Vite 빌드 출력 + `/api` 함수 라우팅 설정. |
| `README.md` | BYOK 안내 제거, Vercel 배포 + 환경변수 설정 안내로 교체. |
| `docs/PROJECT_STATUS.md` | 이번 재구성 반영. |
| `src/assets/hero.png`, `public/icons.svg` | 삭제 (미사용 에셋). |

---

## 로컬 개발 / 배포

- 로컬에서 서버리스 함수까지 테스트하려면 `vercel dev` 사용(순수 `vite dev`는 `/api` 라우트를 못 돌림). `vercel dev`는 `.env`의 `GEMINI_API_KEY`를 읽어 Gemini 호출.
- 배포: Vercel에 프로젝트 연결 → 대시보드에서 환경변수 `GEMINI_API_KEY` 설정 → git push 시 자동 배포.

---

## 검증 방법

- 이 프로젝트 관례대로 정식 테스트 프레임워크는 도입하지 않음.
- `vercel dev`로 로컬 구동 후 브라우저에서 직접 확인:
  1. 400자 미만: 코칭 버튼 비활성.
  2. 400자 이상 → 코칭 받기 → 도달도 40%, 잘한점 1 + 보완점 2 표시.
  3. 보완점 하나만 고쳐서 재제출 → 도달도 50%.
  4. 둘 다 고쳐서 재제출 → +20%가 정확히 반영되는지.
  5. 3라운드 연속으로 다 고치면 정확히 100%가 되는지, 그 이후로도 계속 반복 가능한지.
  6. 새로고침 시 키 입력 UI가 더 이상 나타나지 않는지(삭제 확인).

---

## 범위 외 (이번 단계에서 하지 않는 것)

- 데이터 저장(localStorage에 글쓰기 내용 유지) — 기존 TODO였으나 이번 스펙엔 포함 안 함.
- 디노 캐릭터 이미지/애니메이션.
- 주제 목록 관리(랜덤/선택).
- 로그인/계정, 학생별 기록 저장.
- 도달도 100% 이상일 때의 특별한 축하 연출(그냥 숫자/바만 계속 올라감).
