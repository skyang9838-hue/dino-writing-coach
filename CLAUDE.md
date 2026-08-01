# CLAUDE.md

초등학생용 교실 글쓰기 코치. 교사가 활동을 만들고, 학생은 참여 코드로 들어와 글을 쓰며 AI(Gemini) 코칭을 반복해서 받는다.

## 문서 지도

| 알고 싶은 것 | 볼 문서 |
|---|---|
| 지금 어디까지 왔고 다음에 뭘 하나 | [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) ← **세션 시작 시 여기부터** |
| 화면·기능이 실제로 어떻게 동작하나 | [docs/FEATURES.md](docs/FEATURES.md) |
| 예전에 무슨 작업을 했나 | [docs/CHANGELOG.md](docs/CHANGELOG.md) (기록 보관용, 평소엔 안 읽어도 됨) |
| 진행 중인 작업의 설계/계획 | `docs/superpowers/specs/`, `docs/superpowers/plans/` |
| 이미 끝난 작업의 설계/계획 | `docs/superpowers/archive/` |

**PROJECT_STATUS.md는 1페이지로 유지한다.** 작업이 끝나면 그 내용은 CHANGELOG.md 아래에 덧붙이고 STATUS에서는 뺀다.

## 스택

Next.js 16 (App Router, Turbopack) · React 19 · Prisma 7 + Postgres(Neon) · Auth.js v5(Google OAuth) · Gemini `gemini-2.5-flash-lite` · Vitest · oxlint · Vercel 배포

## 명령어

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm test         # Vitest 전체
npm run lint     # oxlint
npm run build    # 프로덕션 빌드
npm run eval     # 면담 보고서 프롬프트 라이브 평가 (Gemini 실호출, 유료)
                 # 예: npm run eval -- --set dev --runs 3
```

## 커밋 / 배포 방침 (2026-07-11 확정)

- 작업이 끝나면 **로컬 커밋까지만** 자동으로 한다.
- **GitHub push와 Vercel 배포는 사용자가 명시적으로 요청할 때만.** 매 요청마다 새로 확인한다 — 지난번 승인이 다음번까지 이어지지 않는다.
- GitHub push로 Vercel 자동 배포가 걸리지 않는다(2026-07-12 확인). 배포는 `vercel --prod`를 직접 실행해야 한다.

## 로컬에서 교사 화면 테스트하기

`/login`의 **"🧪 테스트 교사로 로그인"** 버튼을 쓰면 Google OAuth 없이 교사 세션을 얻는다.
`lib/devLogin.js`에 있고 `NODE_ENV=production`에서는 비활성화된다. Playwright 자동화에도 쓸 수 있다.

## 함정

- **Prisma 7의 생성 클라이언트가 `.ts` 파일이다.** `typescript` devDependency가 빠지면 빌드가 깨진다. import 확장자는 실제 파일 확장자(`.ts`)를 그대로 써야 한다.
- **마이그레이션**: 로컬은 `npx prisma migrate dev`(`prisma.config.js`의 직접 연결 사용), 배포는 `vercel-build` 스크립트가 `prisma migrate deploy`를 자동 실행한다.
- **Google OAuth 리다이렉트 URI**는 `http://localhost:3000/...`과 배포 도메인 둘 다 등록되어 있어야 한다. 커스텀 도메인을 붙이면 URI도 함께 추가한다.
- **새 환경에서 시작할 때**는 `vercel env pull .env.local`로 환경변수를 받아야 한다 (`GEMINI_API_KEY`, `DATABASE_URL`, `AUTH_*` 등).
- **가드 임계값은 검증되지 않은 첫 추정치다.** `lib/guard.js`의 `JAMO_RUN_MIN_LENGTH`(8) / `REPEATED_CHAR_MIN_LENGTH`(12) / `JAMO_RATIO_THRESHOLD`(0.3) / `WHITESPACE_RATIO_THRESHOLD`(0.5)는 실제 학생 글 샘플로 맞춘 값이 아니다. 오탐/미탐이 나오면 이 상수만 조정하면 된다.
- **UI/E2E 테스트는 상주하지 않는다.** Vitest는 로직만 덮고, 화면 검증은 그때그때 임시 Playwright 스크립트로 한다.
- **참여 코드**는 6자리이며 충돌 시 최대 5회 재시도한다 (코드 스페이스 32^6).

## 작업 스타일

- AI가 손대는 범위를 넓히지 말 것 — 요청한 것만 바꾸고, 곁다리 리팩터링을 끼워 넣지 않는다.
- 교사 화면은 여백을 넉넉히 쓰고, 선택지는 드롭다운보다 칩(chip)을 선호한다.
- UI 작업은 스크린샷을 찍어 사용자에게 보여주고 피드백을 받아 반복한다.
