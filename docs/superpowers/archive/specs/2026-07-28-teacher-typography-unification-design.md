# 교사 화면 타이포그래피/카드 통일 디자인

## 배경

교사용 두 화면 — "새 활동 만들기" (`components/NewActivityForm.jsx` + `app/dashboard/page.js`)와 "초대 화면" (`app/dashboard/[activityId]/page.js`) — 을 감사한 결과, 다음과 같은 임의적 불일치가 발견됨:

- 두 화면의 섹션 제목(`<h2>`)이 각각 인라인 `style={{ fontSize: '1.2rem' }}` / `style={{ fontSize: '1.1rem' }}`으로 서로 다르게 하드코딩되어 있고, 공통 클래스가 없어 굵기/색상도 명시되지 않음 (`app/dashboard/page.js:69`, `app/dashboard/[activityId]/page.js:48`).
- 카드 모서리 반경이 `.unit-card`(12px)와 `.join-info-card`/`.activity-card`(14px)로 갈림 (`app/globals.css:126-138, 912-924, 977-985`).
- 전역 폰트가 `system-ui, 'Segoe UI', Roboto, sans-serif` 하나뿐이라(`app/globals.css:7`) Windows에서 맑은 고딕으로 렌더링되어, 공룡 마스코트를 쓰는 아이들 대상 서비스치고 밋밋하고 사무적인 인상을 줌 — 사용자가 브라우저 시안을 보고 직접 지적함.

목표는 이 두 화면뿐 아니라 앞으로 만들 다른 교사 화면에도 재사용할 수 있는 최소한의 공통 규칙(공유 CSS 클래스, 디자인 토큰 없이)을 정하는 것.

## 브라우저 시안 확정 사항

`typography-proposal-v2.html` 시안에서 사용자가 승인함 ("ㅇㅇ 좋아").

### 1. 폰트: Pretendard

- 전역 `font-family`를 Pretendard로 교체. Pretendard Variable을 `next/font/local`로 self-host (CDN `@import` 방식은 시안 비교용이었을 뿐, 실제 구현은 외부 요청 없이 npm 패키지 `pretendard`로 로컬 서빙).
- `system-ui, 'Segoe UI', Roboto, sans-serif`는 fallback으로 유지.

### 2. 섹션 제목(`h2`) 통일

- 새 공유 클래스 `.section-heading`: `font-size: 1.2rem; font-weight: 700; color: #222;` (margin은 기존 인라인 값 유지).
- 적용 대상:
  - `app/dashboard/page.js:69`의 "🦕 새 활동 만들기" — 기존 `1.2rem` 인라인 스타일을 클래스로 교체 (수치 변경 없음, 굵기/색상만 명시화).
  - `app/dashboard/[activityId]/page.js:48`의 "참여 학생 (N명)" — 기존 `1.1rem` → `1.2rem`으로 통일.

### 3. 페이지 타이틀(`h1`) 클래스화

- `components/TeacherHeader.jsx:11`의 인라인 `style={{ fontSize: '1.4rem' }}`을 `.page-title` 클래스로 교체 (`font-size: 1.4rem; font-weight: 700; color: #222;`). 값 자체는 변경 없음 — 재사용 가능하게 만드는 것이 목적.

### 4. 카드 모서리 통일

- `.unit-card`의 `border-radius`를 12px → 14px로 변경, `.join-info-card`/`.activity-card`(이미 14px)와 통일.

### 5. 라벨 패턴은 의도적으로 유지

두 가지 라벨이 이미 존재하며 역할이 달라 통일하지 않음:
- **폼 라벨** (`.field label`, `app/globals.css:261-264`): 입력을 설명 — `1rem / 600 / 상속 색상(#222)`. 변경 없음.
- **강조 라벨** (`.topic-card-label`, `app/globals.css:346-351`): 참여 코드 등 중요한 값을 강조 — `0.85rem / 700 / #2e7d32`(브랜드 그린). 변경 없음.

이 두 패턴은 사용자 승인 시안에서 그대로 유지됨 — "폼 라벨과 강조 라벨은 역할이 달라 의도적으로 다르게 유지"로 명시.

## 범위 밖 (변경하지 않음)

- **아이콘 렌더링 3가지 패턴** (`unit-card-icon` 단독 이모지, `activity-card-icon` 배경박스 이모지, `TeacherHeader`의 인라인 이모지) — 각각 다른 문맥(선택 카드 / 목록 아이템 / 페이지 타이틀)에서 다른 역할을 하므로 통일하지 않음.
- **초대 화면에 `button-primary` 부재** — 초대 화면은 정보 표시 화면(코드/QR/명단)이라 별도 주요 액션 버튼이 필요 없다고 판단, 추가하지 않음.

## 영향받는 파일

- `dino-writing-coach/app/globals.css` — `.section-heading`, `.page-title` 클래스 추가, `.unit-card` radius 값 변경, `body` font-family 교체.
- `dino-writing-coach/app/layout.js` — Pretendard `next/font/local` 설정 추가.
- `dino-writing-coach/package.json` — `pretendard` 의존성 추가.
- `dino-writing-coach/components/TeacherHeader.jsx` — 인라인 `h1` 스타일 → `.page-title`.
- `dino-writing-coach/app/dashboard/page.js` — 인라인 `h2` 스타일 → `.section-heading`.
- `dino-writing-coach/app/dashboard/[activityId]/page.js` — 인라인 `h2` 스타일 → `.section-heading`.

## 검증

- `npm run dev` 실행 후 두 화면을 실제 브라우저에서 확인: 폰트가 Pretendard로 렌더링되는지, 두 섹션 제목 크기가 동일한지, 카드 모서리가 시각적으로 통일됐는지.
- 기존 스크린샷 기반 반복 피드백 스타일에 따라, 적용 후 스크린샷을 비교하며 조정.
