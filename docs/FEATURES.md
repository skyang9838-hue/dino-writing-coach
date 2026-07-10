# 디노 글쓰기 코치 — 기능 구현 현황

> 이 문서는 "지금 이 순간 앱이 실제로 무엇을 하는지"를 코드 기준으로 정리한 스펙입니다.
> 작업 흐름/이력은 [`PROJECT_STATUS.md`](PROJECT_STATUS.md)를 참고하세요. 이 문서는 오직 **기능 상태**만 다룹니다.

**기준:** 2026-07-10, Phase 1(Next.js/DB/인증 전환) 완료 시점 — 브랜치 `worktree-nextjs-classroom-mvp`
**배포 주소:** https://dino-writing-coach.vercel.app (이 브랜치 병합 전이라 아직 이전 Vite 버전이 배포되어 있음)

---

## 0. 전체 구조

Next.js 16 App Router. 화면은 교사/학생 역할별로 분리되어 있고, 인증된 교사만 대시보드에 접근할 수 있다. 학생은 계정 없이 교사가 발급한 참여 코드/링크로만 접근한다.

| 경로 | 대상 | 설명 |
|---|---|---|
| `/login` | 교사 | Google 로그인 |
| `/dashboard` | 교사 | 내 활동 목록 |
| `/dashboard/new` | 교사 | 활동 생성 |
| `/dashboard/[activityId]` | 교사 | 활동 상세 (참여 코드/QR, 참여 학생 목록) |
| `/join/[joinCode]` | 학생 | 이름 입력 후 입장 |
| `/write/[submissionId]` | 학생 | 글쓰기·코칭·제출 화면 |

---

## 1. 인증 (`auth.js`, `app/api/auth/[...nextauth]/route.js`)

- Auth.js(NextAuth) v5 + Google Provider. 세션은 DB에 저장(`@auth/prisma-adapter`, `session.strategy = 'database'`).
- `User` 모델이 곧 "교사"다 — 이 앱에 로그인하는 사람은 교사뿐이므로 Auth.js 표준 모델명을 그대로 사용.
- `auth()`로 세션을 확인해 `/dashboard*` 페이지와 관련 Server Action에서 미인증 시 `/login`으로 리다이렉트.
- 학생은 인증 대상이 아님 — `/join`, `/write` 경로는 로그인 여부와 무관하게 접근 가능.

---

## 2. 데이터 모델 (`prisma/schema.prisma`)

- **User/Account/Session/VerificationToken** — Auth.js 표준 스키마 그대로.
- **Activity**: `teacherId`, `title`(자동 생성, 아래 3번 참고), `topic`(= 교사가 입력한 소재), `grade`(학년군), `genre`(글의 종류), `targetLength`(정수, 교사가 정하는 목표 글자 수), `joinCode`(고유, 6자리).
- **Submission**: 학생 1명의 활동 참여 기록. `activityId` + `studentName`이 고유 조합(같은 이름으로 재입장하면 기존 기록으로 복귀).
  - `writing`, `feedback`(json), `attainment`, `lastSubmittedWriting`, `lastImprovements`(json), `rounds`(json 배열) — 이전 버전의 localStorage 세션 구조를 그대로 컬럼화.
  - `status`(`draft`|`submitted`), `submittedWriting`, `submittedAt` — 신규. 제출은 상태 전환일 뿐 잠금이 아니다: 제출 후에도 계속 수정·재코칭·재제출 가능.

---

## 3. 교사 — 활동 생성 (`/dashboard/new`, `components/NewActivityForm.jsx`, `lib/actions.js`의 `createActivity`)

교사가 글쓰기 활동을 만들 수 있는 차시 자체가 많지 않다는 점을 고려해, 입력 항목을 최소화하고 드롭다운 대신 즉시 탭 가능한 칩(버튼) UI를 사용한다. **AI가 활동 내용을 자동 생성하는 기능은 없다** — AI는 오직 학생 코칭 피드백에만 쓰인다(의도적 결정).

- **학년**(`lib/curriculum.js`의 `GRADES`) — 초1-2/3-4/5-6학년군 중 칩으로 선택. 선택 시 목표 글자 수 드롭다운의 기본값이 해당 학년의 권장 글자 수(200/400/600자)로 자동 이동(직접 다른 값을 골라도 이후 유지됨).
- **글의 종류**(`GENRES`) — 일기/편지/주장하는 글/설명하는 글/이야기(창작)/독서감상문 중 칩으로 선택. 이 값은 학생 코칭 프롬프트에도 그대로 전달되어, AI가 장르별로 중요한 포인트(예: 주장하는 글이면 근거 유무)를 함께 짚어주도록 한다(4번 항목 참고).
- **소재**(자유 텍스트, 폼 필드명 `material`) — 글쓰기 활동 제목/주제를 하나로 합친 단일 입력. 서버가 `title = "{글의 종류} - {소재}"`로 자동 조립하고, `topic` 컬럼에는 소재 값을 그대로 저장(별도의 "활동 제목" 입력칸은 없음).
- **목표 글자 수** — 드롭다운(`LENGTH_OPTIONS`: 100~800자 중 선택), 자유 숫자 입력이 아님.
- 참여 코드는 서버가 자동 생성(`lib/joinCode.js`): 혼동되는 문자(0/O, 1/I/L) 제외한 32종 문자로 6자리, 충돌 시 최대 5회 재시도.
- 생성 성공 시 `/dashboard/[activityId]`로 이동.
- 2022 교육과정 성취기준 선택이나 활동 내용 자동 생성은 여전히 없음(Phase 4에서도 성취기준까지는 다루지 않기로 축소됨 — 전체 교육과정 데이터를 구조화하는 범위가 너무 커서 제외).

---

## 4. 교사 — 활동 상세 (`/dashboard/[activityId]`)

- 소유자 확인: 로그인한 교사의 활동이 아니면 404.
- 제목 아래 소재/목표 글자 수/학년/글의 종류를 한 줄로 표시.
- 참여 코드, 참여 링크(`/join/{joinCode}`), 그리고 그 링크의 **QR코드**(`qrcode.react`)를 표시 — 학생이 코드를 타이핑하지 않고 스캔만으로 입장할 수 있게 하기 위함.
- 참여 학생 목록: 이름, 제출 상태(작성 중/제출 완료), 도달도, 코칭 받은 횟수. (학생별 초안↔최종본 diff 열람은 Phase 2 예정 — 이 목록은 그 전 단계로 최소 구현된 것.)

---

## 5. 학생 — 참여 (`/join/[joinCode]`, `lib/actions.js`의 `joinActivity`)

- 존재하지 않는 참여 코드로 접근하면 404.
- 이름을 입력하면 `(activityId, studentName)` 조합으로 Submission을 찾거나 새로 생성(upsert) → `/write/[submissionId]`로 이동.
- 같은 이름으로 다시 들어오면 기존 글/코칭 기록을 그대로 이어서 볼 수 있음 — 별도의 로그인이나 브라우저 저장 없이 DB의 이름 조합 자체가 복귀 키 역할을 한다.
- 이름 미입력 등 검증 실패 시 같은 화면에 에러 메시지 표시(`useActionState` 사용).

---

## 6. 학생 — 글쓰기·코칭·제출 (`/write/[submissionId]`, `components/WritingScreen.jsx`)

기존 단일 화면 앱의 핵심 로직(글자 수 진행 바, 도달도 게이지, 코칭 흐름, 퇴고 히스토리, diff 강조)을 그대로 옮기고, 저장 위치만 localStorage → DB로 바꿨다.

### 글자 수 진행 바
- 목표 글자 수는 **활동마다 교사가 정한 값**(`activity.targetLength`) — 이전의 400자 고정 상수는 제거됨.
- 1회차 코칭 버튼은 목표 글자 수 미만이면 비활성화. 2회차 이후에는 이 조건이 사라짐(로직 동일).

### 도달도 게이지 (`lib/attainment.js`)
- 1회차는 무조건 40%. 이후 라운드는 직전 보완점 2개 중 고친 개수 × 10%를 더함. 상한 없음. 계산 로직은 순수 함수로 분리되어 Vitest로 테스트됨.

### AI 코칭 (`lib/coaching.js`, Server Action `requestCoaching`)
- 프롬프트/스키마는 기존 `api/coach.js`와 동일(디노 페르소나, 1회차 vs 재코칭 분기, Gemini `responseSchema` 구조화 출력).
- 서버 측에서 활동의 `topic`을 불러와 프롬프트에 사용(학생이 주제를 직접 입력하지 않음 — 교사가 활동 생성 시 정한 소재를 그대로 씀).
- **장르별 코칭 지침 추가**: 활동의 `genre`에 맞는 한 줄 지침(`lib/curriculum.js`의 `GENRE_COACHING_GUIDANCE`)이 프롬프트 끝에 덧붙여짐(예: "주장하는 글"이면 "주장이 분명한지, 근거가 있는지도 함께 봐줘." 추가). 실제 Gemini 호출로 검증됨 — 장르를 반영한 피드백이 나오는 것 확인.
- 1회차 진입 시 목표 글자 수 미달이면 서버에서도 방어적으로 거부(클라이언트 버튼 비활성화와 별개의 서버측 검증).
- 결과는 Submission 행에 즉시 반영(feedback/attainment/rounds 갱신) — 별도 API 라우트 없이 Server Action이 DB에 직접 기록.

### 제출 (Server Action `submitWriting`, PRD 1.6 신규 기능)
- "제출하기" 버튼 클릭 시 현재 글을 `submittedWriting`으로 스냅샷하고 `submittedAt` 기록, `status`를 `submitted`로 변경.
- 제출 후에도 화면은 잠기지 않음 — 계속 수정, 재코칭, 재제출 가능("다시 제출하기"로 라벨만 바뀜).

### 자동 저장
- `writing` 변경 800ms 후 debounce로 `saveDraft` Server Action 호출(첫 렌더링 시에는 저장하지 않도록 skip 처리).
- 코칭/제출 시점에도 그 시점의 `writing`이 함께 저장됨.

### 퇴고 히스토리 & diff 강조
- 로직/마크업 100% 동일하게 이식: 라운드별 "초안/N차 수정" 카드, 지난 미션 반영 여부 ✅/❌, `diffWords` 기반 추가(파랑 밑줄)/삭제(빨강 취소선) 강조.

---

## 7. 보안 / 키 관리

- Gemini API 키는 여전히 서버 환경변수(`GEMINI_API_KEY`)에만 존재, 브라우저에 노출되지 않음(기존과 동일).
- Google OAuth 클라이언트 시크릿(`AUTH_GOOGLE_SECRET`), 세션 서명 비밀(`AUTH_SECRET`)도 Vercel 환경변수로만 존재.
- DB 접속 정보(`DATABASE_URL` 등)는 Neon 마켓플레이스 통합이 자동 관리, 코드에는 등장하지 않음.

---

## 8. 알려진 제약 / 미구현 영역 (Phase 1 기준)

- **디노 캐릭터 이미지/애니메이션 없음** (이전과 동일한 미구현 상태)
- **루브릭 업로드/파싱, 피드백 우선순위 선택 없음** — Phase 3 예정
- **성취기준 선택/AI 기반 활동 자동 생성 없음(의도적 제외)** — 학년/글의 종류는 칩으로 고를 수 있지만, 전체 2022 교육과정 성취기준 데이터를 구조화하는 건 범위가 너무 커서 하지 않기로 결정. AI가 활동 제목/소재를 대신 생성하는 기능도 의도적으로 넣지 않음(AI는 학생 코칭에만 사용).
- **무의미한 글(자모 반복/욕설/복붙) 감지 가드 없음** — Phase 4 예정
- **학생별 초안↔최종본 diff를 교사가 보는 전용 화면 없음** — 활동 상세에 참여 학생 목록은 있지만, 각 학생 글의 diff를 교사 화면에서 열람하는 기능은 Phase 2 예정
- **100% 이후 특별 연출 없음** (이전과 동일)
- **정식 UI/E2E 테스트 스위트 없음** — Vitest 유닛테스트는 이번에 도입됐지만(순수 로직 한정), UI 흐름 검증은 여전히 임시 Playwright 스크립트 관례. 특히 **Google OAuth 로그인 흐름은 자동화하지 않음**(구글의 자동화 방지 정책 때문에 실용적이지 않음) — 사용자가 수동으로 검증.
