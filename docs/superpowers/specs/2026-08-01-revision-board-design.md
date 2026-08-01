# 학생 글쓰기 수정 진행 대시보드 — 설계

**날짜:** 2026-08-01
**레퍼런스:** `design-reference/학생 글쓰기 수정 진행 대시보드.png`
**대상 화면:** `/dashboard/[activityId]/students/[submissionId]` (교사용)

## 왜

면담 보고서 파일럿은 라운드마다 루브릭 판정(`round.assessments`, 기준 7개)을 이미 저장하고 있는데 **화면이 그걸 하나도 쓰지 않았다.** 교사는 "도달도가 몇 % 올랐다"만 볼 수 있었고 *어느 기준이 좋아졌는지*는 알 수 없었다.

기존 화면은 학생용 `RevisionHistory`를 `layout="horizontal"`로 재사용해 라운드 카드를 가로로 늘어놓기만 했다. 이 설계는 교사용 보드를 별도 컴포넌트로 분리하고, 카드 하나에 **채점기준표 판정 + 직전 라운드 대비 변화 + 그 라운드의 수정 미션과 반영 결과 + 글 diff**를 담는다.

**저장된 데이터만으로 전부 그린다** — DB 스키마, Gemini 프롬프트, 평가 파이프라인은 건드리지 않았다.

## 목업과 다르게 간 것

| 목업 | 구현 | 까닭 |
|---|---|---|
| 채점기준표 6줄, 라벨 재작성 | **실제 기준 7개 그대로** (`shortLabel` 신설) | 표시와 저장 데이터가 어긋나면 유지가 안 된다 |
| "기준 보기" 버튼 + "채점기준표를 클릭하면 AI의 판단 근거를 확인할 수 있어요" + "사용 가이드 보기" | **전부 제외** | `INTERVIEW_ASSESSMENT_SCHEMA`에 근거 필드가 없다. 넣으려면 프롬프트 수정 + 유료 라이브 평가 재실행이 필요해 별건으로 미룸 |
| 글 내용이 평문 | **diff 강조 유지**, 범례는 하단 안내 바로 이동 | 무엇이 바뀌었는지가 이 화면의 존재 이유 |
| 마지막 카드 배지 "최종" | **"최근"** | 코칭에 완료 상태를 두지 않는다는 파일럿 원칙과 충돌. `infiniteCoachingUi.test.js`가 소스에서 막는다 |
| 카드 1의 미션이 앰버(미판정) | **마지막 카드**의 미션이 앰버 | 미션은 *다음* 라운드가 판정한다. 아직 판정이 없는 건 최신 라운드뿐이다 |

## 구조

**`lib/revisionBoard.js`** — 저장된 라운드를 화면 행으로 바꾸는 순수 함수. `lib/revisionBoard.test.js`가 덮는다.

- `getRubricRows(genre, round, previousRound)` → 기준별 `{ id, label, status, trend }`. `getRubricsForGenre`가 기준 순서·라벨을 정하므로 카드마다 표가 같은 순서로 읽힌다. 루브릭 없는 장르나 파일럿 이전 라운드는 빈 배열
- `getTrend(previousStatus, status)` → `unmet 0 < partial 1 < met 2` 랭크 비교로 `up`/`down`/`same`, 첫 라운드는 `null`
- `getMissionRows(round, nextRound)` → 그 라운드가 낸 미션 + **다음** 라운드의 `priorMissionStatuses` 판정. 다음 라운드가 없으면 `pending`. 레거시 `improvements`/`addressed`도 흡수

**`components/RevisionBoard.jsx`** — 보드 본체. 상태가 없어 **Server Component**다. 카드 트랙은 `tabIndex={0}`이라 키보드로도 스크롤된다. 상태 글리프(`○ △ ✕`, `– ↑ ▼`)는 색이 아니라 모양으로도 구분되고 `aria-label`로 뜻을 붙였다. 채점기준표는 진짜 `<table>` + `<th scope="row">`.

**`components/SignOutButton.jsx`** — `TeacherHeader`에서 로그아웃 폼만 뽑아낸 것. 이 페이지는 `TeacherHeader`가 이메일에 쓰는 자리를 도달도 카드에 내주므로 헤더를 직접 조립한다.

**카드 제목은 1부터 센다** — 첫 코칭 라운드가 "1차 수정"이고 `초안` 배지가 붙는다. 학생 화면(`RevisionHistory`)은 같은 라운드를 여전히 "초안"이라 부른다. 대상이 다르므로 일부러 어긋나게 뒀다.

## 장르 분기

모든 장르가 같은 보드를 쓴다. 면담 보고서가 아니면 `round.assessments`가 없으므로 **채점기준표 섹션과 그 범례만 사라지고**, 미션·diff·글자 수는 그대로 나온다.

## 검증

- `npm test` 146개 통과 (`lib/revisionBoard.test.js` 14개 신규), `npm run lint` 무경고
- Prisma로 4라운드짜리 면담 보고서와 2라운드짜리 일기를 직접 시드해(Gemini 호출 없음) 로컬에서 스크린샷 확인
- 확인된 것: 카드 4개가 `.container-widest` 안에 스크롤 없이 들어감 · 변화 화살표가 직전 라운드 대비로 맞음 · 최신 카드 미션이 앰버 · 일기에서는 채점기준표만 빠지고 나머지 정상
