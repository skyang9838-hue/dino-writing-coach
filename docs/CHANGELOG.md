# 디노 글쓰기 코치 — 작업 기록

> **기록 보관용 문서입니다. 평소 세션에서는 읽지 않아도 됩니다.**
> 현재 상태와 다음 할 일은 [`PROJECT_STATUS.md`](PROJECT_STATUS.md), 현재 동작 명세는 [`FEATURES.md`](FEATURES.md), 개발 규칙은 저장소 루트의 [`CLAUDE.md`](../CLAUDE.md)에 있습니다.
>
> 본문은 **오래된 것부터 아래로** 쌓여 있습니다. 작업이 끝나면 STATUS에서 이 문서 맨 아래로 옮겨 적습니다.

## 목차 (최신순)

**2026-08-02 — 대시보드 end-to-end 검증 + 판정 안정성 수정** (맨 아래 항목)
실제 코칭 데이터로 보드를 검증하다 "안 고친 글에 향상/하락 화살표가 뜨는" 코칭 파이프라인 버그를 잡아 고침.

**2026-08-01 — 학생 글쓰기 수정 진행 대시보드**
교사용 성장 과정 화면을 재설계해 라운드마다 저장돼 있던 루브릭 판정을 처음으로 화면에 노출.

**2026-07-30~31 — 면담 보고서 파일럿 + 무한 코칭**
루브릭을 종료 조건이 아닌 진단 도구로 쓰고, 매 라운드 수정미션 2개를 보장하며, 도달도를 누적·무상한으로 되돌리고 완료 상태를 제거.

**2026-07-28 — 디자인/타이포그래피**
- 로컬 확인 후 피드백 반영 — 대시보드 재배치 / 디노 이미지 / 글쓰기 칸
- 타이포그래피 통일 + Pretendard 적용

**2026-07-15~16 — 디자인 리프레시**
- 단원 카드/마스코트 리디자인 + 화면 디자인 통일
- 활동 생성 폼 (학년/글의 종류/소재)

**2026-07-11~12 — Phase 4(안전 가드) + 배포 전환**
- 후속 세션 마무리 — 다음은 Phase 3(루브릭)
- 로컬 전용 테스트 교사 로그인 (`lib/devLogin.js`)
- Phase 4: 욕설/비속어 감지 + 교사 승인(O/X) 큐
- Phase 4: AI 기반 무의미한 글 2차 판단 (하이브리드)
- Phase 4: 무의미한 글 / 스페이스 도배 감지 가드
- master 병합 + Vercel 배포 전환

**2026-07-09~10 — 교실 플랫폼 전환 (Phase 1·2)**
- 성장 과정 페이지 레이아웃 조정 (가로 배치, 카드 3개 한 화면, 넓은 레이아웃)
- 제출하기 기능 제거
- Phase 2: 교사의 학생별 성장 과정(diff) 보기
- Phase 1: 기반 인프라 + 핵심 학생/교사 루프
- 방향 전환: 교사-학생 역할 분리 플랫폼으로 재설계

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

**활동 생성 페이지 이동 제거 (같은 세션 후속)** — 대시보드 스크린샷을 보던 사용자가 "새 활동 만들기 때문에 페이지를 꼭 옮겨야 하냐"고 문제 제기. `/dashboard/new` 라우트를 없애고 활동 목록 바로 아래에 `NewActivityForm`을 인라인으로 배치, 상단 버튼은 그 자리로 스크롤하는 앵커 링크(`#new-activity`)로 변경. `createActivity`의 리다이렉트 동작은 그대로라 생성 후에는 여전히 새 활동 상세 페이지로 이동함.

## 타이포그래피 통일 + Pretendard 적용 (2026-07-28)

교사 화면 두 곳(새 활동 만들기 / 활동 상세)의 제목 크기가 인라인 스타일로 제각각(1.2rem vs 1.1rem)인 것을 발견해 시작. 전체 6개 화면을 감사한 뒤 앱 전역 규칙으로 정리했다. 설계는 `docs/superpowers/specs/2026-07-28-teacher-typography-unification-design.md`, 계획은 `docs/superpowers/plans/2026-07-28-teacher-typography-unification.md`.

**폰트 — Pretendard 전환 (`2753190`)**
- `next/font/local`로 `pretendard` npm 패키지의 Variable woff2를 self-host, `--font-pretendard` CSS 변수로 노출.
- **중요:** `input`/`textarea`/`select`/`button`은 `body`의 `font-family`를 상속하지 않는다(브라우저 시스템 폰트 사용). 전역 `font-family: inherit` 규칙을 추가하지 않으면 입력칸과 버튼만 다른 폰트로 남는다. 앞으로 폰트를 바꿀 때도 이 규칙이 있어야 한다.

**공통 타이포 클래스**
- `.page-title`(1.4rem/700/#222), `.section-heading`(1.2rem/700/#222) 신설. `TeacherHeader`·대시보드·활동 상세의 인라인 `fontSize`를 전부 교체.
- **주의:** `.container* h1` 규칙(2rem 중앙정렬)이 `.page-title`보다 특이성이 높아 덮어쓰고 있었다. 컨테이너 규칙을 `h1:not([class])`로 좁혀 해결 — 진입 화면(`/login`, `/join`)의 2rem h1은 그대로 유지된다.
- 폼 라벨(1rem/600)과 강조 라벨(`.topic-card-label` 0.85rem/700/초록)은 역할이 달라 **의도적으로 다르게 유지**.

**감사 중 발견한 실제 버그 2건 (둘 다 수정 완료)**
- `.char-count`가 `.write-panel-footer .char-count`로 스코프돼 있는데 실제 요소는 `.write-panel-header` 안에 있어 규칙이 전혀 적용되지 않고 있었음.
- `.write-panel textarea`에 `height`만 지정돼 있어 테두리·패딩 없이 `cols` 기반 좁은 너비(약 470px 대신 200px)로 렌더링되고 있었음. `.field textarea`가 멀쩡했던 건 `.field`가 flex 컬럼이라 늘어났기 때문. 너비/테두리/패딩을 명시해 해결.

**레퍼런스 정합 (`design-reference/디노 교사화면.png`)**
- 단원 카드: 아이콘 2rem→3rem, 제목 1.05rem + 2줄 높이 예약(설명 시작 위치 정렬), 테두리 연하게 + 미세 그림자, `word-break: keep-all`로 한글 단어 중간 줄바꿈 방지.
- 설정 영역(주제/안내말/글자 수)을 `.settings-card` 하나로 묶고, 목표 글자 수에 드롭다운 추가 + 프리셋 3열, 라벨에 아이콘 추가.
- 제출 버튼을 520px 중앙 정렬 + 하단 안내 문구, 헤더의 이메일/로그아웃을 테두리 있는 칩·버튼으로.

**범위 밖으로 남긴 것**
- 레퍼런스 학생 화면의 도달도 눈금(50% 분량 충족 / 70% 1차 피드백 …)은 **구현하지 않음**. 실제 `lib/attainment.js` 공식은 40%에서 시작해 보완점 개수×10%라 레퍼런스의 눈금 값과 맞지 않는다. 눈금을 넣으려면 점수 공식 자체를 정하는 결정이 먼저 필요하다.
- 아이콘 렌더링 3패턴(`unit-card-icon` 단독 / `activity-card-icon` 배경박스 / `TeacherHeader` 인라인)은 문맥이 달라 통일하지 않음.
- 레퍼런스의 3D 스타일 이모지는 폰트(Windows는 평면 Segoe 이모지) 문제라 이미지 에셋 없이는 재현 불가.

**검증:** Vitest 61개 통과, 프로덕션 빌드 통과, oxlint 통과. devLogin + Playwright로 로그인/대시보드/새 활동/활동 상세/성장 과정/참여/글쓰기 7개 화면 스크린샷 촬영 후 레퍼런스와 비교, 계산된 스타일(`getComputedStyle`)로 `.page-title` 22.4px·`.section-heading` 19.2px·카드 14px·Pretendard 실제 로드까지 직접 확인.

## 로컬 확인 후 피드백 반영 — 대시보드 재배치 / 디노 이미지 / 글쓰기 칸 (2026-07-28, `5093404`)

위 타이포그래피 작업을 로컬 서버에서 직접 확인한 사용자가 준 피드백 3건을 반영했다.

**1. 대시보드 순서 — 단원 카드가 첫 화면에**
- 기존 "내 활동 목록 → 새 활동 만들기 폼" 순서를 뒤집었다. 교사가 이 화면에 오는 주 목적이 활동 생성이기 때문("내 활동은 중요하지 않아. 밑으로 내리고").
- 헤더를 `"내 활동"` → `"새 활동 만들기"` + 부제로. `TeacherHeader`의 기존 `subtitle` prop을 재사용했고, 이 덕분에 레퍼런스 교사화면 헤더와 정확히 같아졌다. 폼 위에 중복되던 `h2` + 힌트는 삭제.
- 아래로 스크롤시키던 `+ 새 활동 만들기` 앵커 버튼 삭제(폼이 맨 위로 오면 무의미) → 그 버튼을 가리키던 빈 상태 문구도 함께 수정.
- `.dashboard-new-section`(구분선)을 `.dashboard-list-section`으로 옮겨 구분선이 목록 위에 오도록.

**2. 디노 캐릭터 이미지 — `🦕` 이모지 전면 교체**
- Windows에서 `🦕`가 납작한 도마뱀으로 렌더링돼 레퍼런스 캐릭터와 딴판이라는 지적. `design-reference/디노 캐릭터.png`에서 2개 포즈를 크롭해 `public/dino/pose-wave.png`(인사), `pose-writing.png`(연필 든 포즈) 추가.
- **투명 배경 처리**: 원본이 흰 배경이라 초록 버튼 위에 얹으면 흰 사각형이 보인다. PIL로 **가장자리에서 시작하는 flood fill**을 써서 바깥쪽 흰색만 투명화 — 이렇게 하면 공룡의 크림색 배는 둘러싸여 있어 살아남는다. 스크립트는 일회성이라 저장하지 않음.
- `components/DinoIcon.jsx` 신설(`pose`/`size` prop). 로그인·참여·글쓰기 헤더·교사 헤더·제출 버튼에 적용.
- **주의:** `TeacherHeader`의 `icon`은 활동 상세/성장 과정에서 장르 이모지(`getGenreIcon`)로도 넘어온다. **기본값만** 이미지로 바꿨고(`icon ?? <DinoIcon/>`), 넘어온 값은 그대로 렌더링된다. 이 화면들에 장르 아이콘이 유지되는지 검증에 포함시킬 것.
- `app/icon.png` 추가 → App Router가 자동으로 파비콘으로 인식(별도 설정 불필요).
- **함정:** 이미지를 `inline-block` + `vertical-align: middle`로 넣었더니 h1 라인 박스를 넘쳐 헤더에서 잘렸다. 이미지를 담는 제목/버튼(`.page-title`, `.container* h1:not([class])`, `.write-header h1`, `.button-primary`)을 **flex 행으로 전환**해 해결.

**3. 글쓰기 칸 확대**
- `.write-workspace`가 `1fr 1fr`이라 읽기 전용 피드백 패널이 절반을 가져가고 있었다 → `6fr 4fr`.
- 글쓰기 화면 전용 `.container-write`(1280px) 신설. `.container-wide`(1100px)는 교사 페이지들도 쓰므로 **건드리면 안 됨**.
- 도달도 0%일 때 마스코트가 트랙 왼쪽 끝(자기 너비의 절반이 트랙 밖)에 있어 주제 제목에 바짝 붙던 문제 → `.topic-card` 열 간격 확대.

**검증:** Vitest 61개 / 빌드 / oxlint 통과. Playwright로 계산값 직접 확인 — 글쓰기:피드백 = 725:483(=1.50, 6:4), 컨테이너 1280px, 앵커 버튼 제거됨, 단원 그리드 y=197(첫 화면)·활동 목록 y=1184, 활동 상세/성장 과정 헤더에 장르 이모지 유지(`hasDinoImage: false`), 이미지 4xx 요청 0건.

## 면담 보고서 파일럿 + 무한 코칭 (2026-07-30~31, `83f9ba6`~`4cc1cef`)

Phase 3(루브릭)를 범용 업로드 기능으로 만드는 대신, **"면담 보고서" 한 장르에 루브릭을 고정해 넣는 파일럿**으로 방향을 좁혀 진행했다. 26개 커밋 분량.

**1. 파일럿 활동과 루브릭 (`lib/curriculum.js`)**
- `INTERVIEW_REPORT_GENRE = '면담 보고서'` 장르 신설.
- 루브릭 3개 / 채점기준 7개를 코드에 상수로 박았다 — 교사 업로드가 아니라 고정값이다.
  - 목적·대상: `purpose`, `interviewee`
  - 정보 전달: `new-fact`, `fact-detail`
  - 짜임: `opening`, `body`, `closing`
- 각 기준은 `met`/`partial`/`unmet` 판정 문구와 `missionSeed`(미션 생성용 지시문), `priority`를 갖는다.

**2. 2단계 Gemini 파이프라인 (`lib/coaching.js`)**
- 1단계 **판정**: `buildInterviewAssessmentPrompt` → 7개 기준을 각각 met/partial/unmet으로 판정 (`INTERVIEW_ASSESSMENT_SCHEMA`).
- 2단계 **미션 생성**: `buildInterviewMissionPrompt` → 선택된 대상에 맞는 수정미션 2개 생성 (`INTERVIEW_MISSION_SCHEMA`).
- 판정과 생성을 나눈 이유: 한 번에 시키면 판정이 미션에 끌려가 허위 충족이 생겼다.
- `sanitizeInterviewMissionResult` / `validateInterviewMissionResult`가 막연한 조언, 복사 가능한 모범 문장, 미션 개수 불일치를 걸러내고 재시도시킨다.
- 진입점은 `getInterviewReportFeedback` (일반 장르는 기존 `getGeminiFeedback` 유지).

**3. 결정론적 수정 대상 선택 (`lib/missions.js`)**
- `selectMissionTargets`가 **AI가 아니라 코드로** 어느 기준을 고칠지 고른다.
- `unmet` → `partial` → 우선순위 순으로 정렬하되, 최근 두 라운드 연속으로 나온 대상은 뒤로 미룬다.
- 짝지어 다뤄야 자연스러운 기준은 병합한다: `new-fact`+`fact-detail`, `purpose`+`interviewee`.
- 상위 기준이 `unmet`이면 종속 기준을 뺀다 (`new-fact` unmet이면 `body` 제외 등).
- **모든 기준이 `met`이어도** `REFINEMENT_SEEDS`로 "더 다듬을" 대상을 채워 항상 2개를 만든다.

**4. 도달도를 누적·무상한으로 (`lib/attainment.js`, `lib/interviewRound.js`)**
- 학생이 보는 도달도는 **루브릭 충족률이 아니라 누적 수정 노력**이다.
  - 첫 코칭은 글 상태와 무관하게 **40%** (`ATTAINMENT_START`).
  - 이후 직전 미션의 `done` 하나당 **+10%** (`ATTAINMENT_PER_POINT`). `partial`/`not-done`은 0%.
  - 감소하지 않고 **상한도 없다** — 100%를 넘어도 계속 누적된다.
- 루브릭 백분율(`computeRubricAttainment`)은 라운드에 `actualAttainment`로 따로 저장해 교사 분석용으로만 남긴다.
- 막대 너비만 100%에서 멈추고(`Math.min(attainment, 100)`), 숫자는 상한 없이 표시한다.

**5. 완료 상태 제거**
- `complete`, "완성", "완벽", "모든 기준 충족으로 종료" 같은 **제품 상태를 전부 없앴다.** 코칭에는 끝이 없다.
- 루브릭 완료 축하 박스와 `complete` 분기를 UI/영속화/스코어링에서 제거.
- 100% 이상에서는 마스코트 문구를 "완벽"이 아니라 계속 성장하는 표현으로 바꿨다.

**6. 프롬프트 평가 루프 (`evals/`, `scripts/eval-interview-report.js`, `lib/interviewEval.js`)**
- `npm run eval -- --set dev --runs 3` / `--set validation --runs 1`로 Gemini를 실제 호출해 프롬프트 품질을 측정한다.
- 게이트: 판정 일치율(개발셋 90%+, 검증셋 85%+), 스키마 100%, 미션 2개 생성률 100%, 종료 상태 0건, 허위 충족·논리 모순 0건.
- **주의: 실호출이라 비용이 든다.**

**설계 근거:** [`superpowers/specs/2026-07-30-infinite-interview-coaching-design.md`](superpowers/specs/2026-07-30-infinite-interview-coaching-design.md), [`superpowers/specs/2026-07-30-interview-report-prompt-pilot-design.md`](superpowers/specs/2026-07-30-interview-report-prompt-pilot-design.md)

## 문서 구조 개편 (2026-08-01)

세션마다 읽는 문맥이 40KB까지 불어나 정리했다.

- 이 문서(`CHANGELOG.md`)는 원래 `PROJECT_STATUS.md`였다. 누적된 세션 기록을 그대로 옮겨 보관용으로 돌렸다.
- `PROJECT_STATUS.md`는 현재 상태만 담은 1페이지로 새로 썼다.
- 스택·명령어·방침·함정처럼 변하지 않는 정보는 저장소 루트 `CLAUDE.md`로 옮겼다 (위 "주의할 점 / 기술 부채" 절의 내용이 여기로 갔다).
- 배포까지 끝난 spec/plan 7건을 `superpowers/archive/`로 옮겼다.
- master에 완전히 병합된 worktree 2개와 빌드 캐시를 지워 약 2.5GB를 회수했다.

## 학생 글쓰기 수정 진행 대시보드 (2026-08-01, 816139c)

`design-reference/학생 글쓰기 수정 진행 대시보드.png`가 새로 들어와 교사용 성장 과정 화면(`/dashboard/[activityId]/students/[submissionId]`)을 재설계했다.

**문제.** 면담 보고서 파일럿은 라운드마다 루브릭 판정(`round.assessments`, 기준 7개)을 저장해 왔는데 화면이 그걸 하나도 쓰지 않았다. 교사는 "도달도가 몇 % 올랐다"만 볼 수 있었고 어느 기준이 좋아졌는지는 알 수 없었다. 기존 화면은 학생용 `RevisionHistory`를 `layout="horizontal"`로 재사용해 라운드 카드를 가로로 늘어놓기만 했다.

**만든 것.**

- `lib/revisionBoard.js` — 저장된 라운드를 화면 행으로 바꾸는 순수 함수. `getRubricRows`(기준별 판정 + 직전 대비 변화), `getTrend`(`unmet 0 < partial 1 < met 2` 랭크 비교), `getMissionRows`(그 라운드의 미션 + **다음** 라운드가 내린 판정, 없으면 `pending`). 레거시 `improvements`/`addressed` 형식도 흡수. Vitest 14개.
- `components/RevisionBoard.jsx` — 카드 한 장에 채점기준표 7행(`○ △ ✕` / `– ↑ ▼`), 수정 미션과 반영 결과, 글 diff, 글자 수. 상태가 없어 **Server Component**. 카드 폭 325px 고정으로 `.container-widest`(1440px)에 4장이 스크롤 없이 들어가고, 더 많으면 가로 스크롤(`tabIndex={0}`이라 키보드로도 스크롤됨).
- `components/SignOutButton.jsx` — `TeacherHeader`에서 로그아웃 폼(서버 액션 포함)만 분리. 이 페이지는 `TeacherHeader`가 이메일에 쓰는 자리를 도달도 카드에 내주므로 헤더를 직접 조립한다. 다른 교사 화면의 렌더 결과는 그대로.
- `lib/curriculum.js` — 표에 들어갈 `shortLabel`을 기준 7개에 추가. 프롬프트가 쓰는 `label`/`statuses`/`missionSeed`/`priority`는 손대지 않았다.
- `components/RevisionHistory.jsx` — 교사 화면이 더는 안 쓰므로 `layout` prop과 `.history-list-horizontal` CSS 제거. 학생 글쓰기 화면 전용이 됐다.

**DB 스키마·Gemini 프롬프트·평가 파이프라인은 건드리지 않았다.** 전부 이미 저장된 값으로 그린다.

**목업과 다르게 간 것.**

| 목업 | 구현 | 까닭 |
|---|---|---|
| 채점기준표 6줄, 라벨 재작성 | 실제 기준 7개 그대로 | 표시와 저장 데이터가 어긋나면 유지가 안 된다 |
| "기준 보기" + "AI의 판단 근거" 안내 + "사용 가이드 보기" | 전부 제외 | `INTERVIEW_ASSESSMENT_SCHEMA`에 근거 필드가 없다. 넣으려면 프롬프트 수정 + 유료 라이브 평가 재실행이 필요해 별건으로 미룸 |
| 글 내용이 평문 | diff 강조 유지, 범례를 하단 안내 바로 이동 | 무엇이 바뀌었는지가 이 화면의 존재 이유 |
| 마지막 카드 배지 "최종" | "최근" | 코칭에 완료 상태를 두지 않는다는 파일럿 원칙과 충돌. `infiniteCoachingUi.test.js`가 소스에서 `최종`/`완성`/`완벽`을 막는다 |
| 카드 1의 미션이 앰버(미판정) | **마지막** 카드의 미션이 앰버 | 미션은 다음 라운드가 판정한다. 아직 판정이 없는 건 최신 라운드뿐 |

카드 제목은 목업을 따라 1부터 센다 — 첫 코칭 라운드가 "1차 수정"(+`초안` 배지)이다. 학생 화면은 같은 라운드를 여전히 "초안"이라 부른다. 대상이 달라 일부러 어긋나게 뒀다.

**장르 분기.** 모든 장르가 같은 보드를 쓴다. 면담 보고서가 아니면 `round.assessments`가 없어 채점기준표 섹션과 그 범례만 빠지고, 미션·diff·글자 수는 그대로 나온다.

**검증.** `npm test` 146개 통과(신규 14개), `npm run lint` 무경고. 화면은 Prisma로 4라운드짜리 면담 보고서와 2라운드짜리 일기를 직접 시드해(Gemini 호출 없음) 로컬 스크린샷으로 확인했다 — 카드 4장이 스크롤 없이 들어가는지, 변화 화살표가 직전 라운드 대비로 맞는지, 최신 카드 미션이 앰버인지, 일기에서 채점기준표만 빠지는지.

**설계 근거:** [`superpowers/specs/2026-08-01-revision-board-design.md`](superpowers/specs/2026-08-01-revision-board-design.md)

## 대시보드 end-to-end 검증 + 판정 안정성 수정 (2026-08-02, 56ddb14~3458734)

앞 항목에서 만든 보드는 **내가 손으로 짠 시드 데이터 + 스크린샷 눈으로 보기**로만 확인된 상태였다. 시드는 코드에 맞춰 짠 데이터라 코드가 틀려도 같이 틀려서 통과한다. 실제 코칭 데이터로 검증하기로 했다.

### 검증 방법 — 판정을 세 층으로 나눔

"AI 판정이 정답과 꼭 같아야 하나?"라는 질문에서 출발해, **기계가 판단할 것과 사람이 판단할 것을 분리**했다.

| 층 | 무엇 | 판정 주체 |
|---|---|---|
| 1층 | 보드 DOM이 DB 저장값과 일치하는가 | 코드 (하드 게이트) |
| 2층 | 루브릭 파이프라인이 규칙대로 도는가 | 코드 (하드 게이트) |
| 3층 | 판정 내용이 사람 눈에 말이 되는가 | 사람 (루프 종료 조건에 넣지 않음) |

**루프 종료 조건: 1층과 2층이 한 바퀴 안에서 동시에 통과.** 바퀴를 넘겨 누적하지 않는다 — 버그를 고치다 앞서 통과한 게이트가 되돌아갈 수 있다.

Playwright로 학생 흐름을 끝까지 돌려 실제 Gemini 코칭 7라운드를 만들고, 교사 보드의 DOM을 Prisma로 읽은 DB 값과 기계적으로 대조했다. 코칭 응답 대기는 DOM이 아니라 **DB 폴링**으로 했다(훨씬 안정적). 시나리오는 미션 마크 3종(✅/❌/앰버)과 도달도 증가 패턴(40 / +0 / +10 / +20)을 모두 밟도록 설계했다.

대조 항목: 카드 개수 · 제목 · 배지 · 채점기준표 7행의 라벨과 ○△✕ · `–↑▼` 변화 · 미션 문구와 마크 · 앰버 여부 · 글자 수 · 헤더 도달도와 막대 너비 · diff 추가/삭제분 · `<br>` 개수. 기대값은 `lib/revisionBoard.js`를 그대로 import해서 만들었다.

**3바퀴 돌았다.** 1바퀴 통과 후 3층에서 버그 발견 → 2바퀴는 Gemini 일시 네트워크 오류로 중단(게이트 실패 아님, 스크립트에 재시도 추가) → 3바퀴 통과.

### 잡은 버그 — 안 고친 글에 향상/하락 화살표

학생이 **글을 한 글자도 안 고치고** 재코칭을 누르면 같은 글의 판정이 뒤집혔다. 실측: 동일한 267자 글이 `body` partial→met, `closing` partial→unmet. 교사 보드에는 있지도 않은 향상 ↑ 과 하락 ▼ 가 떴다. 보드의 존재 이유가 "어느 기준이 좋아졌는지"를 보여주는 것이라 그대로 둘 수 없었다.

랜덤이 아니다. 판정 호출은 `temperature: 0`이지만 프롬프트가 현재 글뿐 아니라 `previousWriting`·`changes`·지난 미션까지 받아서, 같은 글도 이력이 달라지면 다르게 판정된다. **"루브릭 7개는 현재 글만 보고 판정하라"는 지시는 프롬프트에 이미 있었고 그것만으로는 안 잡혔다** — 그래서 프롬프트가 아니라 코드로 고쳤다.

**수정**(`lib/coaching.js`의 `getInterviewReportFeedback`): `previousWriting === writing`이고 직전 라운드에 판정이 있으면 판정 호출을 건너뛰고 그 판정을 그대로 쓴다. 바로 아래에서 지난 미션을 `not-done`으로 확정하는 것과 같은 처리이고, 덤으로 라운드당 Gemini 호출이 하나 줄어든다. 글이 바뀐 정상 경로는 코드 경로가 그대로다. 재검증에서 뒤집힘 0건.

### 게이트가 실제로 잡는다는 증거

- 시드 도달도를 130으로 잘못 적었더니 2층이 "100 + 10×2 = 120"이라고 잡아냄
- "앰버는 마지막 카드만"이라는 내 단정을 1층이 반박 — **flagged 라운드가 뒤따르면 그 앞 카드 미션도 앰버가 맞다**(판정한 라운드가 없으므로). 컴포넌트가 옳았고 검증 쪽을 고쳤다

### 보드 코드는 한 줄도 안 바뀌었다

`git diff 816139c..HEAD -- components/ app/ prisma/` 결과 변경 없음. 검증 대상이던 보드는 무수정 통과했고, 버그는 전혀 다른 곳(코칭 파이프라인)에 있었다.

### 검증용 시드는 지웠다

보드 렌더링 확인용으로 Prisma에 직접 넣은 픽스처 3건(`VRFYE1~3`: 도달도 120% · flagged 라운드 혼재 · 라운드 1개)은 파이프라인을 안 거쳐 **판정값이 글 내용과 무관했다**(43자 한 문장에 met 6개). 화면을 열어본 사용자가 앱의 판정으로 오해해서 삭제했다. 그 엣지케이스를 다시 보려면 픽스처를 새로 만들어야 한다. 실제 코칭을 거친 `VRFY01`(검증학생, 7라운드)만 로컬에 남겼다.

**검증 스크립트도 저장소에 남기지 않았다** — `playwright`가 devDependency가 아니고 이 저장소 관례가 "UI 검증은 그때그때 임시 스크립트"다. 재검증하려면 다시 짜야 한다.

### 검증

`npm test` 148개 통과(신규 2개), `npm run lint` 무경고.

## 보드 스크롤 컨트롤 + AI 판정 기호 완화 (2026-08-30, `c1c1d46`)

PROJECT_STATUS의 "다음 할 일" 두 개를 함께 처리했다. 둘 다 같은 화면이라 커밋도 하나로 묶었다. **로컬 커밋까지만 하고 push하지 않았다** — 사용자 요청.

### 1. 스크롤 조작을 카드 위로

카드가 세로로 길어서 트랙의 가로 스크롤바는 몇 화면 아래에 있었다. 카드가 5장을 넘으면 오른쪽에 뭐가 더 있다는 것조차 알기 어려웠다.

새 클라이언트 컴포넌트 `components/BoardTrack.jsx`가 트랙을 감싼다. 카드와 `diff` 라이브러리는 서버에 남고 이 래퍼만 브라우저로 간다. 카드가 **실제로 넘칠 때만** 트랙 위에 스크롤바 + 좌우 화살표 한 줄이 붙는다.

- **화살표** — 한 번에 카드 한 장. 거리는 `.board-card` 두 장의 `offsetLeft` 차이를 실측해서, gap과 사이의 `›`까지 하드코딩 없이 포함된다
- **위쪽 스크롤바** — 빈 스페이서로 폭만 만든 네이티브 스크롤바. 스페이서 폭을 트랙의 `scrollWidth`가 아니라 **`스크롤바 자신의 clientWidth + 트랙의 maxScroll`**로 잡는 게 핵심이다. 버튼이 가로폭을 먹어 스크롤바가 트랙보다 좁으므로, 그냥 맞추면 thumb이 먼저 끝에 닿아 튕긴다. 이렇게 하면 두 스크롤러의 `maxScroll`이 같아져 모든 위치에서 일치한다
- **드래그** — 5px 넘게 움직여야 드래그로 친다(더블클릭 보호). 학생 글(`.board-writing-text`) 위에서 시작한 드래그는 브라우저에 넘긴다 — 교사가 문장을 복사해 가기 때문. 터치는 손대지 않아 네이티브 관성 스크롤이 살아 있다
- 기존 경로(휠·키보드·네이티브 스크롤바)는 하나도 없애지 않았다. 그래서 **위아래 두 스크롤바를 같은 초록으로 맞췄다** — 같은 것을 스크롤하는데 다르게 생기면 별개 컨트롤로 읽힌다

### 2. ○△✕는 AI가 쓸 기호가 아니었다

`○ 충분히 충족 / △ 보완 필요 / ✕ 미충족`은 사람 교사가 **확정 채점**할 때 쓰는 표기다. 그런데 판정한 건 AI고, 같은 글을 두 번 판정하면 결과가 갈린다는 게 바로 앞 세션(2026-08-02)에서 실측됐다.

- 기호: `✓ 충족으로 보임` / `? 판단이 애매함` / `✕ 확인 안 됨`
- 표 제목: `📋 채점기준표` → `📋 AI가 본 채점기준` + "선생님 확정 채점이 아니에요"
- 범례: `채점기준표 상태` → `AI 판정 표시`, 변화 표시에 "지난 회차의 AI 판정과 견준 것이에요" 추가
- `infiniteCoachingUi.test.js`에 회귀 테스트 2개 — 옛 기호(`○`/`△`)와 확정 채점 어투(`충분히 충족`/`미충족`)가 소스에 다시 나타나면 실패한다

### 검증 — 그리고 검증 환경에 한 번 속았다

로컬 `VRFY01`(검증학생, 실제 코칭 7라운드)을 브라우저로 열어 실측했다.

처음에는 **화살표를 4번 눌렀는데 2번만 먹고, 스크롤 이벤트가 아예 발생하지 않고, 스크린샷이 30초 타임아웃**나는 증상이 나왔다. 동기화 코드가 애니메이션을 죽이는 줄 알고 파고들었는데, 원인은 코드가 아니라 **Chrome 창이 백그라운드에 있어 탭이 `visibilityState: "hidden"`이었던 것**이다. 500ms 동안 `requestAnimationFrame` 프레임이 0개였다. 스크롤 이벤트도 smooth 스크롤도 렌더링 루프에 의존한다. 창을 앞으로 꺼내니 전부 정상 동작했다.

**교훈: UI 자동 검증에서는 측정할 때마다 `visibilityState`를 함께 찍어야 한다.** 안 그러면 환경 아티팩트를 코드 버그로 오진한다.

창을 꺼낸 뒤 확인한 값:

| 확인한 것 | 결과 |
|---|---|
| 화살표 1클릭 | 350.4px (카드 한 장). 5번에 1718.4 = `maxScroll` 도달 |
| 양 끝 버튼 비활성 | 시작에서 `‹`, 끝에서 `›` |
| 두 스크롤러 동기화 | 클릭·드래그·직접 대입 모든 경로에서 오차 1px 미만, 끝단에서도 `1231.2 = 1231.2` |
| echo 무한루프 | 없음 — scroll 이벤트 3개 발생 후 정지 |
| 드래그 | 150px 끌면 150.4 이동, `dragging` 클래스 잔류 없음, 텍스트 선택 안 생김 |
| 학생 글 위 드래그 | 트랙은 안 움직이고 텍스트만 선택됨 |
| 좁은 화면(526~767px) | 레이아웃 정상 |

`npm test` 150개 통과(신규 2개), `npm run lint` 무경고.

### 안 고치기로 한 것 — 화살표 연타

애니메이션이 도는 중에 화살표를 다시 누르면 `scrollBy`가 *그때의 현재 위치* 기준으로 목표를 다시 잡아 이전 목표를 덮어쓴다. 빠르게 4번 누르면 1400px 갈 것이 532.8px만 간다. 브라우저 smooth 스크롤의 일반적인 동작이고 천천히 누르면 정확해서, 사용자 판단으로 그대로 뒀다. 고치려면 `BoardTrack.jsx`에서 목표 위치를 따로 들고 누적시키면 된다.

---

## 2026-08-30 — 채점기준을 성취기준 → 청크 → 항목 구조로 (`e48d3d8`)

교사 보드가 채점기준 7개를 **평평한 표 하나**로 그리고 있었다. 그런데 청킹은 원래 데이터에 있었다 — `lib/revisionBoard.js`의 `getRubricRows`가 `flatMap`으로 그 층을 뭉개고 있었을 뿐이다. 단원이 성취기준 1개와 청크를 직접 들게 바꾸고, 보드가 그 구조를 그대로 그리게 했다.

설계 문서: `docs/superpowers/plans/2026-08-30-assessment-standard-chunking.md`.

**면담 보고서 채점기준을 7개에서 4개로 다시 설계했다.** 앞·가운데·뒷부분의 *위치*를 묻던 기준(`opening`/`body`/`closing`)을 걷어내고 내용의 존재만 묻는 기준으로 합쳤다. 위치 판정은 서로 모순을 일으켜 보정 코드가 붙어 있었는데, 새 네 기준은 서로를 함의하지 않으므로 그게 전부 사라졌다 — `mergePair`, 선행조건 게이트, 교차 모순 검사 4개, `normalizeInterviewAssessment`.

평가 주체를 항목마다 나눴다. `evaluator: 'teacher'`인 항목은 화면에만 나오고 AI는 존재 자체를 모른다 — `getAiRubrics`가 프롬프트·스키마·미션 후보로 가는 길목에서 걸러낸다.

브라우저 실측: 325px 카드에 4칸(항목명/판정/변화/배지)이 줄바꿈 없이 들어가고, 성취기준은 보드 상단에 한 번만 나오며 펼치면 카드를 아래로 민다.

**남긴 한계**: 저장된 라운드의 `assessments`는 옛 `criterionId`라서 예전 라운드의 AI 판정 칸이 비어 보인다. `evals/` 픽스처도 옛 7기준으로 라벨링돼 있어 `npm run eval`을 돌리려면 다시 라벨링해야 한다.

---

## 2026-08-31 — 2학기 단원 5개 + 채점기준 3개 단원 추가, 파이프라인을 단원 구동식으로 (`73dcb9f`)

어제 계획(`2026-08-30-assessment-standard-chunking.md`)의 나머지 절반. 계획은 "그릇을 만들고 데이터는 다음 회의에 받는다"였고, 그 데이터(`국어 2학기 교육과정 분석하기.txt`)가 이번에 들어왔다.

### 단원 목록을 1학기 목업에서 2학기 실제 단원으로

`GRADE6_SEMESTER1_UNITS` → `GRADE6_SEMESTER2_UNITS`. 이름이 이미 낡아 있었다(첫 항목이 `g6s2-unit2`였다).

| 단원 | 성취기준 | AI / 교사·AI / 교사 |
|---|---|---|
| 1단원 줄거리 간추리기 | 아직 없음 | 채점기준 없음 |
| 2단원 면담 보고서 쓰기 | 6국01-04 | 4 / 0 / 2 |
| 3단원 매체 성찰 보고서 쓰기 | 6국06-04, 6국03-06 | 3 / 0 / 2 |
| 5단원 기사문 작성하기 | 6국03-04 | 2 / 3 / 1 |
| 6단원 이야기 바꾸어 쓰기 | 6국05-05 | 3 / 0 / 3 |

계획서가 "성취기준은 단원당 1개"로 확정해 뒀는데 **매체 단원이 2개**여서 `standard` 객체를 `standards` 배열로 바꿨다. 6단원은 자료에 "청크 따로 없음"이라 청크 `label`을 `null`로 두고 보드·프롬프트 양쪽에서 묶음 제목을 생략한다.

### 평가 주체에 세 번째 종류를 만들었다

자료에 **"교사재량 but 피드백은 가능하다"**고 적힌 항목이 세 개 있었다(기삿거리·제목·사실전달). 선생님이 판정하지만 학생이 조언을 받아 고칠 수는 있는 항목이다. `ai`/`teacher` 둘로는 표현이 안 돼서 `teacher-ai-feedback`을 넣었다.

- **AI는 판정한다** — 그래야 그 항목에 관해 미션을 쓸지 말지 정할 수 있다
- **보드는 그 판정을 안 보여준다** — `—`와 `교사·AI` 배지만 나온다. 그 항목에서는 선생님 판정이 최종이다

관문이 둘로 나뉜 셈이다. `getAiRubrics`는 `teacher`만 걸러내고, `showsAiVerdict`가 화면에서 막는다. 단원마다 테스트로 고정했다.

### 파이프라인이 면담 보고서 전용이 아니게 됐다

`lib/coaching.js`에 박혀 있던 것들을 전부 단원에서 끌어오게 바꿨다.

- 스키마 상수 2개 → `buildAssessmentSchema` / `buildMissionSchema`가 루브릭에서 생성. enum과 개수가 데이터와 어긋날 수 없다
- 프롬프트에 흩어져 있던 기준별 규칙 14줄 → 기준의 `assessmentNotes` / `missionNotes`로 이동
- `REFINEMENT_SEEDS`(missions.js) → 기준의 `refinementSeed`
- `INTERVIEW_FALLBACK_TITLE_BY_CRITERION` → 기준의 `fallbackMissionTitle`
- "면담 내용을 지어내지 마" 같은 단원 고유 문구 → 단원의 `missionGuidance.grounding` / `.selfFill`. 규칙 목록 안 **고정된 자리**에 들어가서, 단원이 바뀌어도 나머지 규칙 순서가 안 흔들린다
- 이름: `getInterviewReportFeedback` → `getRubricCoachingFeedback`, `buildInterview*Prompt` → `build*Prompt`, `validateInterview*` → `validate*`
- 한국어 조사 처리를 넣었다 — 프롬프트가 단원 이름을 부르므로 `기사문을` / `면담 보고서를`을 골라야 한다

라우팅도 장르가 아니라 단원으로 바뀌었다(`resolveCoachingSpec`). **단, 장르 판정으로 되돌아가는 길을 남겼다** — DB에 이미 있는 활동 중에 없어진 `g6s1-*` 단원 id를 가진 것들이 있고, 그중 면담 보고서가 있으면 코칭이 끊길 수 있었다.

### 면담 보고서 프롬프트가 안 바뀌었는지 대조했다

이 개편의 유일한 위험은 **실제로 돌아가던 유일한 프롬프트를 건드리는 것**이었다. 개편 전 모듈을 `git show HEAD:`로 꺼내 같은 입력으로 프롬프트를 만들어 문자열 비교했다.

| 대조 | 결과 |
|---|---|
| 판정 프롬프트 (3441자) | **완전히 동일** |
| 판정 스키마 / 미션 스키마 | **완전히 동일** |
| 미션 프롬프트 | 44줄 모두 같고 **인접한 두 규칙의 순서만 뒤바뀜** (`learned-facts` ↔ `preparation`) |

순서가 바뀐 건 기준별 규칙이 이제 루브릭 순서를 따르기 때문이다. 규칙 목록 안에서 인접한 두 항목이 자리를 바꾼 것이라 의미는 같다.

### 검증

`npm test` **207개 통과**(150 → 207), `npm run lint` 무경고, `npm run build` 성공.

브라우저 실측(임시 Playwright, 프로덕션 DB에는 **아무것도 쓰지 않았다** — `.env.local`이 Neon 프로덕션을 가리키고 있어서 읽기만 했다):

| 확인한 것 | 결과 |
|---|---|
| 단원 카드 | 2학기 5개가 뜨고, 1단원 선택 시 목표 글자 수가 권장 400자로 따라옴 |
| 보드 4칸 (325px 카드) | 카드 내부 268px에 16/168/14/14/43px. 라벨 줄바꿈 없음 |
| `교사·AI` 배지 | 실제 필요 폭 37.5px < 확보 43.2px. 배지 칸을 1.9rem → 2.7rem으로 넓혔다 |
| 가장 긴 라벨(`돌아본 까닭·목적이 드러난다`) | 135.3px < 167.5px, 줄바꿈 없음 |
| 범례 | 그 단원이 실제로 쓰는 배지만 설명 (교사·AI가 없는 단원에서 안 뜸) |
| 스크롤 컨트롤 | 화살표 350px 단위 이동, 드래그, 두 스크롤바 동기화 모두 그대로 |
| 성취기준 2개 | 나란히 표시. 코드 사이 공백이 빠져 있어 고쳤다 |

### 남은 것

- **3·5·6단원 프롬프트는 Gemini에 한 번도 안 태워봤다.** 프롬프트 생성까지만 확인했다
- 6단원 `cause-and-effect` / `story-flow`는 자료에 "AI : 생각해봐야함"으로 적혀 있어 일단 `ai`로 넣었다
- 1단원 채점기준, 3단원 실제 단원 번호는 아직 확인 필요
