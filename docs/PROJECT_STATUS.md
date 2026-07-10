# 디노 글쓰기 코치 — 프로젝트 현황

> 이 문서는 세션이 끝날 때마다 갱신되는 "현재 상태 스냅샷"입니다. 다음 세션은 이 문서에서 시작하세요.
> 기능 자체의 구체적인 구현 스펙은 [`FEATURES.md`](FEATURES.md)를 참고하세요.

**마지막 갱신:** 2026-07-10 (교실 플랫폼 전환 세션 + 활동 생성 폼 개선)
**작업 브랜치:** `worktree-nextjs-classroom-mvp` (아직 `master`에 병합 전)
**GitHub 저장소:** https://github.com/skyang9838-hue/dino-writing-coach (public)
**배포 주소:** https://dino-writing-coach.vercel.app (이번 브랜치 병합 전까지는 기존 Vite 버전이 배포된 상태)

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
- `Submission` — 학생 1명의 활동 참여 기록. 기존 `sessionStorage.js`가 다루던 필드(`writing`/`feedback`/`attainment`/`rounds`/`lastSubmittedWriting`/`lastImprovements`)를 거의 그대로 컬럼으로 이전 + `status`(draft/submitted)와 `submittedWriting`/`submittedAt` 신규 추가.

**교사 화면**
- `/login` — Google 로그인
- `/dashboard` — 내 활동 목록 (참여 학생 수 표시)
- `/dashboard/new` — 활동 생성 폼(학년/글의 종류 칩 선택, 소재 입력, 목표 글자 수 드롭다운 — 아래 "추가 개선" 항목 참고)
- `/dashboard/[activityId]` — 참여 코드 + 참여 링크 + **QR코드**(`qrcode.react`, 학생이 타이핑 없이 스캔으로 입장 가능) + 참여 학생 목록(상태/도달도/코칭 횟수 — 원래 Phase 2 예정이었으나 데이터가 이미 있어 최소 형태로 함께 구현함)

**학생 화면**
- `/join/[joinCode]` — 이름 입력 → 기존 참여자면 기존 글로 복귀, 신규면 새 Submission 생성 (localStorage 불필요 — DB의 `(activityId, studentName)` unique 조합이 곧 복귀 키)
- `/write/[submissionId]` — 기존 `App.jsx`의 코칭/도달도/퇴고 히스토리/diff 로직을 서버 연동으로 이식. 목표 글자 수는 활동의 `targetLength`(교사가 정함, 기존 400자 고정 상수 제거). **제출하기 버튼 신규 추가**(PRD 1.6) — 제출 후에도 계속 수정·재코칭·재제출 가능.
- 자동저장: `writing` 변경 800ms 후 서버에 draft 저장(디바운스). 코칭/제출 시점에도 저장됨.

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

## Phase 1 이후 로드맵 (다음에 할 일)

0. **`master`에 병합 + Vercel 배포 전환** — 현재 배포 주소는 여전히 기존 Vite 버전. 병합 시 Vercel 프로젝트 설정에서 프레임워크 프리셋을 Next.js로 전환하고, 빌드 커맨드에 `prisma migrate deploy`가 포함되도록 확인 필요.
1. **Phase 2 — 교사 대시보드 고도화**: 학생별 초안↔최종본 diff 열람(기존 diff 엔진 재사용), 제출 현황 필터/정렬. (참여 학생 목록 자체는 Phase 1에서 이미 최소 구현됨)
2. **Phase 3 — 루브릭**: 표/이미지 업로드 + AI 파싱 + 충족 여부 체크(O/X만, 점수 없음), 교사가 고르는 피드백 우선순위(내용/구조/표현력 등)가 코칭 프롬프트에 반영
3. **Phase 4 — 가드**: 무의미한 글(자모 반복/욕설/복붙) 감지 가드. (학년별 권장 글자 수, 학년/글의 종류 선택은 이미 구현됨 — 2022 교육과정 성취기준 기반 AI 자동 생성은 의도적으로 범위에서 제외)

## 주의할 점 / 기술 부채

- **Prisma 7 + 생성된 클라이언트가 `.ts`**: `typescript` devDependency가 없으면 빌드가 깨짐. import 확장자는 실제 파일 확장자(`.ts`)를 써야 함.
- **마이그레이션 실행**: `npx prisma migrate dev`(로컬, `prisma.config.js`의 직접 연결 사용) → 배포 파이프라인에서는 `npx prisma migrate deploy` 필요(아직 Vercel 빌드 커맨드에 연결 안 함 — 병합 전 확인 필요).
- **이 브랜치는 아직 `master`에 병합되지 않음** — 배포 주소는 여전히 기존 Vite 버전. 병합/배포 시 Vercel 프로젝트의 프레임워크 프리셋을 Next.js로 바꿔야 함.
- **Google OAuth 리다이렉트 URI**: `http://localhost:3000/...`와 배포 도메인 두 개만 등록됨. 커스텀 도메인 추가 시 리다이렉트 URI도 함께 추가해야 함.
- **참여 코드 충돌**: 활동 생성 시 6자리 코드가 우연히 겹치면 재시도(최대 5회)하도록 되어 있음 — 코드 스페이스가 32^6이라 실사용 규모에서는 문제 없을 것으로 예상.
- Flexbox 중앙 정렬 관련 주의사항(2단계에서 겪은 `.container` 너비 버그)은 여전히 유효 — CSS는 대부분 그대로 이식됨.
- 정식 테스트 프레임워크(Vitest)가 이번에 처음 도입됨 — 다만 UI/E2E 테스트는 여전히 상주하지 않고 임시 Playwright 스크립트 관례를 유지.

## 다음 세션 시작 프롬프트 (복사해서 사용)

```
dino-writing-coach 프로젝트를 이어서 작업합니다 (브랜치: worktree-nextjs-classroom-mvp).
docs/PROJECT_STATUS.md에서 현재 상태와 로드맵을 확인해줘.
Phase 1(Next.js/DB/인증 전환) + 활동 생성 폼 개선(학년/글의 종류 칩, 소재 통합, 장르별 코칭)까지 완료됐고,
사용자가 교사측 Google 로그인과 새 활동 생성 폼을 직접 확인한 상태야.
이제 [master에 병합 및 Vercel 배포 전환 / Phase 2(교사 대시보드 diff 열람) / Phase 3(루브릭) / Phase 4(무의미한 글 감지 가드)] 중에서
[여기에 하나 선택 또는 "우선순위대로 제안해줘"]를 진행하고 싶어.
아직 코드는 수정하지 말고 계획부터 세워줘.
```
