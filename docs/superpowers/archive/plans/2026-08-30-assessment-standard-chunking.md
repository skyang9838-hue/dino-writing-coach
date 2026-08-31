> **완료 — 2026-08-31.** 두 커밋으로 나눠 끝냈다: `e48d3d8`이 구조(성취기준 → 청크 → 항목)와
> 면담 보고서 단원을, `73dcb9f`가 2학기 단원 5개와 3·5·6단원 채점기준을 넣고 파이프라인을
> 단원 구동식으로 바꿨다. 결과와 실측값은 [CHANGELOG](../../CHANGELOG.md) 맨 아래 두 항목.
>
> **계획과 달라진 것 세 가지**
> - "성취기준은 단원당 1개"로 확정했었으나 매체 단원이 2개여서 `standard` → `standards` 배열
> - `evaluator`가 `ai`/`teacher` 둘일 예정이었으나, 자료에 "교사재량 but 피드백은 가능하다"고
>   적힌 항목 때문에 `teacher-ai-feedback`이 하나 더 생겼다
> - "AI 판정 파이프라인은 면담 보고서 전용 그대로, 다른 단원으로 확장하지 않음"이 **범위 밖**이었는데,
>   사용자가 확장을 선택해서 이번에 함께 했다

# 채점기준 구조 개편 — 성취기준 → 청크 → 채점 항목

## Context

교사의 수정 진행 보드(`components/RevisionBoard.jsx`)는 지금 채점기준 7개를 **평평한 표 하나**로 그린다. 그런데 데이터에는 이미 2단계 구조가 있다 — `lib/curriculum.js`의 `INTERVIEW_REPORT_RUBRICS`는 루브릭 3개가 각각 채점기준을 품고 있는데, `lib/revisionBoard.js:36`의 `getRubricRows`가 `flatMap`으로 그 층을 뭉개버린다. **청킹은 데이터에 있는데 화면에 안 드러나 있다.**

여기에 두 가지가 빠져 있다.

- **성취기준 레벨이 없다.** 코드 전체에 `성취기준`이 한 번도 안 나온다. `docs/FEATURES.md:217`에 "2022 교육과정 성취기준 데이터 구조화는 범위가 커서 의도적으로 제외"라고 적혀 있다.
- **AI가 판정하는 항목과 교사가 직접 보는 항목이 구분되지 않는다.** 7개 전부 Gemini가 판정한다.

이 개편의 목적은 **사용자가 이미 분석해 둔 단원별 성취기준·청킹·채점 항목을 부을 그릇을 만드는 것**이다. 이번엔 6학년 2학기 단원 목록과 면담 보고서 단원 하나를 진짜 데이터로 채우고, 나머지 단원의 채점기준은 다음 회의에서 넣는다.

기준 목업: `design-reference/current-teacher-ui.png` (파일명과 달리 현재 화면이 아니라 목표 목업이다). 카드 구조와 정보 밀도만 참고하고 그대로 베끼지 않는다.

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 데이터 위치 | 코드 상수 (`lib/curriculum.js`). 교사 저작 없음 |
| 채점기준을 매다는 곳 | **단원** (장르 아님). 같은 장르라도 단원마다 성취기준이 다르다 |
| 성취기준 개수 | 단원당 1개 |
| 성취기준 표시 | **보드 상단에 한 번만.** 카드마다 반복하지 않음 |
| 성취기준 펼침 | 아래로 펼쳐지고 카드가 밀림 (`<details>`) |
| 교사 재량 항목 | **표시만 — 항상 `—`.** 교사 입력 없음. 보드는 읽기 전용 유지 |
| 행 배치 | **4칸** — 항목명 / AI 판정 / 직전 대비 변화 / 평가 주체 배지 |
| 회차 가로 비교 | **반드시 유지** |
| 단원 목록 | 6학년 1학기 목업 8개를 폐기하고 2학기 5개로 교체 |
| AI 판정 파이프라인 | 면담 보고서 전용 그대로. 다른 단원으로 확장하지 않음 |

## 받아야 할 데이터 (사용자가 제공)

> ⚠️ **이 데이터 없이는 착수하지 않는다.** 사용자가 다음 세션에 한꺼번에 준다. 청킹이 기존 7개 채점기준을 어떻게 다시 묶느냐에 따라 아래 "위험" 항목의 범위가 달라지므로, 데이터를 받은 뒤 `lib/coaching.js`를 건드리는지 여부를 먼저 확정하고 시작한다.

**단원 목록 (6학년 2학기)**

| 단원 | 제목 | 필요한 것 |
|---|---|---|
| 1 | 줄거리 간추리기 | 장르(`GENRES`에 없음 — 신설 필요), 권장 글자 수, 아이콘 |
| 2 | 면담 보고서 작성하기 | ✅ 면담 보고서 / 600자 / 🎤 |
| ? | 매체 (매체 성찰 보고서) | **단원 번호**, 장르, 권장 글자 수, 아이콘 |
| 5 | 기사문 작성하기 | 권장 글자 수 (기사문 ✓) |
| 6 | 경험을 떠올리며 이야기 바꾸어 쓰기 | 장르(이야기(창작)?), 권장 글자 수 |

**면담 보고서 단원의 채점기준**
- 성취기준 코드 + 전문
- 청크 이름들 (목업의 `A. 면담의 절차` / `B. 상대와 매체 고려` 같은 짧은 이름)
- 청크마다 들어갈 채점 항목, 항목별 `ai` / `teacher` 구분
- 기존 AI 판정 7개(`purpose` `interviewee` `new-fact` `fact-detail` `opening` `body` `closing`)를 새 청크에 어떻게 나눠 담을지

## 자료 구조

`lib/curriculum.js`에서 단원이 성취기준과 청크를 직접 들고 있게 한다.

```js
export const GRADE6_SEMESTER2_UNITS = [
  {
    id: 'g6s2-unit2',
    unitNumber: 2,
    icon: '🎤',
    title: '면담 보고서 작성하기',
    description: '…',
    genre: INTERVIEW_REPORT_GENRE,
    recommendedLength: 600,

    // 새로 추가되는 두 필드
    standard: { code: '6국01-04', text: '면담의 목적과 절차를 알고 …' },
    chunks: [
      {
        id: 'interview-procedure',
        label: '면담의 절차',
        criteria: [
          // AI 항목: 지금 INTERVIEW_REPORT_RUBRICS가 들고 있던 필드를 그대로 옮긴다
          { id: 'purpose', evaluator: 'ai', label: …, shortLabel: …,
            priority: 30, statuses: { met, partial, unmet }, missionSeed: … },
        ],
      },
      {
        id: 'audience-and-medium',
        label: '상대와 매체 고려',
        criteria: [
          // 교사 항목: statuses / missionSeed / priority 없음 — AI가 안 쓰므로
          { id: 'audience', evaluator: 'teacher', label: '상대를 고려했는가?', shortLabel: … },
        ],
      },
    ],
  },
  // … 나머지 4개 단원은 standard / chunks 없이 (다음 회의에서 채움)
]
```

**핵심 규칙: `evaluator: 'teacher'` 항목은 AI가 절대 못 본다.** 판정 프롬프트에도, 스키마 enum에도, `selectMissionTargets`의 후보에도 들어가지 않는다.

새 조회 함수 (`lib/curriculum.js`):

- `getUnitById(unitId)` — 이미 있음, 배열 이름만 바뀜
- `getUnitStandard(unitId)` → `{ code, text }` 또는 `null`
- `getUnitChunks(unitId)` → 화면용 전체 청크 (교사 항목 포함)
- `getAiRubrics(unitId)` → **AI 판정 파이프라인용.** 청크에서 `evaluator === 'ai'` 항목만 남기고 빈 청크는 버려서, `buildInterviewAssessmentPrompt`가 지금 받는 것과 **똑같은 모양**(`[{ id, label, criteria }]`)으로 돌려준다. 이 함수가 파이프라인과 화면 사이의 방화벽이다.
- `getRubricsForGenre`는 삭제 (`curriculum.js:251`)

## 변경할 파일

### 1. `lib/curriculum.js`
- `GRADE6_SEMESTER1_UNITS` → `GRADE6_SEMESTER2_UNITS` (이름이 이미 낡았다 — 첫 항목이 `g6s2-unit2`다). 8개 목업 단원을 2학기 5개로 교체
- `INTERVIEW_REPORT_RUBRICS`를 면담 단원의 `chunks`로 흡수. 기존 채점기준 7개의 `id` / `statuses` / `priority` / `missionSeed`는 **글자 하나 안 바꾸고** 그대로 옮긴다
- 새 장르 2개 추가 (1단원, 매체 단원) — `GENRES` + `GENRE_COACHING_GUIDANCE` + `GENRE_ICONS`
- 위 조회 함수들 추가, `getRubricsForGenre` 제거

### 2. `lib/revisionBoard.js`
- `getRubricRows(genre, round, previousRound)` → `getChunkRows(unitId, round, previousRound)`
- 평평한 배열 대신 **청크별로 묶인** 구조를 돌려준다:
  ```js
  [{ id, label, rows: [{ id, label, evaluator, status, trend, index }] }]
  ```
- `evaluator === 'teacher'` 행은 `status`/`trend`가 항상 `null` — `round.assessments`를 아예 안 뒤진다
- `getTrend`와 `getMissionRows`는 그대로

### 3. `components/RevisionBoard.jsx`
- prop이 `genre` → `unitId`
- 보드 상단에 성취기준 `<details>` 추가 (`<summary>`에 `성취기준 [6국01-04]`, 펼치면 전문). 자바스크립트 불필요 — `BoardTrack`은 클라이언트 컴포넌트지만 이건 서버에 남는다
- `RubricTable` → `ChunkSection` — 청크마다 헤더 + 번호 붙은 항목 행, 4칸
- 배지 컴포넌트 추가: `AI` / `교사`
- 범례에 "평가 주체" 그룹 추가. `RUBRIC_MARKS`에 "해당 없음(`—`)" 추가

### 4. `app/dashboard/[activityId]/students/[submissionId]/page.js`
- `<RevisionBoard genre={…} rounds={…} />` → `unitId={submission.activity.unitId}`

### 5. `app/globals.css`
- `.board-rubric-table` 계열을 청크 구조에 맞게. `.board-standard`(상단 details), `.board-chunk`, `.board-chunk-title`, `.board-criterion-row`, `.evaluator-badge` 추가
- 카드는 325px 유지 — 4칸이 들어가는지 실측 확인이 필요하다

### 6. `lib/coaching.js` — **청킹이 기존 7개를 다시 묶을 때만**
- `INTERVIEW_ASSESSMENT_SCHEMA`의 `rubricId` enum (`coaching.js:57`) — 새 청크 id로
- `INTERVIEW_MISSION_SCHEMA`의 strength `rubricId`/`criterionId` enum (`coaching.js:94,98`)
- `INTERVIEW_REPORT_RUBRICS` import → `getAiRubrics('g6s2-unit2')`의 결과를 기본값으로

`criterionId`는 안 바뀐다. 판정 원칙 30여 줄(`coaching.js:227~254`)도 criterionId만 지목하므로 안 바뀐다. `selectMissionTargets`의 `mergePair`도 criterionId 기반이라 안 바뀐다.

### 7. 테스트
`lib/curriculum.test.js` · `lib/revisionBoard.test.js` · `components/infiniteCoachingUi.test.js` · `lib/coaching.test.js` · `lib/actions.test.js` 다섯 곳이 `GRADE6_SEMESTER1_UNITS` / `getRubricsForGenre` / `genre` prop을 참조한다. 새 구조에 맞춰 갱신하고, **교사 재량 항목이 AI 프롬프트·스키마·미션 후보에 절대 안 들어간다**는 테스트를 새로 추가한다.

## 위험

- **`rubricId`가 바뀌면 프롬프트 텍스트가 바뀌고, 프롬프트가 바뀌면 모델 판정이 바뀔 수 있다.** 면담 보고서 파일럿은 `npm run eval`(Gemini 실호출 품질 게이트)을 **한 번도 통과한 적이 없다**(`docs/PROJECT_STATUS.md:63`). 청킹이 기존 3개 루브릭과 다르게 묶이면, 이 개편은 미검증 프롬프트를 또 한 번 건드리는 셈이다. 청킹이 3개 루브릭과 일치하면 이 위험은 사라진다 — 데이터를 받고 판단한다.
- **저장된 라운드의 `assessments`에는 옛 `rubricId`가 들어 있다.** 화면은 `criterionId`로만 조회하므로(`revisionBoard.js:26` `statusOf`) 안전하다. 마이그레이션 불필요.
- **`Activity.unitId`는 nullable이다.** 2026-07-15 이전 활동엔 없다. 하지만 면담 보고서 파일럿은 2026-07-30에 시작했고 `createActivity`가 단원을 강제하므로(`lib/actions.js:151`), 채점기준이 있는 활동은 전부 `unitId`를 갖는다. `unitId`가 없으면 채점기준표를 생략한다 — 지금 장르 없을 때와 같은 동작.
- **단원 id를 갈아치우면 기존 활동의 `unitId`가 죽는다.** `getUnitById`는 활동 *생성 시점*에만 쓰이고 화면은 `genre`/`title`/`targetLength` 컬럼으로 그리므로 안 깨진다. 로컬 검증 활동 `VRFY01`도 그대로 열린다. **단, `g6s2-unit2`(면담 보고서) id는 반드시 유지한다** — 채점기준이 붙는 유일한 단원이라서.

## 범위 밖 (이번에 안 함)

- AI 판정을 면담 보고서 외 단원으로 확장 — 단원별 판정 프롬프트·검증 규칙이 필요한 별개의 큰 작업
- 교사가 재량 항목에 판정을 입력하는 기능 — 표시만 하기로 결정
- 교사의 채점기준 저작 UI, Prisma 스키마 변경
- 학생 화면(`components/RevisionHistory.jsx`) — 채점기준을 원래 안 보여준다
- `npm run eval` 실행 (유료, 사용자 확인 필요)

## 착수 순서

1. 사용자에게서 위 데이터를 한꺼번에 받는다
2. **청킹이 기존 3개 루브릭과 일치하는지 먼저 확인한다.** 일치하면 `lib/coaching.js`는 안 건드린다 (위험 없음). 다르면 `rubricId` enum 2곳을 바꿔야 하므로 사용자에게 알리고 진행한다
3. `lib/curriculum.js` → `lib/revisionBoard.js` → `components/RevisionBoard.jsx` → CSS 순으로 안쪽부터 바깥으로
4. 아래 검증

## 검증

1. `npm test` · `npm run lint` — 실패하면 고치지 말고 보고
2. **로컬 앱 실측** — `/login`의 "🧪 테스트 교사로 로그인"으로 들어가 `VRFY01`(검증학생, 7라운드)의 보드를 연다. 확인할 것:
   - 성취기준 줄이 상단에 한 번만 나오고, 클릭하면 전문이 펼쳐지며 카드가 아래로 밀린다
   - 카드 안에 청크가 이름과 함께 나뉘어 보이고, 항목마다 번호가 붙는다
   - 교사 재량 항목이 `—`와 `교사` 배지로 나오고, AI 항목은 판정·변화·`AI` 배지가 4칸에 들어간다
   - **325px 카드 안에서 4칸이 줄바꿈 없이 들어가는지** — 안 들어가면 항목명 폭이나 배지 크기를 조정
   - 회차 가로 비교, 스크롤 화살표·드래그·두 스크롤바 동기화가 그대로 동작한다 (`BoardTrack` 미변경)
3. 스크린샷을 찍어 사용자에게 보여주고 피드백을 받아 반복 (CLAUDE.md 작업 스타일)
4. 새 활동 만들기 화면에서 2학기 단원 5개가 카드로 뜨고, 단원을 고르면 권장 글자 수가 따라오는지 확인
