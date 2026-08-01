# 디노 글쓰기 코치 — 기능 구현 현황

> 이 문서는 "지금 이 순간 앱이 실제로 무엇을 하는지"를 코드 기준으로 정리한 스펙입니다.
> 작업 흐름/이력은 [`PROJECT_STATUS.md`](PROJECT_STATUS.md)를 참고하세요. 이 문서는 오직 **기능 상태**만 다룹니다.

**기준:** 2026-08-01, Phase 1~4 완료 + 디자인/타이포그래피 통일 + **면담 보고서 루브릭 코칭 파일럿**(6-1번 항목) + **학생 수정 진행 대시보드**(4-1번 항목)까지 반영 — `master` 브랜치
**배포 주소:** https://dino-writing-coach.vercel.app — 2026-08-01 확인 시 배포본은 `3ec2c40`(07-28) 시점이라 **면담 보고서 파일럿은 아직 프로덕션에 없다**(`master`에만 있음)

---

## 0. 전체 구조

Next.js 16 App Router. 화면은 교사/학생 역할별로 분리되어 있고, 인증된 교사만 대시보드에 접근할 수 있다. 학생은 계정 없이 교사가 발급한 참여 코드/링크로만 접근한다. 교사용 목록 화면(대시보드/활동 상세)은 `components/TeacherHeader.jsx`(아이콘+제목/이메일+로그아웃)를 공유해 헤더가 동일하게 보인다. 학생 수정 진행 대시보드만 도달도 카드를 헤더에 넣느라 직접 조립한다(4-1번 항목).

| 경로 | 대상 | 설명 |
|---|---|---|
| `/login` | 교사 | Google 로그인 |
| `/dashboard` | 교사 | 내 활동 목록 + 활동 생성 폼(같은 화면 하단에 인라인) |
| `/dashboard/[activityId]` | 교사 | 활동 상세 (참여 코드/QR, 참여 학생 목록) |
| `/join/[joinCode]` | 학생 | 이름 입력 후 입장 |
| `/write/[submissionId]` | 학생 | 글쓰기·코칭 화면 |

---

## 1. 인증 (`auth.js`, `app/api/auth/[...nextauth]/route.js`)

- Auth.js(NextAuth) v5 + Google Provider. 세션은 DB에 저장(`@auth/prisma-adapter`, `session.strategy = 'database'`).
- `User` 모델이 곧 "교사"다 — 이 앱에 로그인하는 사람은 교사뿐이므로 Auth.js 표준 모델명을 그대로 사용.
- `auth()`로 세션을 확인해 `/dashboard*` 페이지와 관련 Server Action에서 미인증 시 `/login`으로 리다이렉트.
- 학생은 인증 대상이 아님 — `/join`, `/write` 경로는 로그인 여부와 무관하게 접근 가능.

---

## 2. 데이터 모델 (`prisma/schema.prisma`)

- **User/Account/Session/VerificationToken** — Auth.js 표준 스키마 그대로.
- **Activity**: `teacherId`, `title`(자동 생성, 아래 3번 참고), `topic`(= 교사가 입력한 소재), `instructions`(학생에게 안내할 말, 선택), `grade`(학년군), `genre`(글의 종류), `targetLength`(정수, 교사가 정하는 목표 글자 수), `joinCode`(고유, 6자리).
- **Submission**: 학생 1명의 활동 참여 기록. `activityId` + `studentName`이 고유 조합(같은 이름으로 재입장하면 기존 기록으로 복귀).
  - `writing`, `feedback`(json), `attainment`, `lastSubmittedWriting`, `lastImprovements`(json), `rounds`(json 배열) — 이전 버전의 localStorage 세션 구조를 그대로 컬럼화.
  - "제출하기" 개념은 넣었다가 제거함(아래 6번 항목 참고) — `status`/`submittedWriting`/`submittedAt` 컬럼은 존재하지 않음.

---

## 3. 교사 — 활동 생성 (`/dashboard` 하단 인라인 섹션, `components/NewActivityForm.jsx`, `lib/actions.js`의 `createActivity`)

원래는 `/dashboard/new`라는 별도 페이지였으나, "목록을 보려고 굳이 페이지를 오갈 필요가 있냐"는 피드백으로 별도 라우트를 없애고 `/dashboard`의 활동 목록 바로 아래에 같은 폼을 인라인으로 배치했다(목록 위 "+ 새 활동 만들기" 버튼은 그 자리로 스크롤만 이동하는 앵커 링크). `createActivity`는 그대로 성공 시 새 활동의 상세 페이지로 리다이렉트한다.

교사가 글쓰기 활동을 만들 수 있는 차시 자체가 많지 않다는 점을 고려해, 입력 항목을 최소화한다. 처음엔 학년/글의 종류를 칩으로 고르는 방식이었으나, 디자인 레퍼런스(`design-reference/디노 교사화면.png`)를 반영해 **실제 교육과정 단원 카드**를 고르는 방식으로 교체됐다. **AI가 활동 내용을 자동 생성하는 기능은 없다** — AI는 오직 학생 코칭 피드백에만 쓰인다(의도적 결정).

- **6학년 1학기 국어 단원 선택**(`lib/curriculum.js`의 `GRADE6_SEMESTER1_UNITS`) — 1/2/4/5/6/7/8/9단원(3단원은 글쓰기 활동이 없어 제외) 중 아이콘이 붙은 카드로 선택. 단원마다 장르(`genre`)와 권장 글자 수가 미리 정해져 있어, 카드를 고르면 목표 글자 수가 그 값으로 자동 이동한다.
- **오늘의 주제**(선택, 폼 필드명 `topic`) — 비워두면 학생이 자유 주제로 씀. 서버가 `title = "{단원의 글의 종류} - {소재}"`(소재가 없으면 글의 종류만)로 자동 조립하고, `topic` 컬럼엔 입력값을 그대로 저장.
- **학생에게 안내할 말**(선택, `instructions` 컬럼) — 비워두면 별도 안내 없이 글쓰기 시작. 학생 참여/글쓰기 화면 상단에 안내 배너로 표시됨(5·6번 항목 참고).
- **목표 글자 수** — 프리셋 버튼 그리드(200/400/600/800/1000자 + 직접 입력), 단원 선택 시 권장값으로 자동 이동하되 이후 자유롭게 변경 가능.
- 참여 코드는 서버가 자동 생성(`lib/joinCode.js`): 혼동되는 문자(0/O, 1/I/L) 제외한 32종 문자로 6자리, 충돌 시 최대 5회 재시도.
- 생성 성공 시 `/dashboard/[activityId]`로 이동.
- 2022 교육과정 성취기준 선택이나 활동 내용 자동 생성은 여전히 없음 — 전체 교육과정 데이터를 구조화하는 범위가 너무 커서 제외, 지금은 6학년 1학기 국어 한 학기 분량의 단원만 고정 데이터로 제공.

---

## 4. 교사 — 활동 상세 (`/dashboard/[activityId]`)

- 소유자 확인: 로그인한 교사의 활동이 아니면 404.
- 제목 아래 소재/목표 글자 수/학년/글의 종류를 한 줄로 표시.
- 참여 코드, 참여 링크(`/join/{joinCode}`), 그리고 그 링크의 **QR코드**(`qrcode.react`)를 표시 — 학생이 코드를 타이핑하지 않고 스캔만으로 입장할 수 있게 하기 위함.
- 참여 학생 목록: 이름, 도달도, 코칭 받은 횟수. 각 항목은 `/dashboard/[activityId]/students/[submissionId]`(수정 진행 대시보드)로 가는 링크.

---

## 4-1. 교사 — 학생 글쓰기 수정 진행 대시보드 (`/dashboard/[activityId]/students/[submissionId]`, PRD 2.6)

`design-reference/학생 글쓰기 수정 진행 대시보드.png`를 반영해 2026-08-01에 재설계됨. 설계 문서는 `docs/superpowers/specs/2026-08-01-revision-board-design.md`. 저장된 라운드 데이터만 그리므로 **DB 스키마·Gemini 프롬프트·평가 파이프라인과 무관**하다.

- 소유자 확인: 로그인한 교사가 만든 활동의 학생이 아니면 404.
- **헤더**: 이 페이지만 `TeacherHeader`를 안 쓰고 직접 조립한다 — 뒤로가기(`← 학생 목록으로 돌아가기`)와 이메일/로그아웃(`components/SignOutButton.jsx`) 줄 아래에, 왼쪽은 학생 이름 + 학년 배지 + `{장르} 쓰기 · 총 N회 수정`, 오른쪽은 도달도 카드(`lib/mascot.js`의 표정 + 진행 막대). `TeacherHeader`가 이메일에 쓰는 자리를 도달도 카드가 가져가기 때문.
- **라운드 카드**(`components/RevisionBoard.jsx`, Server Component): 가로로 나란히 배치되고 카드 사이에 `›`가 들어간다. 카드 폭 325px 고정으로 `.container-widest`(1440px) 안에 **4개가 스크롤 없이** 들어오고, 더 많으면 가로 스크롤(`tabIndex={0}`이라 키보드로도 스크롤됨). 카드 한 장의 구성:
  - 제목 `N차 수정 (도달도%)` — **1부터 센다.** 첫 코칭 라운드가 "1차 수정"이고 `초안` 배지가, 마지막 라운드엔 `최근` 배지와 초록 테두리가 붙는다. 완료를 뜻하는 "최종"은 쓰지 않는다(6-1의 "완료 상태가 없다" 참고, `infiniteCoachingUi.test.js`가 소스에서 막음).
  - **📋 채점기준표** — 면담 보고서일 때만. `lib/curriculum.js`의 기준 7개를 루브릭 순서대로 놓고 `round.assessments`의 판정을 `○`(met) `△`(partial) `✕`(unmet)로, 직전 라운드 같은 기준과 비교한 변화를 `–`(변화 없음) `↑`(향상) `▼`(하락)로 보여준다. 첫 카드는 변화 칸이 빈다. 표에 들어갈 짧은 라벨은 기준마다 `shortLabel`로 추가됨(프롬프트가 쓰는 `label`은 그대로).
  - **✏️ 수정 미션** — 그 라운드가 낸 미션 2개에, **다음** 라운드가 내린 판정(✅ 고쳤어요 / 🔄 고치는 중 / ❌ 아직)을 붙인다. 아직 아무도 판정하지 않은 최신 라운드는 앰버 박스로 표시되고 마크가 없다.
  - **📝 글 내용** — 직전 라운드 대비 `diffWords` 강조(파랑 밑줄=추가, 빨강 취소선=삭제). 글 본문은 **잘리거나 내부 스크롤되지 않고 전체가 그대로 표시**된다.
  - 하단에 글자 수. 무의미/욕설로 플래그된 라운드는 채점기준표·미션 대신 경고 배지만 나온다.
- **하단 안내 바**: 채점기준표 상태 / 변화 표시 / 수정 미션 / 글 표시(diff) 범례. 채점기준표 관련 두 묶음은 루브릭이 있는 장르에서만 나온다.
- **비(非)면담 보고서 장르**도 같은 보드를 쓴다 — `round.assessments`가 없어 채점기준표 섹션과 그 범례만 빠지고 미션·diff·글자 수는 그대로.
- 아직 코칭을 안 받았으면 "아직 코칭을 받지 않았어요" 안내와 함께 현재까지 쓴 글만 보여줌.
- 화면에 그리는 값은 `lib/revisionBoard.js`의 순수 함수(`getRubricRows` / `getTrend` / `getMissionRows`)가 만들고 Vitest로 검증된다.
- **학생 화면은 그대로** — `components/RevisionHistory.jsx`는 이제 학생 글쓰기 화면 전용이다(세로로 쌓이고 `이전 버전 다시 보기` 토글 안에 들어감). 교사 화면이 쓰던 `layout="horizontal"` 분기는 제거됐고, 학생 화면은 같은 라운드를 여전히 "초안 / N차 수정"이라 부른다(대상이 달라 일부러 어긋나게 둠).
- **화면 폭**: 교사 화면은 학생용 좁은 폭(`.container`, 700px)과 별도로 두 단계 더 넓은 컨테이너를 씀 — 대시보드/활동생성/활동상세는 `.container-wide`(1100px), 카드 비교가 핵심인 이 페이지만 더 넓은 `.container-widest`(1440px). 데스크톱에서 여유 있게 보려는 사용자 피드백. 활동 생성 폼과 참여 코드/QR 카드는 넓은 컨테이너 안에서도 각각 `max-width`를 둬 과하게 늘어나지 않게 함.

---

## 5. 학생 — 참여 (`/join/[joinCode]`, `lib/actions.js`의 `joinActivity`)

- 존재하지 않는 참여 코드로 접근하면 404.
- 이름을 입력하면 `(activityId, studentName)` 조합으로 Submission을 찾거나 새로 생성(upsert) → `/write/[submissionId]`로 이동.
- 같은 이름으로 다시 들어오면 기존 글/코칭 기록을 그대로 이어서 볼 수 있음 — 별도의 로그인이나 브라우저 저장 없이 DB의 이름 조합 자체가 복귀 키 역할을 한다.
- 이름 미입력 등 검증 실패 시 같은 화면에 에러 메시지 표시(`useActionState` 사용).

---

## 6. 학생 — 글쓰기·코칭 (`/write/[submissionId]`, `components/WritingScreen.jsx`)

기존 단일 화면 앱의 핵심 로직(글자 수 진행 바, 도달도 게이지, 코칭 흐름, 퇴고 히스토리, diff 강조)을 그대로 옮기고, 저장 위치만 localStorage → DB로 바꿨다. 화면 레이아웃은 디자인 레퍼런스(`design-reference/디노 학생화면.png`)를 반영해 한 차례 리디자인됐다(아래 "화면 레이아웃" 항목 참고).

### 화면 레이아웃 (헤더 / 주제 카드 / 좌우 분할 워크스페이스)
- 헤더: "🦕 디노 글쓰기 코치" 타이틀 + 학생 이름 배지(`.student-badge`).
- 활동에 `instructions`(교사가 입력한 안내 말)가 있으면 헤더 아래 배너(`.instructions-banner`)로 표시.
- 주제 카드(`.topic-card`): 오늘의 주제 + "나의 글 도달도" 진행 트랙을 한 카드에 나란히 표시. 진행 트랙 위에는 도달도 값 위치에 맞춰 좌우로 움직이는 디노 마스코트(`lib/mascot.js`의 `getMascotState`, `public/dino/face-*.png` 4종 표정)가 말풍선으로 격려 메시지를 보여준다.
- 그 아래는 "내가 쓴 글"(`.write-panel`)과 "디노의 피드백"(`.feedback-panel`)이 좌우로 나란히 배치된 워크스페이스(`.write-workspace`, 좁은 화면에서는 세로로 쌓임).

### 글자 수 진행 바
- 목표 글자 수는 **활동마다 교사가 정한 값**(`activity.targetLength`) — 이전의 400자 고정 상수는 제거됨.
- 1회차 코칭 버튼은 목표 글자 수 미만이면 비활성화. 2회차 이후에는 이 조건이 사라짐(로직 동일).

### 도달도 게이지 (`lib/attainment.js`)
- `computeNextAttainment`: 1회차는 무조건 40%(`ATTAINMENT_START`). 이후 라운드는 직전 미션 2개 중 고친 개수 × 10%(`ATTAINMENT_PER_POINT`)를 더함. 감소 없음, **상한 없음**. 계산 로직은 순수 함수로 분리되어 Vitest로 테스트됨.
- 화면에서는 막대 **너비만** `Math.min(attainment, 100)`으로 잘리고 숫자는 상한 없이 표시된다. 100%를 넘어도 완성/종료로 표현하지 않는다.
- `computeRubricAttainment`(루브릭 충족률 백분율)는 **학생 도달도와 무관하다** — 면담 보고서 라운드의 `actualAttainment`로만 저장되는 교사 분석용 값이다.

### AI 코칭 (`lib/coaching.js`, Server Action `requestCoaching`)
- 모델은 `gemini-2.5-flash-lite`. 장르에 따라 **두 갈래**로 갈린다 — 면담 보고서는 루브릭 기반 2단계 파이프라인(`getInterviewReportFeedback`, 6-1번 항목), 나머지 장르는 아래의 기존 단일 호출 코칭(`getGeminiFeedback`).
- 프롬프트/스키마는 기존 `api/coach.js`와 동일(디노 페르소나, 1회차 vs 재코칭 분기, Gemini `responseSchema` 구조화 출력).
- 서버 측에서 활동의 `topic`을 불러와 프롬프트에 사용(학생이 주제를 직접 입력하지 않음 — 교사가 활동 생성 시 정한 소재를 그대로 씀).
- **장르별 코칭 지침 추가**: 활동의 `genre`에 맞는 한 줄 지침(`lib/curriculum.js`의 `GENRE_COACHING_GUIDANCE`)이 프롬프트 끝에 덧붙여짐(예: "주장하는 글"이면 "주장이 분명한지, 근거가 있는지도 함께 봐줘." 추가). 실제 Gemini 호출로 검증됨 — 장르를 반영한 피드백이 나오는 것 확인.
- 1회차 진입 시 목표 글자 수 미달이면 서버에서도 방어적으로 거부(클라이언트 버튼 비활성화와 별개의 서버측 검증).
- 결과는 Submission 행에 즉시 반영(feedback/attainment/rounds 갱신) — 별도 API 라우트 없이 Server Action이 DB에 직접 기록.

### 자동 저장
- `writing` 변경 800ms 후 debounce로 `saveDraft` Server Action 호출(첫 렌더링 시에는 저장하지 않도록 skip 처리).
- 코칭 시점에도 그 시점의 `writing`이 함께 저장됨.

### 제출하기 기능은 넣었다가 제거함 (PRD 1.6)
- Phase 1에서 "제출하기" 버튼(상태 draft/submitted, 제출 시각/스냅샷 기록)을 구현했었으나, Phase 2에서 교사가 언제든 성장 과정 화면(4-1번 항목)으로 모든 학생의 글을 볼 수 있게 되면서 "제출"이라는 별도 이벤트의 실익이 없다고 판단해 통째로 제거함(버튼, 서버 액션, DB 컬럼 모두 삭제). 학생은 그냥 계속 쓰고 코칭받으면 되고, 교사는 아무 때나 들여다보면 된다.

### 퇴고 히스토리 & diff 강조
- 로직/마크업 100% 동일하게 이식: 라운드별 "초안/N차 수정" 카드, 지난 미션 반영 여부 ✅/❌, `diffWords` 기반 추가(파랑 밑줄)/삭제(빨강 취소선) 강조.

### 무의미한 글 / 스페이스 도배 감지 가드 (`lib/guard.js` + `lib/coaching.js`의 `meaningless` 판단)
- `requestCoaching`이 목표 글자 수 체크 다음, Gemini 호출 전에 `checkGuard(writing)`을 실행. 감지 신호: (1) 한글 호환 자모 8자 이상 연속 또는 같은 글자 12회 이상 반복(공백 하나 끼워도 감지), (2) 공백 비율 50% 이상 또는 전체 자모 비율 30% 이상(20자 이상일 때만 적용, 스페이스바로 글자 수만 채우는 경우 대비).
- 규칙을 통과해 Gemini가 호출되면, 코칭 응답 스키마의 `meaningless` 필드로 AI가 한 번 더 판단(추가 API 호출 없음) — 규칙이 놓치는 회피 패턴(공백 섞기, 영문 키보드 낙서 등)을 잡는 2차 안전망.
- 둘 중 하나라도 걸리면 Gemini 호출 없이(규칙) 또는 이미 받은 응답으로(AI) 즉시 도달도를 0으로 강제(이전 값 무시) + 학생 화면에 초록 코칭 카드 대신 빨간 경고 카드 표시. `lastSubmittedWriting`/`lastImprovements`는 갱신하지 않아 다음 정상 제출은 마지막 정상 글 기준으로 비교됨.
- 교사 수정 진행 대시보드(`RevisionBoard.jsx`)에도 플래그된 라운드는 배지로 별도 표시되고, 그 카드에서는 채점기준표·미션이 빠진다.

### 욕설/비속어 감지 + 교사 승인(O/X) 큐 (`lib/profanity.js`, `resolveProfanityReview`)
- 위 가드와 달리 오탐 위험이 있어 자동으로 점수를 깎지 않음. `containsProfanity(writing)`이 걸리면 Gemini 호출 없이 `feedback = { pending: true, reason: 'profanity' }` 상태로 저장 — 학생은 노란 "선생님이 확인하고 있어요" 카드를 보고, 해당 라운드에 대해 다시 코칭을 요청할 수 없음(버튼 비활성화, 서버에서도 재요청 차단).
- 교사는 로그인 시 대시보드 상단 배너("⏳ 검토가 필요한 글이 N개 있어요", 전체 활동 통합) 또는 활동별 로스터의 "⏳ 검토 필요" 배지로 발견하고, 학생 상세 페이지의 `ProfanityReviewPanel`에서 원문을 보고 승인/반려를 결정.
- **승인**: 그제서야 실제 Gemini 코칭이 진행되고 정상 라운드로 집계됨(도달도 정상 계산).
- **반려**: 점수는 변동 없이(반려 시점의 도달도 그대로 유지) 히스토리에 "부적절한 표현으로 반려됨" 기록만 남기고, 학생은 다시 써서 제출해야 함.
- 스키마 변경 없음 — 기존 `Submission.feedback`/`rounds` JSON 필드만 재사용.

---

## 6-1. 면담 보고서 — 루브릭 기반 무한 코칭 (파일럿)

Phase 3(루브릭)을 교사가 표/이미지를 업로드하는 범용 기능으로 만들기 전에, **"면담 보고서" 한 장르에 루브릭을 코드로 고정해 넣어 코칭 품질을 먼저 검증**하는 파일럿. 활동의 `genre`가 `면담 보고서`(`INTERVIEW_REPORT_GENRE`)일 때만 이 경로를 탄다.

### 고정 루브릭 (`lib/curriculum.js`)

교사 업로드가 아니라 **코드 상수**다. 루브릭 3개 / 채점기준 7개:

| 루브릭 | 채점기준 |
|---|---|
| 면담의 목적과 대상이 분명하게 드러난다 | `purpose`(면담 목적), `interviewee`(면담 대상자) |
| 면담을 통해 얻은 정보를 구체적으로 전달한다 | `new-fact`(새로 알게 된 사실), `fact-detail`(사실의 이유·과정·상황) |
| 면담 보고서의 짜임에 맞게 구성한다 | `opening`(앞부분), `body`(가운데), `closing`(뒷부분 느낀 점) |

각 기준은 `met`/`partial`/`unmet` 판정 문구, 미션 생성용 지시문(`missionSeed`), 우선순위(`priority`)를 갖는다.

### 2단계 Gemini 파이프라인 (`lib/coaching.js`)

판정과 미션 생성을 **한 번에 시키지 않는다** — 같이 시키면 판정이 미션에 끌려가 허위 충족이 생겼다.

1. **판정** — `buildInterviewAssessmentPrompt` → 7개 기준을 각각 met/partial/unmet으로 판정 (`INTERVIEW_ASSESSMENT_SCHEMA`). `normalizeInterviewAssessment` / `validateInterviewAssessment`로 검증.
   - **글이 한 글자도 안 바뀌었으면 이 호출을 건너뛰고 직전 라운드의 판정을 그대로 쓴다.** 판정 호출은 `temperature: 0`이지만 프롬프트가 변화 맥락(`previousWriting`, `changes`, 지난 미션)까지 함께 받아서, 같은 글도 이력이 달라지면 판정이 흔들렸다 — 2026-08-02 실측에서 동일한 267자 글이 `body` partial→met, `closing` partial→unmet으로 뒤집혀 교사 보드에 있지도 않은 향상 ↑ / 하락 ▼ 화살표가 떴다. 바로 아래 지난 미션을 `not-done`으로 확정하는 것과 같은 처리이고, 라운드당 Gemini 호출도 한 번 줄어든다.
2. **미션 생성** — `buildInterviewMissionPrompt` → 선택된 대상에 맞는 수정미션 2개 생성 (`INTERVIEW_MISSION_SCHEMA`). `sanitizeInterviewMissionResult` / `validateInterviewMissionResult`가 막연한 조언, 복사 가능한 모범 문장, 학생 글에 없는 사실, 미션 개수 불일치를 걸러내고 `buildRetryPrompt`로 재시도시킨다.

미션 제목은 `~하기` 형태이고, 설명에는 학생이 손댈 위치와 실행 동작이 들어가야 한다.

### 수정 대상 선택은 코드가 한다 (`lib/missions.js`)

`selectMissionTargets`가 **AI가 아니라 결정론적 규칙으로** 어느 기준을 고칠지 고른다.

- `unmet` → `partial` → `priority` 순으로 정렬. 최근 **두 라운드 연속**으로 나온 대상은 뒤로 미룬다.
- 짝지어 다뤄야 자연스러운 기준은 하나로 병합한다: `new-fact`+`fact-detail`, `purpose`+`interviewee`.
- 상위 기준이 `unmet`이면 종속 기준을 후보에서 뺀다 (`new-fact`가 unmet이면 `body` 제외, `purpose`·`interviewee`가 둘 다 unmet이면 `opening` 제외).
- **모든 기준이 `met`이어도** `REFINEMENT_SEEDS`로 "이미 갖춘 것을 한 단계 더 다듬는" 대상을 채워 **항상 정확히 2개**를 반환한다.

### 라운드 저장 (`lib/interviewRound.js`)

`buildInterviewRoundState`가 라운드마다 `writing`, `strength`, `missions`, `assessments`, `priorMissionStatuses`, `actualAttainment`(루브릭 백분율), `attainmentAfter`(학생 도달도)를 쌓는다. 직전 미션 판정에서 `status === 'done'`인 개수만 세어 `computeNextAttainment`로 넘긴다.

### 완료 상태가 없다

`complete`, "완성", "완벽", "모든 기준 충족으로 종료" 같은 **제품 상태를 쓰지 않는다.** 루브릭은 글의 완성을 판정하는 종료 조건이 아니라 다음 수정 행동 두 개를 고르는 진단 도구다. 루브릭 완료 축하 박스와 `complete` 분기는 UI·영속화·스코어링 전부에서 제거됐고, 100% 이상에서는 마스코트 문구도 완성이 아니라 계속 성장하는 표현을 쓴다.

### 프롬프트 평가 루프 (`evals/`, `scripts/eval-interview-report.js`, `lib/interviewEval.js`)

`npm run eval -- --set dev --runs 3` / `--set validation --runs 1`로 **Gemini를 실제 호출해** 프롬프트 품질을 측정한다(비용 발생). 게이트: 판정 일치율(개발셋 90%+, 검증셋 85%+), 스키마 100%, 미션 2개 생성률 100%, 종료 상태 0건, 허위 충족·논리 모순 0건. 결과는 `.eval-results/interview-report/`에 남는다.

---

## 7. 보안 / 키 관리

- Gemini API 키는 여전히 서버 환경변수(`GEMINI_API_KEY`)에만 존재, 브라우저에 노출되지 않음(기존과 동일).
- Google OAuth 클라이언트 시크릿(`AUTH_GOOGLE_SECRET`), 세션 서명 비밀(`AUTH_SECRET`)도 Vercel 환경변수로만 존재.
- DB 접속 정보(`DATABASE_URL` 등)는 Neon 마켓플레이스 통합이 자동 관리, 코드에는 등장하지 않음.

---

## 8. 알려진 제약 / 미구현 영역

- **교사의 루브릭 업로드/파싱 없음** — 루브릭은 면담 보고서 한 장르에 코드 상수로 고정되어 있다(6-1번 항목). 표/이미지 업로드와 AI 파싱, 교사가 고르는 피드백 우선순위는 파일럿 결과를 보고 결정한다.
- **면담 보고서 파일럿의 라이브 평가 미실행** — 자동 테스트는 통과하지만 `npm run eval`(Gemini 실호출)을 아직 돌리지 않아 `.eval-results/`가 없다.
- **면담 보고서 파일럿은 프로덕션에 없다** — `master`에는 있지만 배포본은 `3ec2c40`(2026-07-28 확인) 시점이다.
- **디노 캐릭터 애니메이션 없음** (정적 이미지만 있음)
- **성취기준 선택/AI 기반 활동 자동 생성 없음(의도적 제외)** — 6학년 1학기 국어 단원은 카드로 고를 수 있지만, 전체 2022 교육과정 성취기준 데이터를 구조화하는 건 범위가 너무 커서 하지 않기로 결정. AI가 활동 제목/소재를 대신 생성하는 기능도 의도적으로 넣지 않음(AI는 학생 코칭에만 사용).
- **복붙(카피/페이스트) 탐지 없음** — 브라우저 붙여넣기 이벤트 감지가 필요해 범위에서 제외하기로 확정. 자모 반복/스페이스 도배/욕설·비속어 감지는 모두 구현됨(6번 항목 참고).
- **참여 학생 목록 필터/정렬 없음** — 이름순 등 정렬이나 검색 기능은 아직 없음
- **"제출" 개념 자체가 없음(의도적 제거)** — Phase 1에서 구현했다가 Phase 2 이후 제거함(6번 항목 참고). 학생은 언제든 계속 쓰고 코칭받을 뿐, 별도의 제출 이벤트는 없음.
- **100% 이후 특별 연출 없음** — 축하 연출은 의도적으로 넣지 않는다. 코칭에 종료가 없다는 원칙상 100%는 도착점이 아니며, 마스코트 문구만 계속 성장하는 표현으로 이어진다.
- **정식 UI/E2E 테스트 스위트 없음** — Vitest 유닛테스트는 이번에 도입됐지만(순수 로직 한정), UI 흐름 검증은 여전히 임시 Playwright 스크립트 관례. 실제 Google OAuth 로그인 자체는 여전히 자동화하지 않지만(구글의 자동화 방지 정책), 로컬 전용 `lib/devLogin.js`(6번 항목 참고)로 교사 로그인이 필요한 나머지 모든 흐름은 이제 Playwright로 자동 검증 가능.
