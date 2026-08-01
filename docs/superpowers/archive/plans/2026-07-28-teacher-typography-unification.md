# 교사/학생 화면 타이포그래피 통일 + 레퍼런스 정합 구현 계획

> 스펙: `docs/superpowers/specs/2026-07-28-teacher-typography-unification-design.md`
> 레퍼런스: `design-reference/디노 교사화면.png`, `design-reference/디노 학생화면.png`

**목표:** 전역 폰트를 Pretendard로 바꾸고, 제목/카드 스타일을 공통 클래스로 통일하며, 새 활동 만들기 화면을 레퍼런스 이미지에 맞춘다.

**아키텍처:** `app/globals.css` 하나에 공통 클래스를 추가하고 각 컴포넌트가 인라인 스타일 대신 그 클래스를 쓰도록 교체. 폰트는 `next/font/local`로 self-host.

---

## Global Constraints

- 확정된 타이포 규칙은 그대로 유지: `.page-title` **1.4rem / 700 / #222**, `.section-heading` **1.2rem / 700 / #222**, 카드 모서리 **14px**.
- 폼 라벨(1rem/600)과 강조 라벨(0.85rem/700/#2e7d32)은 의도적으로 다르게 유지 — 통일하지 말 것.
- 학생 화면(`/join`, `/write`)의 진입 화면 패턴(2rem 중앙정렬 h1)은 손대지 않음.
- 로컬 커밋까지만. push/배포는 사용자 요청 시에만.

---

## Task 1: Pretendard 폰트 + 폼 컨트롤 폰트 상속

**문제:** `input`/`textarea`/`select`/`button`은 `body`의 `font-family`를 상속하지 않고 브라우저 시스템 폰트를 쓴다. 이 상태로 Pretendard를 적용하면 모든 입력칸과 버튼만 다른 폰트로 남는다. 특히 학생 글쓰기 textarea(`.write-panel textarea`, globals.css:466-468)는 `height`만 지정돼 있어 테두리/모서리/패딩도 없는 브라우저 기본 모양이다.

**Files:**
- Modify: `package.json` (pretendard 의존성)
- Modify: `app/layout.js` (next/font/local 설정)
- Modify: `app/globals.css` (body font-family, 폼 컨트롤 상속 규칙, `.write-panel textarea` 스타일 보강)

**변경 내용:**
- `body { font-family: var(--font-pretendard), system-ui, 'Segoe UI', Roboto, sans-serif; }`
- 신규 전역 규칙: `input, textarea, select, button { font-family: inherit; }`
- `.write-panel textarea`에 `.field textarea`와 동일한 테두리/패딩/모서리/line-height 부여 (height 420px 유지)

## Task 2: `.page-title` / `.section-heading` 공통 클래스

**Files:**
- Modify: `app/globals.css` (클래스 2개 추가)
- Modify: `components/TeacherHeader.jsx:11` — 인라인 `style={{fontSize:'1.4rem'}}` → `className="page-title"`
- Modify: `app/dashboard/page.js:69` — 인라인 1.2rem → `className="section-heading"`
- Modify: `app/dashboard/[activityId]/page.js:48` — 인라인 1.1rem → `className="section-heading"` (1.2rem으로 통일)

`.container h1` 규칙(globals.css:48-54)이 `text-align:center`를 걸고 있으므로 `.page-title`에 `text-align:left`를 명시해 덮어써야 한다.

## Task 3: 카드 모서리 14px 통일 + 성장과정 화면 정리

**Files:** `app/globals.css`

- `.unit-card` `border-radius: 12px` → `14px` (globals.css:136)
- `.history-item` `10px` → `14px` (globals.css:838) — 성장과정 화면의 주 콘텐츠 카드인데 배너 계열과 같은 10px에 남아 있었음
- `.history-item-title` `color: #333` → `#222` (globals.css:846)
- `.history-item-writing` `border: 1px` → `1.5px` (globals.css:855) — 앱 전체 표준

## Task 4: `.char-count` 셀렉터 버그

**Files:** `app/globals.css:480`

`components/WritingScreen.jsx:104`의 `<span className="char-count">`는 `.write-panel-header` 안에 있는데 CSS는 `.write-panel-footer .char-count`로 스코프돼 있어 규칙이 전혀 적용되지 않는다. 셀렉터를 `.char-count`로 바꿔 실제 사용처에 맞춘다.

## Task 5: 레퍼런스 정합 — 새 활동 만들기 화면

레퍼런스(`디노 교사화면.png`) 대비 현재 화면의 격차:

**Files:** `components/NewActivityForm.jsx`, `components/TeacherHeader.jsx`, `app/globals.css`

1. **단원 카드**: 아이콘 2rem → 3rem, 카드 패딩 확대, 제목 크기 상향(2줄 허용). 레퍼런스는 아이콘이 훨씬 크고 카드가 세로로 넉넉하다.
2. **섹션 헤더** "6학년 1학기 국어 활동 선택": 현재 폼 라벨(1rem/600) → `.section-heading`(1.2rem/700)로 승격.
3. **목표 글자 수**: 레퍼런스에는 프리셋 그리드 위에 드롭다운("600자 (권장)")이 있다. `lib/curriculum.js`의 `LENGTH_OPTIONS` 재사용해 드롭다운 추가, 프리셋 그리드는 2열 → 3열.
4. **필드 라벨 아이콘**: 오늘의 주제/학생에게 안내할 말/목표 글자 수 앞에 아이콘 추가.
5. **제출 버튼**: 현재 폼 전체 너비 → 레퍼런스처럼 좁게 가운데 정렬 + 아래 안내 문구.
6. **헤더 우측**: 이메일을 테두리 있는 칩으로, 로그아웃을 테두리 버튼으로 (현재는 둘 다 밑줄 회색 텍스트).

## 검증

1. `npm test` (Vitest 17개) 통과 확인 — CSS/마크업 변경이라 깨질 일은 없지만 회귀 확인.
2. `npm run build` 통과 확인 (next/font 설정이 빌드에서 깨지지 않는지).
3. dev 서버 + Playwright + `lib/devLogin.js`로 대시보드/새 활동/초대/성장과정/참여/글쓰기 전 화면 스크린샷 촬영, 레퍼런스 이미지와 나란히 비교하며 반복 조정.
4. 특히 확인할 것: Pretendard가 입력칸·버튼에도 적용됐는지, 학생 글쓰기 textarea가 테두리 있는 모양으로 나오는지, 글자 수 라벨이 작은 회색으로 나오는지.
