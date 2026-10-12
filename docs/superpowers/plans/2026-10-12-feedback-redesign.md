# DINO 피드백 개편: 구현 계획

## Context
설계안 → 코드 비교 → 측정(2,157회)을 거쳤고, 사용자가 GPT와 다듬은 최종 방향을 줬다(2026-10-12). 이번에는 그 방향을 **구현**한다. 근거는 dino 저장소 `docs/superpowers/specs/2026-10-12-feedback-redesign-design.md`(5-1절 측정)다. 측정에서 쓴 시제품 프롬프트는 `scripts/measure-feedback-redesign.js`에 있고, 그대로 옮겨 쓴다.

**확정된 것**
- 채점기준 코칭만 `gemini-3.8-flash` 생각 낮게. **채점기준 없는 단원(일반 코치)은 2.5-flash-lite 그대로.**
- 판정: 매 회차 판정. 직전보다 내려간 기준이 있을 때만 하락 확인 호출. 지난 미션 수행 판정은 지금처럼 판정과 **한 호출**.
- 미션: AI가 기준을 골라 3개. missionSeed 유지, priority 삭제. 이전 미션은 생성에 넘기지 않음. 글다듬기 없음. 모두 met이면 심화 미션.
- 학생: 미션 1~3개 선택. 선택 없으면 재코칭 버튼 꺼짐. 고른 미션만 판정. 미완료 미션은 그 회차로 끝.
- 판정 문구는 관대하게. 도달도는 그대로(40% · done당 +10% · 상한 없음).
- 교사 보드: ○/△/× 그대로, **▼만 다시 살아남**. 판정 근거나 "지킨 판정" 표시는 없음. 미션 결과 문구("해냈어요!" 등)는 **쓰지 않는다** — 기존 기호 유지.
- **보류 2건은 임의로 확정하지 않는다**: ① 모두 met일 때 미션 개수(A 3개 고정 / B 0~3개), ② 코드 검사(B 핵심만 / C 형식·무결성만). 둘 다 만들어 스모크로 비교해 보여 드리고, 사용자가 고른 뒤 안 쓰는 쪽을 지우고 배포한다.

## 작업 위치
`바탕화면\vibecoding\dino-writing-coach`, 브랜치 `feedback-redesign`. master push = 배포라서, 보류 2건이 정해질 때까지 master에 넣지 않는다.

## 바꿀 것

### 1. Gemini 호출 — `lib/coaching.js`
- `requestGeminiJson`/`callGeminiJson`이 `model`, `thinking`, `maxOutputTokens`를 받게 한다. 기본값은 지금처럼 `gemini-2.5-flash-lite`(일반 코치 `getGeminiFeedback`가 그대로 씀).
- `RUBRIC_MODEL = { model: 'gemini-3.8-flash', thinking: { thinkingLevel: 'low' } }`, 채점기준 호출은 `maxOutputTokens` 4096.
- 응답 텍스트는 `thought`가 아닌 part에서 꺼낸다 (측정 스크립트 `gemini()`와 같게).

### 2. 판정과 하락 확인
- `buildAssessmentPrompt`는 그대로 쓰되 `formatPriorMissionBlock`의 판정 기준을 측정 때의 관대 문구(`LENIENT_RULES`)로 바꾼다. `previousMissions`에는 **학생이 고른 미션만** 들어온다.
- `PRIOR_MISSION_SCHEMA` maxItems 2 → 3.
- `lib/assessmentRatchet.js`를 지우고 `lib/regressionCheck.js`를 새로 만든다: `findDrops(current, previous)`, `buildRegressionCheckPrompt`/스키마(측정 스크립트에서 이동), `applyRegressionChecks(current, previous, checks)`(regressed=false면 이전 판정 유지). `STATUS_ORDER`는 여기로 옮긴다(`lib/revisionBoard.js`가 import).
- `getRubricCoachingFeedback`: 판정 → (내려간 기준 있으면) 하락 확인 호출 → 최종 판정 → 미션 호출. 반환값에 `regressionChecks` 추가, `rawAssessments`는 유지. 글이 그대로면 직전 판정 재사용·지난 미션 not-done은 지금 코드 그대로.

### 3. 미션 생성
- `buildMissionPrompt`를 측정 때의 `buildNewMissionPrompt`로 교체한다(판정+missionSeed를 기준별로 주고, AI가 `criterionId`를 고름, 서로 다른 행동 3개, 모두 met이면 심화 지시).
- `buildMissionSchema`: 미션 항목에 `criterionId` enum, `targetIndex` 삭제. 개수는 보류 ①에 따라 3 고정 또는 (모두 met일 때만) 0~3.
- `sanitizeMissionResult`는 `criterionId` → 저장용 `rubricIds`/`criterionIds` 배열 붙이기만 남긴다(보드·옛 회차가 배열을 읽음). 인용 치환·막연한 문장 제거·`fallbackMissionTitle` 교체·polish 분기는 삭제.
- `validateMissionResult`를 보류 ②의 두 모드로:
  - **C 형식**: 개수, id 비었음/중복, 모르는 criterionId, 제목·설명·확인 기준 빈 값, 잘한 점(met 기준을 가리키거나 met이 없으면 `effort`).
  - **B 핵심**: C + 예시 문장 금지(`예를 들어` 등) + 사실 지어내기 요구 금지 + 막연한 표현(`자세히 써` 등). 걸리면 재시도.
  - 둘 다 제목 `-기` 목록·설명 동작 목록(`ACTION_*_PATTERN`)과 인용 검사는 뺀다(측정에서 오탐 주원인).
- 보류 두 가지는 `lib/coaching.js` 상단 상수 두 개(`ALL_MET_MISSIONS`, `MISSION_CHECKS`)로 바꿀 수 있게 하고, 결정 뒤 안 쓰는 쪽 코드와 상수를 지운다.
- 삭제: `lib/missions.js`(selectMissionTargets·POLISH_TARGETS), `ACTION_TITLE_PATTERN`·`ACTION_INSTRUCTION_PATTERN`·`hasIdenticalCorrection` 등 polish/인용 관련 함수, `lib/curriculum.js`의 `priority`·`fallbackMissionTitle` 필드(죽은 데이터가 되므로). `lib/interviewEval.js`의 대상 조합 검사와 "2개" 검사는 "3개, 알려진 기준" 검사로 바꾼다.

### 4. 저장과 서버 — `lib/actions.js`, `lib/interviewRound.js`
- `requestCoaching(submissionId, writing, selectedMissionIds = [])`. 채점기준 코칭이고 지난 미션에 id가 있으면: 고른 id가 지난 미션 id의 부분집합인지, 1개 이상인지 확인한다(아니면 오류 문구). 일반 코치는 무시.
- `runRubricRound`는 `previousMissions`를 고른 것만 넘긴다. 새 round에 `selectedMissionIds`, `regressionChecks`를 남긴다. `lastImprovements`는 새 미션 3개.
- 욕설 검토 대기(`feedback.pending`)에도 `selectedMissionIds`를 같이 저장해, 선생님 승인(`resolveProfanityReview` → `runCoachingRound`) 때 이어 쓴다.
- 도달도 계산(`computeNextAttainment`)은 손대지 않는다. 고른 미션의 판정만 들어오므로 그대로 맞다.

### 5. 학생 화면 — `components/WritingScreen.jsx`, `components/RevisionHistory.jsx`
- 미션 카드를 눌러 고르기(토글, 고른 카드 표시). 미션에 id가 있는데 하나도 안 골랐으면 "다시 코칭 받기" 꺼짐, 안내 한 줄("해 볼 미션을 골라요"). 새 코칭을 받으면 선택 초기화. 일반 코치(id 없음)는 지금 그대로.
- 보류 ①이 B여서 미션이 0개면 선택 없이 재코칭 가능.
- 이전 버전 보기의 "지난 미션 반영 확인"은 **고른 미션만** 보여 준다. 기호(✅🔄❌)는 그대로.

### 6. 교사 보드 — `lib/revisionBoard.js`, `components/RevisionBoard.jsx`
- 잠금이 사라지면 `getTrend`가 이미 ▼를 그린다. 추가 작업 없음(범례 문구만 확인).
- `getMissionRows`: 다음 회차에 `selectedMissionIds`가 있으면 고른 미션만 행으로 만든다. 최신 회차(판정 전)는 3개 모두.

### 7. 스크립트·문서
- `scripts/smoke-rubric-coaching.js`: 미션 개수 검사 3개(모두 met이고 B면 0~3), POLISH 참조 삭제, `--all-met A|B`·`--checks B|C` 옵션.
- `docs/FEATURES.md`, `docs/PROJECT_STATUS.md`("핵심 규칙" 표: 미션 3개·선택, 판정 하락 가능), 결정 뒤 `CHANGELOG.md`.

## 순서
1. 브랜치 → lib 변경 + 단위 테스트 고치기(`coaching.test.js`, `missions.test.js` 삭제, `assessmentRatchet.test.js` → `regressionCheck.test.js`, `interviewRound`·`actions`·`revisionBoard`·`curriculum`·`interviewEval` 테스트).
2. 화면 변경.
3. `npm test`·`npm run lint`·`npm run build`.
4. 스모크(유료, 소액): 보류 조합 4가지(A/B × B/C)로 15편씩 돌리고, 측정 때처럼 비교 페이지(html)와 md를 만들어 보여 드린다 → **사용자가 고름** → 안 쓰는 코드 삭제.
5. 화면 확인(아래) → master 병합·push(=배포) → 배포 success 확인 → 보드 카드·문서 갱신.

## 검증
- 단위 테스트: 하락 확인(내려간 것만 호출, false면 유지), 고른 미션만 판정·도달도 반영, 선택 검증(빈 선택·남의 id 거부), 미션 스키마 3개·criterionId, 검사 두 모드, 일반 코치는 2.5-lite·미션 2개 그대로.
- 스모크: 3.8로 단원 5개 정상 동작, 재시도·실패 수(지금 기준선 30회 중 실패 3회와 비교), 회차 시간.
- 화면: 로컬 `npm run dev` + 테스트 교사 로그인 + Playwright로 학생 흐름(코칭 → 미션 고르기 → 버튼 켜짐 → 재코칭 → 고른 미션만 결과 → 보드 ▼·고른 미션만). **주의: 로컬 `.env.local`이 운영 DB라** "🧪 개편 테스트" 활동 하나를 만들어 확인하고 끝나면 ⋯ 메뉴로 삭제한다(학생 글도 같이 지워짐).
