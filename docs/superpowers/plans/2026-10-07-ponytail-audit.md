# Ponytail 점검 결과 (2026-10-08)

계획: [2026-10-07-ponytail-cleanup.md](2026-10-07-ponytail-cleanup.md) 2단계. 코드는 고치지 않았다.

기준선 (master `30e59a8`): `npm test` 254개 통과 · `npm run lint` 경고 0 · `npm run build` 성공.
작업 장소: Drive 폴더에서 `npm install`을 하면 node_modules 파일 대부분이 0바이트로 깨져서, 스크래치패드에 저장소를 복제해 돌렸다.

## 고를 수 있는 것 (🟢 안전 · 🟡 중간)

| # | 위험 | 종류 | 무엇을 줄이나 | 줄 수 |
|---|---|---|---|---|
| 1 | 🟡 | reuse | `RevisionBoard.jsx`와 `RevisionHistory.jsx`에 `FLAG_REASON_LABELS`·`flagReasonLabel`·`renderWritingDiff`가 똑같이 두 번 있다 → 공용 파일 하나로 모은다 (교사 보드·학생 화면 둘 다 영향) | -18 |
| 2 | 🟢 | reuse | `lib/revisionBoard.js`의 `RUBRIC_STATUS_RANK`가 `lib/assessmentRatchet.js`의 `STATUS_ORDER`와 같은 값이다 → 가져다 쓴다 | -8 |
| 3 | 🟡 | shrink | `lib/actions.js`의 `runRubricRound`·`runCoachingRound`에 `CoachingApiError` 처리 블록이 똑같이 두 번 있다 → 함수 하나로 모은다 | -5 |
| 4 | 🟡 | shrink | `lib/missions.js` `selectMissionTargets`가 후보를 Map에 담았다가 배열로 한 번 더 옮긴다 → 처음부터 배열로 만든다 (미션 고르기 로직이라 🟡) | -10 |
| 5 | 🟢 | delete | `app/globals.css`의 `.chip-group`, `.chip-selected`는 어디서도 안 쓴다 | -10 |
| 6 | 🟡 | reuse | `RevisionHistory.jsx`의 "지난 미션 반영 확인" 상태 찾기가 `lib/revisionBoard.js` `getMissionRows`와 같은 일을 한다 → 재사용. 단, 옛 라운드의 상태 값 처리가 조금 달라서 학생 화면 기호가 바뀌지 않는지 확인해야 한다 | -8 |

## 🔴 위험 구역 (목록만, 이번엔 안 고침)

| # | 종류 | 내용 | 줄 수 |
|---|---|---|---|
| 7 | delete | `lib/curriculum.js`의 `GRADES`·`getRecommendedLength`는 테스트에서만 쓰인다 (앱 화면은 단원별 권장 글자 수를 씀) | -9, 테스트 -12 |
| 8 | — | `lib/coaching.js`(1,042줄)는 프롬프트·Gemini 호출이라 깊이 보지 않았다 | — |

## 줄이지 않기로 한 것
- `lib/interviewEval.js`·`scripts/eval-interview-report.js` — 픽스처가 옛 기준이라 지금은 의미 없지만, 재라벨링이 PROJECT_STATUS의 할 일로 남아 있다.
- 교사 페이지 세 곳의 `auth()` → `redirect('/login')` 반복 — `actions.js`의 `requireTeacher`를 내보내면 서버 액션으로 열려 버린다.
- `next.config.js`의 turbopack root — 상위 폴더 lockfile 혼동을 막는 설정이다.

net: 🟢·🟡 약 -59줄, 🔴 약 -21줄. 빼낼 의존성 0개.

## 결과 (2026-10-08)
사용자가 1~6 전부를 골랐다. `ponytail-cleanup` 브랜치에 1~5를 넣었다 (커밋 3개 + 문서 커밋 1개, -53줄).
- **6번은 되돌렸다.** `RevisionHistory.jsx`는 `'use client'`라서 `lib/revisionBoard.js`를 가져오면 `curriculum.js`(844줄)가 학생 브라우저로 내려간다.
- 3번은 줄 수가 그대로다. 중복은 없어졌지만 공용 함수와 주석이 그만큼 늘었다.
- 검증: test 254, lint 0, build 성공. 교사 보드(채점기준 단원·없는 단원)와 학생 기록 화면에 같은 라운드 데이터를 넣고 master 판과 렌더 HTML을 견줬더니 같았다. 임시 비교 테스트는 지웠다.
