# 디노 글쓰기 코치 — 프로젝트 현황

> 이 문서는 세션이 끝날 때마다 갱신되는 "현재 상태 스냅샷"입니다. 다음 세션은 이 문서에서 시작하세요.
> 기능 자체의 구체적인 구현 스펙은 [`FEATURES.md`](FEATURES.md)를 참고하세요.

**마지막 갱신:** 2026-07-15 (다른 세션에서 진행된 단원 카드/마스코트 리디자인 커밋 4건이 문서화되지 않은 채 origin에 push·배포까지 끝나 있던 것을 발견 → 이어서 이번 세션이 나머지 교사/학생 화면 디자인을 통일하고, 두 작업을 함께 문서에 반영)
**최신 커밋:** 기능/코드 기준 최신은 `b1a4f97`이며, 이 문서 갱신을 담은 커밋이 그 위에 하나 더 있음 (**주의: 이번 세션 커밋 2건은 아직 GitHub에 push 안 됨** — origin은 `950e4f3`까지만 반영됨. `git log origin/master..HEAD`로 확인)
**GitHub 저장소:** https://github.com/skyang9838-hue/dino-writing-coach (public)
**배포 주소:** https://dino-writing-coach.vercel.app (Next.js 교실 플랫폼 버전 배포 중 — `950e4f3`까지 반영, 그 이후 로컬 커밋은 미배포)

**⚠️ 커밋/배포 방침 (2026-07-11 확정):** 작업 완료 시 **로컬 커밋까지만** 하고, GitHub push/Vercel 배포는 사용자가 명시적으로 요청할 때만 진행. 자동으로 배포하지 말 것.

## 방향 전환: 교사-학생 역할 분리 플랫폼으로 재설계

사용자가 최종 PRD(교사는 활동을 만들고 평가하며, 학생은 활동에 참여해 글을 쓰고 AI 코칭을 받는 교실용 서비스)를 제시함에 따라, 기존의 "무계정 개인용 SPA"에서 "교사/학생 다중 사용자 + DB + 인증" 구조로 아키텍처를 전환하는 작업을 시작했다. 전체 작업을 4단계 로드맵으로 나눴고, 이번 세션은 **Phase 1(기반 인프라 + 핵심 학생/교사 루프)**을 구현했다.

## Phase 1 — 완료된 작업

**아키텍처 전환**
- Vite + React SPA → **Next.js 16 (App Router)**로 마이그레이션. 기존 `src/`, `api/coach.js`, `vite.config.js`, `index.html`은 모두 제거하고 로직을 이식함.
- **Vercel Postgres(Neon)** 마켓플레이스 통합 설치, `DATABASE_URL`/`DATABASE_URL_UNPOOLED` 등 자동 프로비저닝.
- **Prisma 7** 도입. 주의: Prisma 7부터 `schema.prisma`의 `datasource` 블록에 `url`/`directUrl`을 직접 쓸 수 없고, 대신 프로젝트 루트의 `prisma.config.js`에서 마이그레이션용 연결(직접 연결 `DATABASE_URL_UNPOOLED`)을 지정한다. 런타임 연결은 `PrismaClient({ adapter })` 형태로 드라이버 어댑터를 통해서만 가능 — 이 프로젝트는 `@prisma/adapter-pg` + `pg`를 사용(Vercel의 Node.js 런타임이므로 `@neondatabase/serverless`의 WebSocket 방식 대신 표준 TCP 어댑터를 선택; Neon 서버리스 드라이버는 이 조합에서 `channel_binding` 관련 오류가 발생해 표준 `pg`로 전환함).
- **Prisma Client 생성 방식 변경**: `generator client { provider = "prisma-client" }`로 지정하면 `.ts` 소스로 `generated/prisma/`에 생성됨(더 이상 `node_modules`가 기본 위치가 아님). 이 프로젝트는 순수 JS였지만, 생성된 클라이언트가 `.ts`라서 **`typescript` 패키지를 devDependency로 추가**해야 Next.js 빌드가 통과함(직접 TS 코드를 작성하는 건 아님). import 시 확장자는 `.js`가 아니라 실제 파일 확장자인 `.ts`를 그대로 써야 함(예: `from '../generated/prisma/client.ts'`) — Next.js/Turbopack이 `.js` 지정자를 `.ts` 파일로 자동 치환해주지 않았음.
- `generated/`, `.next`는 `.gitignore`에 추가(재생성 가능한 산출물). `vercel integration add neon` 실행 시 부수적으로 생성된 `.claude/`(로컬 스킬 심볼릭 링크), `.agents/`, `skills-lock.json`도 `.gitignore`에 추가함(앱 코드가 아닌 로컬 AI 툴링 상태).

**인증**
- **Auth.js(NextAuth) v5 + Google Provider**로 교사 로그인 구현. 세션 저장은 `@auth/prisma-adapter`로 DB에 저장(`session: { strategy: 'database' }`).
- 학생은 계정 없이 **이름 입력 + 참여 코드**로만 참여(가벼운 방식, 사용자가 명시적으로 선택).
- 환경변수 `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`/`AUTH_SECRET`을 Vercel에 development/preview/production 전체 등록 완료. Google Cloud Console에서 사용자가 직접 OAuth 클라이언트를 생성(승인된 리디렉션 URI: `/api/auth/callback/google` for localhost:3000 및 배포 도메인).

**데이터 모델** (`prisma/schema.prisma`)
- `User`(=교사, Auth.js 표준 모델 재사용) / `Account` / `Session` / `VerificationToken` — Auth.js 표준 스키마
- `Activity` — 교사가 만드는 글쓰기 활동(제목/주제/목표 글자 수/참여 코드)
- `Submission` — 학생 1명의 활동 참여 기록. 기존 `sessionStorage.js`가 다루던 필드(`writing`/`feedback`/`attainment`/`rounds`/`lastSubmittedWriting`/`lastImprovements`)를 거의 그대로 컬럼으로 이전. (이때 함께 추가했던 `status`/`submittedWriting`/`submittedAt`는 이후 제거됨 — 아래 "제출하기 기능 제거" 항목 참고.)

**교사 화면**
- `/login` — Google 로그인
- `/dashboard` — 내 활동 목록 (참여 학생 수 표시)
- `/dashboard/new` — 활동 생성 폼(학년/글의 종류 칩 선택, 소재 입력, 목표 글자 수 드롭다운 — 아래 "추가 개선" 항목 참고)
- `/dashboard/[activityId]` — 참여 코드 + 참여 링크 + **QR코드**(`qrcode.react`, 학생이 타이핑 없이 스캔으로 입장 가능) + 참여 학생 목록(도달도/코칭 횟수 — 원래 Phase 2 예정이었으나 데이터가 이미 있어 최소 형태로 함께 구현함)

**학생 화면**
- `/join/[joinCode]` — 이름 입력 → 기존 참여자면 기존 글로 복귀, 신규면 새 Submission 생성 (localStorage 불필요 — DB의 `(activityId, studentName)` unique 조합이 곧 복귀 키)
- `/write/[submissionId]` — 기존 `App.jsx`의 코칭/도달도/퇴고 히스토리/diff 로직을 서버 연동으로 이식. 목표 글자 수는 활동의 `targetLength`(교사가 정함, 기존 400자 고정 상수 제거). (당시엔 제출하기 버튼도 추가했으나 이후 제거됨 — 아래 항목 참고.)
- 자동저장: `writing` 변경 800ms 후 서버에 draft 저장(디바운스). 코칭 시점에도 저장됨.

**서버 로직 (`lib/`)**
- `lib/coaching.js` — 기존 `api/coach.js`의 프롬프트 빌더/스키마/Gemini 호출 로직을 그대로 이식(디노 페르소나, 1회차/재코칭 분기 동일)
- `lib/attainment.js` — 도달도 계산 순수 함수로 분리(40% 시작, 보완점 개수×10%, 상한 없음 — 로직 동일)
- `lib/joinCode.js` — 참여 코드 생성(혼동되는 문자 0/O/1/I/L 제외한 6자리)
- `lib/actions.js` — Next.js **Server Actions**로 구현(활동 생성, 참여, 초안 저장, 코칭 요청, 제출). REST API 라우트 대신 Server Actions를 쓴 것은 원래 계획에서의 구현 세부사항 변경 — Next.js 공식 가이드가 "UI에서 트리거되는 변경은 Server Actions를 쓰라"고 명시하기 때문. 동작/데이터 모델은 계획과 동일.

**테스트**
- 이번 전환부터 **Vitest 유닛테스트 도입**(`lib/*.test.js`): 도달도 계산, 참여 코드 생성 규칙, 코칭 프롬프트 빌더 — 9개 테스트 모두 통과.
- 학생측 흐름(참여→글쓰기→코칭 2회→히스토리→제출→새로고침 복구)은 Playwright 스크립트로 자동 검증 완료(스크립트는 검증 후 삭제, 프로젝트 관례 유지).
- **교사측(Google 로그인) 흐름은 자동화하지 않음** — 실제 Google OAuth 로그인은 자동화 스크립트로 안전하게 재현하기 어려워(구글의 자동화 방지 정책), 사용자가 브라우저에서 직접 한 번 확인하는 방식으로 검증함.
- 발견 후 수정한 버그 1건: 제출 시각(`submittedAt`)을 `toLocaleString('ko-KR')`로 표시할 때 서버(Node ICU)와 브라우저의 오전/오후·AM/PM 표기가 달라 하이드레이션 에러 발생 → 마운트 후에만 클라이언트에서 포맷하도록 수정.

## Phase 1 완료 후 추가 개선 — 활동 생성 폼 (학년/글의 종류/소재)

Phase 1 완료 후 사용자가 실제로 로그인/활동 생성을 테스트해보고 두 차례 피드백을 줘서 즉시 반영했다.

1. **1차 피드백**: 활동 생성 화면에 학년·글의 종류를 고를 수 있게 해달라는 요청(PRD 2.1 "자동 생성" 아이디어에서 착안). 논의 끝에 **AI 기반 자동 생성은 하지 않기로 결정**(AI는 학생 코칭에만 사용) — 대신 학년/글의 종류를 드롭다운으로 추가하고, 학년은 목표 글자 수 권장값에, 글의 종류는 AI 코칭 프롬프트의 장르별 지침에 반영하기로 함. 성취기준까지 구조화하는 것은 전체 교육과정 데이터가 필요해 범위 초과로 제외.
2. **2차 피드백**: 실제 폼을 보고 "드롭다운 말고 칩(버튼)형으로, 활동 제목/주제는 소재 하나로 통합, 글자 수는 드롭다운으로" 요청 → 폼을 다시 다음과 같이 수정:
   - 학년/글의 종류: `<select>` → 클릭형 칩 버튼(`components/NewActivityForm.jsx`의 `ChipGroup`)
   - 제목+주제 두 입력칸 → **소재** 하나로 통합(`material` 필드). 활동 제목은 서버에서 `"{글의 종류} - {소재}"`로 자동 조립(`lib/actions.js`의 `createActivity`), `topic` 컬럼엔 소재 값을 그대로 저장.
   - 목표 글자 수: 자유 숫자 입력 → 드롭다운(`lib/curriculum.js`의 `LENGTH_OPTIONS`, 100~800자). 학년 칩을 누르면 권장값으로 자동 이동.
3. `lib/curriculum.js` 신규: `GRADES`(학년별 권장 글자 수 포함)/`GENRES`/`GENRE_COACHING_GUIDANCE`/`LENGTH_OPTIONS`. `lib/coaching.js`의 프롬프트 빌더가 `genre`를 받아 장르별 지침을 프롬프트 끝에 덧붙이도록 확장됨 — **실제 Gemini 호출로 검증**: "주장하는 글"로 설정한 활동에서 AI가 실제로 "근거를 더 써달라"는 식으로 피드백을 준 것을 확인함.
4. Vitest 8개 테스트 추가(`lib/curriculum.test.js`, `lib/coaching.test.js` 장르 케이스) — 전체 17개 테스트 통과. 프로덕션 빌드도 통과.
5. Prisma 마이그레이션 1건 추가(`Activity.grade`, `Activity.genre` 컬럼, 기본값 각각 `"초3-4학년군"`/`"일기"`).

## Phase 2 — 교사: 학생별 성장 과정(diff) 보기

PRD 2.6 "성장 과정 확인" 구현. 새 인프라 없이 기존 학생 화면의 퇴고 히스토리를 재사용했다.

- `components/RevisionHistory.jsx` 신규 — `components/WritingScreen.jsx`(학생 화면)에 있던 히스토리 렌더링(라운드별 카드, `diffWords` 강조, 지난 미션 반영 체크)을 그대로 뽑아낸 순수 표시 컴포넌트. 학생 화면은 여전히 토글(`이전 버전 다시 보기`)로 감싸서 쓰고, 교사 화면은 토글 없이 바로 펼쳐서 보여줌 — 로직은 100% 동일, 감싸는 쪽만 다름.
- `/dashboard/[activityId]/students/[submissionId]` 신규(교사 전용, 소유권 확인 포함) — 학생 이름/도달도/코칭 횟수 헤더 + `RevisionHistory`. 아직 코칭을 안 받은 학생은 현재 글만 보여줌.
- `/dashboard/[activityId]`의 참여 학생 목록 각 항목이 이 페이지로 가는 링크가 됨.
- Playwright로 리팩터링 회귀 확인: 학생 화면에서 코칭 2회 진행 후 히스토리 토글 펼침/접힘, diff 강조(`diff-added`/`diff-removed`)가 리팩터링 전과 동일하게 동작하는 것 확인. 교사 페이지 자체는 Google 로그인이 필요해 사용자가 직접 확인.

## 제출하기 기능 제거

Phase 2에서 교사가 성장 과정 화면으로 아무 때나 학생 글을 볼 수 있게 되자, 사용자가 "제출하기가 굳이 필요한가?"라고 문제 제기했다. "교사가 버튼 노출을 제어하게 할까?"도 논의했으나, 새 활동 단위 상태값과 교사용 제어 UI가 필요해 복잡도 대비 실익이 적다고 판단해 기각하고, **제출하기 기능 자체를 완전히 제거**하기로 결정(버튼/서버 액션/DB 컬럼 전부 삭제).

- `lib/actions.js`의 `submitWriting` 삭제.
- `components/WritingScreen.jsx`에서 제출 버튼, "제출 완료" 배지, 제출 시각 표시, 관련 state(`status`/`submittedAt`/`isSubmitting`/`submittedAtLabel`) 전부 삭제.
- `prisma/schema.prisma`의 `Submission.status`/`submittedWriting`/`submittedAt` 컬럼 삭제 + 마이그레이션 적용(`20260710215612_remove_submission_status`). 기존 테스트 데이터에 값이 남아있어 `migrate dev`가 비대화형 환경에서 확인을 요구해 실패했음 — `prisma migrate diff`로 SQL을 직접 뽑아 마이그레이션 파일을 만들고 `migrate deploy`로 적용하는 방식으로 우회함.
- 교사 화면(활동 상세, 학생 성장 과정 페이지)에서 "제출 완료/작성 중" 문구 제거, 도달도/코칭 횟수만 표시.
- Playwright로 회귀 확인: 제출 버튼/배지가 화면에 없는 것, 코칭·퇴고 히스토리는 여전히 정상 동작하는 것 확인.

## 교사 성장 과정 페이지 — 가로 레이아웃

사용자가 직접 써보고 "라운드가 늘어날수록 계속 스크롤해서 내려야 해서 초안부터 최근까지 한눈에 비교하기 어렵다"고 피드백. 라운드 카드를 세로 목록 대신 가로로 나란히 배치(카드 많으면 좌우 스크롤)하도록 변경.

- `components/RevisionHistory.jsx`에 `layout` prop 추가(`'vertical'`(기본, 학생 화면) | `'horizontal'`(교사 성장 과정 페이지)). 범례는 항상 위 고정, 라운드 카드들만 별도 `history-items` 래퍼로 감싸 가로 모드에서 `flex-direction: row` + `overflow-x: auto`로 전환.
- 가로 모드에서 카드 폭 고정(처음 260px → 420px로 확대, 아래 항목에서 최종 확정). 글 본문의 세로 스크롤(`max-height`)은 이후 사용자 피드백으로 완전히 제거함(다음 항목 참고) — `.history-items`가 flexbox 기본 동작(`align-items: stretch`)으로 한 줄 안의 카드 높이를 가장 긴 카드에 맞춰 자동으로 통일해주므로, 텍스트를 자르거나 스크롤시키지 않고도 카드끼리 높이가 맞음.
- 학생 화면은 호출부를 그대로 둬서(기본값 `vertical`) 동작 변화 없음 — Playwright로 재확인.

## 교사 화면 넓은 레이아웃

성장 과정 페이지를 스크린샷과 함께 확인한 사용자가 "카드 폭이 좁아 글이 한눈에 안 보이고, 교사 화면 전체가 학생용 좁은 폭(700px)을 그대로 써서 답답하다"고 피드백. 학생용 화면(참여/글쓰기)은 모바일/태블릿에 적합한 지금 폭을 유지하기로 하고, **교사 화면만** 넓혔다.

- `app/globals.css`에 `.container-wide`(max-width 1100px) 신규 — `.container`(700px, 학생용)와 별도. 교사 페이지 4곳(`/dashboard`, `/dashboard/new`, `/dashboard/[activityId]`, `/dashboard/[activityId]/students/[submissionId]`)에 적용. `/login`은 버튼 하나뿐이라 그대로 둠.
- 넓어진 컨테이너 안에서도 특정 요소는 과하게 늘어나지 않게 개별 폭 제한 추가: `.join-info-card`(참여 코드/QR) `max-width: 420px`, 활동 생성 폼(`components/NewActivityForm.jsx`)은 `.form-narrow`(`max-width: 480px`) 클래스로 감쌈.
- 성장 과정 카드 자체도 260px → 420px로 키움(위 항목 갱신).

## 성장 과정 페이지 — 카드 3개가 한 화면에, 텍스트 내부 스크롤 제거

위 두 차례 조정을 거치고도 사용자가 "아직 한눈에 안 들어온다, 한 화면에 카드 3개가 꽉 차게 하고 텍스트 박스 안 스크롤 대신 카드 줄 전체를 가로 스크롤하고 싶다"고 재요청. 두 가지로 마무리:

- `.history-item-writing`의 `max-height`/`overflow-y: auto`를 완전히 제거 — 글이 아무리 길어도 카드 안에서 잘리거나 스크롤되지 않고 그대로 다 보임. 카드끼리 높이가 다른 문제는 `.history-items`의 flexbox 기본 동작(`align-items: stretch`)이 그 줄에서 가장 긴 카드에 맞춰 자동으로 맞춰주므로 별도 처리 불필요.
- 성장 과정 페이지 전용으로 더 넓은 `.container-widest`(max-width 1440px)를 추가하고 이 페이지에만 적용(다른 교사 페이지는 `.container-wide` 1100px 유지) — 카드 420px 기준으로 3개가 여유 있게 들어가고 4번째가 살짝 걸쳐 보여 "더 스크롤할 게 있다"는 신호도 자연스럽게 줌.

## master 병합 + Vercel 배포 전환

`worktree-nextjs-classroom-mvp` 브랜치(Phase 1 + 활동 생성 폼 개선 + Phase 2 + 제출하기 제거)를 `master`에 fast-forward 병합하고 실제 프로덕션 배포를 전환했다. 병합 전 이 브랜치는 GitHub에 push된 적 없는 로컬 전용 브랜치였다는 점을 확인함(로컬 컴퓨터가 손상되면 유실 위험이 있었음).

- `package.json`에 `"vercel-build": "prisma migrate deploy && next build"` 추가 — Vercel은 `build` 대신 `vercel-build`가 있으면 이를 우선 실행하므로, 배포마다 프로덕션 DB에 대기 중인 마이그레이션을 자동 적용한 뒤 빌드하도록 함.
- `vercel.json`에 `{"framework": "nextjs"}` 추가 — 프로젝트가 원래 Vite로 링크되어 있어 프레임워크 프리셋이 꼬일 가능성을 방지.
- 로컬에서 `npm install` + `npm run build` + `npx prisma migrate status`로 사전 검증(마이그레이션 3건 모두 이미 적용된 상태 확인 — 개발 중 같은 DB에 이미 적용됐었음) 후 push.
- 배포 후 자동 스모크테스트: `/login` 200, `/api/auth/providers`의 콜백 URL이 정확한 프로덕션 도메인인지, `/dashboard`(비로그인) 307 리다이렉트, `/join/[존재하지않는코드]` 404(DB 조회 정상) 확인.
- 사용자가 직접 Google 로그인 성공 확인 + Google Cloud Console의 승인된 리디렉션 URI에 프로덕션 도메인 콜백이 이미 등록되어 있음을 확인함.

## Phase 4 — 무의미한 글 / 스페이스 도배 감지 가드

- `lib/guard.js` 신규(TDD로 구현, `lib/guard.test.js` 10개 테스트) — 순수 함수 `checkGuard(text)`가 두 가지 신호로 무의미한 글을 감지: (1) 한글 호환 자모(U+3131-U+3163) 8자 이상 연속(키보드 난타), 같은 글자 12회 이상 반복(공백 하나로 띄어써도 감지), (2) 텍스트의 공백 비율이 50% 이상이거나(스페이스바로 글자 수만 채우기) 전체에서 자모 비율이 30% 이상(20자 이상일 때만 적용). 의도적으로 보수적으로 설정 — "하하하하", "ㅋㅋㅋ", "!!!!", "두근두근두근" 같은 정상적인 표현은 안 걸리는 것을 테스트로 확인.
- `lib/actions.js`의 `requestCoaching`에서 목표 글자 수 체크 다음, Gemini 호출 전에 가드를 실행 — 걸리면 **Gemini 호출 자체를 생략**하고 도달도를 무조건 0으로 강제(이전 값이 얼마였든), 경고 메시지를 저장. 단, `lastSubmittedWriting`/`lastImprovements`는 갱신하지 않아서, 다음 정상 제출은 이 무의미한 글이 아니라 마지막 정상 글을 기준으로 비교/코칭됨.
- 학생 화면(`WritingScreen.jsx`)은 걸렸을 때 초록색 코칭 카드 대신 빨간 경고 카드를 보여줌. 도달도 게이지는 그대로 0%를 표시(코드 변경 불필요, 기존 로직이 임의의 숫자를 이미 처리함).
- 교사용 성장 과정 화면(`RevisionHistory.jsx`)도 플래그된 라운드를 만나면 배지로 표시하고 죽지 않도록 수정 — 원래 코드는 `improvements.map` 등이 플래그된 라운드엔 없는 필드라 그대로 두면 크래시났을 부분.
- Playwright로 실제 브라우저 검증: 무의미한 글 제출 → 경고 카드 + 도달도 0% (Gemini 호출 없이 즉시) → 히스토리에 배지 정상 표시 → 이어서 정상적인 글 제출 → 실제 Gemini 코칭 + 도달도 40%로 회복까지 확인 완료.

## Phase 4 — AI 기반 무의미한 글 2차 판단 (하이브리드)

배포 후 사용자가 실사용 중 회피 사례 발견 — 수정 라운드에서 공백을 교묘히 섞어 규칙의 임계값을 피한 글이 그대로 Gemini에 전달되어 정상 코칭으로 처리됨. "규칙은 그대로 두고, 이미 호출 중인 Gemini 코칭 응답에 판단 필드 하나를 얹어 2차 안전망으로 쓰자"는 방식으로 해결.

- `lib/coaching.js`의 `FIRST_ROUND_SCHEMA`/`REVISION_SCHEMA`에 `meaningless: boolean` 필드 추가, 프롬프트 맨 앞에 "먼저 이 글이 무의미한 글인지 판단해서 알려줘" 지침 추가 — **추가 API 호출 없이** 기존 코칭 요청 1회에 얹음.
- `lib/actions.js`: Gemini 응답의 `result.meaningless === true`면 규칙 가드와 동일한 경로(`flagRound`, 아래 참고)로 처리.
- 실제 검증: 한글 규칙으로는 절대 못 잡는 영문 키보드 낙서("asdf zxcv qwer tyui" 등)를 1회차·수정 라운드 둘 다에 제출 → AI가 정확히 `meaningless: true`로 판단해 0%/경고카드 처리되는 것 확인.

## Phase 4 — 욕설/비속어 감지 + 교사 승인(O/X) 큐

자모 반복/AI 판단과 달리, 욕설/비속어는 오탐 위험이 있어 즉시 점수를 깎지 않고 **교사가 O/X로 검토**하는 방식으로 구현. 검토 위치는 "로스터 배지 + 학생 상세 페이지에서 O/X" + "대시보드 상단 알림 배너"를 조합하는 것으로 이번 대화에서 확정(별도 전용 큐 페이지는 만들지 않음). 반려(X) 시 점수는 건드리지 않고 재작성만 요청하기로 확정.

- `lib/profanity.js` 신규(TDD, `lib/profanity.test.js`) — `PROFANITY_WORDS`(명확한 욕설만 포함한 스타터 리스트, 오탐 위험 있는 애매한 단어는 의도적으로 제외 — 걸레/죽어/미친 등은 정상적인 문맥에서도 쓰이므로 뺌) + `containsProfanity(text)`.
- 상태 모델은 스키마 변경 없이 기존 `feedback`/`rounds` JSON 재사용: 검토 대기 중엔 `feedback = { pending: true, reason: 'profanity' }`이고 `attainment`/`rounds`는 건드리지 않음(아직 "라운드"로 집계 안 함).
- `lib/actions.js`: `flagRoundAsNonsense`를 `flagRound(submission, writing, reason, attainment)`로 일반화(점수를 강제할지 그대로 둘지 호출부에서 명시적으로 결정). 기존 코칭 로직(Gemini 호출~라운드 저장)을 `runCoachingRound` 헬퍼로 추출해 정상 흐름과 교사 승인 흐름이 공유. `requestCoaching` 최상단에 pending 체크 추가(대기 중 재요청은 같은 pending 상태만 되돌려줌, 에러 아님) → `checkGuard` 통과 후 `containsProfanity` 체크 추가. 신규 Server Action `resolveProfanityReview(submissionId, decision)` — 승인(`approve`)이면 `runCoachingRound`로 그제서야 실제 코칭 진행, 반려(`reject`)면 `flagRound(..., submission.attainment)`로 점수 변동 없이 라운드만 기록.
- UI: `components/ProfanityReviewPanel.jsx` 신규(교사 전용, 대기 중인 글 원문 + 승인/반려 버튼) — 학생 상세 페이지(`students/[submissionId]/page.js`)에 렌더링. 로스터(`dashboard/[activityId]/page.js`)엔 "⏳ 검토 필요" 배지, 대시보드(`dashboard/page.js`)엔 전체 활동 통틀어 대기 건수 배너(Prisma JSON 경로 필터 `feedback: { path: ['pending'], equals: true }`로 조회) 추가. 학생 화면(`WritingScreen.jsx`)은 대기 중일 때 노란 안내 카드 + 코칭 버튼 비활성화.
- 검증: 학생측 흐름(비로그인, 자동화 가능)은 Playwright로 확인 — 욕설 제출 → Gemini 호출 없이 pending 카드+버튼 비활성화, 새로고침해도 서버 상태 유지 확인. 대시보드 배너가 쓰는 Prisma JSON 쿼리도 직접 검증 완료. **교사의 승인/반려 버튼 클릭까지 포함한 전체 플로우는 아래 "로컬 전용 테스트 교사 로그인" 도입 후 Playwright로 완전 자동 검증 완료.**

## 로컬 전용 테스트 교사 로그인 (`lib/devLogin.js`)

교사 화면 확인마다 실제 Google 로그인이 필요해 로컬 테스트가 번거롭다는 문제 제기로 추가. `NODE_ENV !== 'production'`일 때만 `/login`에 "🧪 테스트 교사로 로그인" 버튼이 뜨고, 클릭하면 고정된 이메일(`dev-teacher@localhost.test`)로 교사 계정을 만들고 그 세션으로 바로 로그인된다. Vercel Preview/Production은 둘 다 `NODE_ENV=production`이라 배포된 곳 어디에도 노출/동작하지 않음(빌드 후 프로덕션 모드로 직접 띄워서 `/api/auth/providers`·로그인 페이지 HTML 양쪽 다 확인 완료).

- **구현 중 실제 버그 발견 및 수정**: 처음엔 `next-auth`의 Credentials 프로바이더로 구현했으나, 이 프로바이더가 `session: { strategy: 'database' }` 설정과 무관하게 JWT 형식 쿠키를 발급해버려서 `auth()`/`/api/auth/session`이 로그인 직후에도 세션을 인식하지 못하는(`null` 반환) 문제를 발견함. Credentials 프로바이더를 걷어내고, `lib/devLogin.js`가 **직접 Prisma로 `Session` 행을 만들고 그 토큰을 쿠키에 심는** 방식(실제 OAuth 로그인 성공 시 어댑터가 하는 일을 그대로 재현)으로 교체해 해결.
- 이제 교사 로그인이 필요한 모든 기능(활동 생성, 승인/반려 큐 등)을 **Playwright로 완전 자동 검증** 가능해짐 — 앞으로 교사 화면 기능을 추가할 때마다 이 방식으로 로컬에서 바로 E2E 검증하면 됨(더 이상 사용자가 직접 브라우저로 확인할 필요 없음).
- 이번에 이 로그인으로 욕설 승인 큐 전체 플로우(활동 생성 → 학생 2명 욕설 제출 → 대시보드 배너/로스터 배지 → 반려 시 점수 불변+히스토리 기록 → 승인 시 실제 코칭 진행)를 Playwright로 처음부터 끝까지 자동 검증 완료.

## 후속 세션 마무리 — 다음은 Phase 3(루브릭) 상세 프롬프트로 시작

Phase 4 완료 세션 이후 후속 대화(2026-07-12)에서 사용자에게 다음 방향을 확인: ① push+배포 ② 실사용 피드백 반영 ③ Phase 2·3 계획 수립. **③을 선택**했고, 이어서 범위를 다시 좁혀 Phase 2 잔여(정렬/검색)는 제외하고 **Phase 3(루브릭)에 집중**하기로 확정.

Phase 3는 별도 PRD 문서 없이 로드맵 한 줄(아래 항목)만 있어 brainstorming 절차대로 바로 설계를 시작하려 했으나, **사용자가 먼저 원하는 기능을 상세히 적은 프롬프트를 준비해서 다음 세션에 가져오기로** 결정함(지금 자리에서 질문을 이어가는 대신). 따라서 이번 세션은 코드 변경 없이 문서 정리만 하고 종료.

push/배포는 이번에도 요청되지 않아 보류 상태 그대로 유지(로컬이 origin보다 앞선 상태 지속 — 위 "최신 커밋" 항목 참고).

## 디자인 리프레시 — 단원 카드/마스코트 리디자인 + 화면 디자인 통일

Phase 3 상세 프롬프트를 기다리는 동안, 다른 세션에서 `design-reference/`에 올라온 참고 이미지 3장(디노 교사화면/학생화면/캐릭터)을 기반으로 새 활동 만들기 화면과 학생 글쓰기 화면을 먼저 리디자인했다(커밋 `1ce3ede`/`a877734`/`a137911`/`950e4f3`, 이미 origin에 push·배포까지 완료됨). 이 문서에는 반영이 밀려 있었어서 이번에 함께 정리한다.

**단원 카드 기반 새 활동 만들기 (`1ce3ede`, `a877734`, `a137911`)**
- 학년군+글의 종류 칩 방식 → `lib/curriculum.js`의 `GRADE6_SEMESTER1_UNITS`(1,2,4,5,6,7,8,9단원, 3단원은 글쓰기 활동이 없어 생략) 카드 선택 방식으로 교체. 단원을 선택하면 장르/권장 글자 수가 자동 설정됨.
- "오늘의 주제"/"학생에게 안내할 말"을 선택 입력으로 추가(`Activity.instructions` 컬럼 신설, 마이그레이션 `20260715044307_activity_unit_fields`), 목표 글자 수는 프리셋 버튼 그리드(직접 입력 포함)로 변경.
- 주제 없는 활동(자유 주제)에서 안내 문구가 비거나 "· "만 남던 화면 3곳(활동 상세/참여/글쓰기)을 후속 수정으로 마무리.

**학생 글쓰기 화면 리디자인 (`950e4f3`)**
- 헤더(학생 이름 배지)/주제 카드(`.topic-card`)/좌우 분할 워크스페이스(`.write-panel`·`.feedback-panel`)로 레이아웃 전면 교체.
- 도달도 공식은 그대로 두고, 진행 트랙 위에 디노 마스코트(캐릭터 시트에서 크롭한 표정 4종, `public/dino/`)가 현재 도달도 위치에서 말풍선으로 격려 메시지를 보여주도록 추가(`lib/mascot.js`).
- `design-reference/`의 참고 이미지 3장(교사화면/학생화면/캐릭터)이 이 두 작업으로 전부 소진됨 — 추가 화면을 리디자인하려면 새 레퍼런스가 필요하거나, 기존 디자인 언어(카드 반경/색/아이콘 패턴)를 그대로 확장해야 함.

**나머지 화면 디자인 통일 (이번 세션, `b1a4f97`)**
- 위 두 화면만 새 스타일이 적용되고 대시보드/활동 상세/성장 과정/학생 참여 화면은 예전 스타일 그대로라 앱 안에 디자인이 반반 섞여 있던 것을 통일.
- `components/TeacherHeader.jsx` 신규 — 아이콘+제목(+부제)/이메일+로그아웃을 묶은 공통 헤더. 대시보드·새 활동 화면에서 중복되던 헤더 마크업을 통합했고, 원래 로그아웃 버튼이 없었던 활동 상세·성장 과정 화면에도 추가됨.
- `lib/curriculum.js`에 장르별 아이콘 매핑(`getGenreIcon`) 추가 — 단원 카드 아이콘을 활동 목록/학생 로스터 카드에도 재사용.
- `.activity-card`를 아이콘 박스+본문+화살표 구조로, `.join-info-card`도 14px 라운드로 새 카드 스타일에 맞춤. `/join` 화면에는 글쓰기 화면과 동일한 `topic-card`로 활동 미리보기를 추가.
- devLogin(`lib/devLogin.js`) + Playwright로 대시보드 → 새 활동 만들기 → 활동 상세(QR) → 학생 참여 → 성장 과정까지 전 화면을 스크린샷으로 직접 검증.

## Phase 2 이후 로드맵 (다음에 할 일, 실사용 피드백 이후)

1. **Phase 2 잔여**: 참여 학생 목록 정렬/검색(필요해지면 별도 요청 — "제출 현황" 필터는 제출 개념 자체가 없어져서 더 이상 해당 없음)
2. **Phase 3 — 루브릭**: 표/이미지 업로드 + AI 파싱 + 충족 여부 체크(O/X만, 점수 없음), 교사가 고르는 피드백 우선순위(내용/구조/표현력 등)가 코칭 프롬프트에 반영

## 주의할 점 / 기술 부채

- **Prisma 7 + 생성된 클라이언트가 `.ts`**: `typescript` devDependency가 없으면 빌드가 깨짐. import 확장자는 실제 파일 확장자(`.ts`)를 써야 함.
- **마이그레이션 실행**: `npx prisma migrate dev`(로컬, `prisma.config.js`의 직접 연결 사용) → 배포 파이프라인은 `vercel-build` 스크립트에서 `prisma migrate deploy`를 자동 실행하도록 연결 완료.
- **Google OAuth 리다이렉트 URI**: `http://localhost:3000/...`와 배포 도메인 두 개 등록 확인 완료. 커스텀 도메인 추가 시 리다이렉트 URI도 함께 추가해야 함.
- **가드 임계값은 첫 추정치** — `JAMO_RUN_MIN_LENGTH`(8) / `REPEATED_CHAR_MIN_LENGTH`(12) / `JAMO_RATIO_THRESHOLD`(0.3) / `WHITESPACE_RATIO_THRESHOLD`(0.5)는 실제 학생 글 샘플로 검증한 것이 아니라 원칙적으로 보수적으로 잡은 값. 실사용 중 오탐/미탐 사례가 나오면 `lib/guard.js` 상수만 조정하면 됨.
- **로컬 `.vercel`/`.env.local`**: 마스터 레포 루트를 이번에 처음 `vercel link`했음 — 새 환경에서 로컬 개발하려면 `vercel env pull .env.local` 필요.
- **참여 코드 충돌**: 활동 생성 시 6자리 코드가 우연히 겹치면 재시도(최대 5회)하도록 되어 있음 — 코드 스페이스가 32^6이라 실사용 규모에서는 문제 없을 것으로 예상.
- Flexbox 중앙 정렬 관련 주의사항(2단계에서 겪은 `.container` 너비 버그)은 여전히 유효 — CSS는 대부분 그대로 이식됨.
- 정식 테스트 프레임워크(Vitest)가 이번에 처음 도입됨 — 다만 UI/E2E 테스트는 여전히 상주하지 않고 임시 Playwright 스크립트 관례를 유지.
- **교사 로그인이 필요한 기능을 검증할 땐 `lib/devLogin.js`(로컬 전용)를 활용할 것** — `/login`의 "🧪 테스트 교사로 로그인" 버튼으로 Google OAuth 없이 즉시 교사 세션 획득 가능, Playwright 자동화도 가능.
- **커밋/배포 방침**: 로컬 커밋까지만 자동으로 하고, push/배포는 사용자가 명시적으로 요청할 때만(위 상단 경고 참고).

## 다음 세션 시작 프롬프트 (복사해서 사용)

```
dino-writing-coach 프로젝트를 이어서 작업합니다 (master 브랜치).
docs/PROJECT_STATUS.md에서 현재 상태를 확인해줘.
Phase 4까지 전부 완료했고, 그 다음 후속 대화에서 다음 단계로 Phase 3(루브릭 업로드 + AI 파싱 +
충족 여부 체크(O/X) + 교사가 고르는 피드백 우선순위)로 방향을 정했어. 로컬 커밋은 여전히
GitHub보다 앞서 있어(push/배포는 아직 요청 안 함) — git log origin/master..HEAD로 확인해줘.

아래는 내가 준비해온 Phase 3 상세 요구사항이야:
(여기에 프롬프트 붙여넣기)

이걸 바탕으로 brainstorming부터 시작해서 설계하고 계획 세워줘.
```
