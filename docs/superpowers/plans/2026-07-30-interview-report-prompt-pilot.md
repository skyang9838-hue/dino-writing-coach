# Interview Report Prompt Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-usable, rubric-based two-stage Gemini coaching pilot for the sixth-grade interview report activity and verify it with deterministic tests plus a repeatable live evaluation loop.

**Architecture:** The curriculum module owns the human-authored rubric and observable three-level anchors. A pure mission-selection module converts assessment statuses into at most two deduplicated targets. The coaching module owns structured Gemini assessment and mission-writing calls; the server action chooses the pilot pipeline only for `면담 보고서` and preserves the legacy path for every other genre.

**Tech Stack:** Next.js 16 App Router, React 19, Node.js ESM, Gemini REST `generateContent`, Prisma JSON fields, Vitest 3, oxlint.

## Global Constraints

- Only the `면담 보고서` genre uses the new pipeline; existing genres retain their current behavior.
- Gemini generates each displayed mission from the current student writing; stored text is never copied as the final mission.
- Mission output is `~하기` title plus an instruction that identifies what to change and how.
- A mission containing only vague advice such as `자세히 쓰기`, `구체적으로 쓰기`, `내용 보충하기`, or `더 잘 다듬기` is invalid.
- Gemini must not invent interview facts, provide a finished model sentence, score the student, or assign a grade.
- Assessment uses `temperature: 0`; mission writing uses `temperature: 0.7`.
- Development-set agreement must reach 90%, three-run stability 95%, validation-set agreement 85%, schema success 100%, and logical contradictions 0.
- Use TDD for every behavior change and preserve the existing guard, profanity-review, and legacy coaching flows.

---

### Task 1: Interview-report curriculum model and activity entry

**Files:**
- Modify: `lib/curriculum.js`
- Modify: `lib/curriculum.test.js`
- Modify: `components/NewActivityForm.jsx`

**Interfaces:**
- Produces: `INTERVIEW_REPORT_GENRE`, `INTERVIEW_REPORT_RUBRICS`, `getRubricsForGenre(genre)`.
- `INTERVIEW_REPORT_RUBRICS` is an array of rubric objects with `{ id, label, criteria }`.
- Each criterion has `{ id, label, priority, statuses: { met, partial, unmet }, missionSeed }`.

- [ ] **Step 1: Write failing curriculum tests**

Add tests that require the first activity to be `g6s2-unit2`, genre `면담 보고서`, and require seven unique criteria grouped 2/2/3 under three rubrics.

```js
import {
  GRADE6_SEMESTER1_UNITS,
  INTERVIEW_REPORT_GENRE,
  INTERVIEW_REPORT_RUBRICS,
  getRubricsForGenre,
} from './curriculum.js'

it('offers the grade 6 semester 2 interview report as the first pilot activity', () => {
  expect(GRADE6_SEMESTER1_UNITS[0]).toMatchObject({
    id: 'g6s2-unit2',
    unitNumber: 2,
    genre: INTERVIEW_REPORT_GENRE,
    title: '면담 보고서 쓰기',
  })
})

it('defines three interview-report rubrics with seven observable criteria', () => {
  expect(INTERVIEW_REPORT_RUBRICS.map((rubric) => rubric.criteria.length)).toEqual([2, 2, 3])
  const criteria = INTERVIEW_REPORT_RUBRICS.flatMap((rubric) => rubric.criteria)
  expect(new Set(criteria.map((criterion) => criterion.id)).size).toBe(7)
  for (const criterion of criteria) {
    expect(criterion.statuses).toEqual({
      met: expect.any(String),
      partial: expect.any(String),
      unmet: expect.any(String),
    })
    expect(criterion.missionSeed).toEqual(expect.any(String))
  }
  expect(getRubricsForGenre(INTERVIEW_REPORT_GENRE)).toBe(INTERVIEW_REPORT_RUBRICS)
})
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx vitest run lib/curriculum.test.js`

Expected: FAIL because the interview-report exports and activity do not exist.

- [ ] **Step 3: Add the curriculum constants and exact rubric anchors**

Add `INTERVIEW_REPORT_GENRE = '면담 보고서'`, replace the first unit card with the sixth-grade second-semester unit, and encode all seven approved anchors from the design spec. Assign priorities `new-fact=10`, `fact-detail=20`, `purpose=30`, `interviewee=40`, `closing=50`, `opening=60`, `body=70`.

```js
export function getRubricsForGenre(genre) {
  return genre === INTERVIEW_REPORT_GENRE ? INTERVIEW_REPORT_RUBRICS : null
}
```

Change the form heading to:

```jsx
<span aria-hidden="true">📖</span> 6학년 국어 활동 선택
```

- [ ] **Step 4: Run the curriculum tests**

Run: `npx vitest run lib/curriculum.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- lib/curriculum.js lib/curriculum.test.js components/NewActivityForm.jsx
git commit -m "feat: 면담 보고서 파일럿 활동과 루브릭 추가"
```

### Task 2: Deterministic mission-target selection

**Files:**
- Create: `lib/missions.js`
- Create: `lib/missions.test.js`

**Interfaces:**
- Consumes: assessment entries `{ rubricId, criterionId, status }` and prior rounds.
- Produces: `selectMissionTargets({ assessments, rubrics, priorRounds })`.
- Each returned target is `{ rubricIds, criterionIds, missionSeed }`; result length is 0–2.

- [ ] **Step 1: Write failing selector tests**

Cover these exact cases:

```js
it('merges missing new-fact and fact-detail into one core-information target', () => {
  expect(selectMissionTargets({
    assessments: [
      assessment('information', 'new-fact', 'unmet'),
      assessment('information', 'fact-detail', 'unmet'),
    ],
    rubrics: INTERVIEW_REPORT_RUBRICS,
    priorRounds: [],
  })).toEqual([
    expect.objectContaining({ criterionIds: ['new-fact', 'fact-detail'] }),
  ])
})

it('suppresses body when the underlying new fact is absent', () => {
  const targets = selectMissionTargets({
    assessments: [
      assessment('information', 'new-fact', 'unmet'),
      assessment('structure', 'body', 'unmet'),
      assessment('structure', 'closing', 'unmet'),
    ],
    rubrics: INTERVIEW_REPORT_RUBRICS,
    priorRounds: [],
  })
  expect(targets.flatMap((target) => target.criterionIds)).not.toContain('body')
})

it('prefers unmet over partial, returns at most two, and demotes a twice-repeated target', () => {
  const targets = selectMissionTargets({
    assessments: [
      assessment('information', 'new-fact', 'partial'),
      assessment('context', 'purpose', 'unmet'),
      assessment('structure', 'closing', 'unmet'),
    ],
    rubrics: INTERVIEW_REPORT_RUBRICS,
    priorRounds: [
      { missions: [{ criterionIds: ['purpose'] }] },
      { missions: [{ criterionIds: ['purpose'] }] },
    ],
  })
  expect(targets).toHaveLength(2)
  expect(targets[0].criterionIds).toEqual(['closing'])
  expect(targets[1].criterionIds).toEqual(['purpose'])
})
```

- [ ] **Step 2: Verify test failure**

Run: `npx vitest run lib/missions.test.js`

Expected: FAIL because `lib/missions.js` does not exist.

- [ ] **Step 3: Implement the pure selector**

Implementation rules:

```js
const STATUS_ORDER = { unmet: 0, partial: 1, met: 2 }

export function selectMissionTargets({ assessments, rubrics, priorRounds = [] }) {
  // Validate known IDs and statuses.
  // Remove met entries.
  // Suppress body when new-fact is unmet.
  // Merge new-fact + fact-detail and purpose + interviewee when both are deficient.
  // Sort by status, twice-repeated demotion, then human priority.
  // Return the first two targets.
}
```

Mission seeds must describe direction, not final student-facing text:

```js
{
  criterionIds: ['new-fact', 'fact-detail'],
  missionSeed: '면담에서 새롭게 알게 된 사실 하나를 고르고, 그 사실의 이유·과정·사례·상황 중 하나를 덧붙이도록 안내',
}
```

- [ ] **Step 4: Run selector tests**

Run: `npx vitest run lib/missions.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- lib/missions.js lib/missions.test.js
git commit -m "feat: 면담 보고서 수정 대상 선택 규칙 추가"
```

### Task 3: Structured assessment and mission prompts

**Files:**
- Modify: `lib/coaching.js`
- Modify: `lib/coaching.test.js`

**Interfaces:**
- Produces: `buildInterviewAssessmentPrompt(input)`, `buildInterviewMissionPrompt(input)`.
- Produces: `validateInterviewAssessment(result, rubrics)`, `validateInterviewMissionResult(result, selectedTargets)`.
- Produces: `getInterviewReportFeedback(input)` returning `{ meaningless, assessments, priorMissions, strength, missions, complete }`.
- Legacy `getGeminiFeedback` and prompt builders retain their signatures.

- [ ] **Step 1: Write failing prompt tests**

Require the assessment prompt to contain all rubric labels, every behavior anchor, the student writing, no scoring request, and revision blocks when supplied. Require the mission prompt to contain the selected target, current writing, `~하기` title rule, vague-only bans, no-model-answer rule, and no-invention rule.

```js
expect(prompt).toContain('면담의 목적과 대상이 분명하게 드러난다')
expect(prompt).toContain('이유, 과정, 사례, 상황 중 하나 이상')
expect(prompt).toContain('점수나 등급을 매기지 마')
expect(prompt).toContain('완성 문장이나 모범답안을 대신 쓰지 마')
expect(prompt).toContain('학생 글에 없는 면담 내용이나 사실을 만들어내지 마')
expect(prompt).toContain('제목은 반드시 행동을 나타내는 명사형 `~하기`로 끝내')
```

Add validation tests for missing IDs, duplicates, unknown statuses, `new-fact=unmet` with `fact-detail=met`, too many missions, target mismatch, a title not ending in `하기`, vague-only content, and empty criterion.

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run lib/coaching.test.js`

Expected: FAIL because the interview-report prompt and validator exports do not exist.

- [ ] **Step 3: Add assessment and mission JSON schemas**

Assessment schema contains all three explicit enum values and seven entries. Mission schema permits 0–2 missions and separates `title`, `instruction`, and hidden `criterion`.

```js
const INTERVIEW_ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    meaningless: { type: 'boolean' },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rubricId: { type: 'string' },
          criterionId: { type: 'string' },
          status: { type: 'string', enum: ['met', 'partial', 'unmet'] },
        },
        required: ['rubricId', 'criterionId', 'status'],
      },
    },
    priorMissions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          missionId: { type: 'string' },
          status: { type: 'string', enum: ['done', 'attempted', 'not-done'] },
        },
        required: ['missionId', 'status'],
      },
    },
  },
  required: ['meaningless', 'criteria', 'priorMissions'],
}
```

- [ ] **Step 4: Implement prompt builders and validators**

Assessment prompt order:

1. Non-evaluative checker role.
2. Common evidence rules.
3. Rubric hierarchy and criterion-specific `met/partial/unmet` anchors.
4. Current writing.
5. Optional prior missions and diff.
6. Meaningless-content instruction.

Mission prompt order:

1. Dino coaching role.
2. Current writing.
3. met criteria and selected targets.
4. dynamic-grounding rules.
5. exact JSON field instructions.
6. banned vague-only and model-answer behavior.

Validation rejects any unknown or duplicate criterion, requires all seven criteria, checks logical consistency, checks mission count and selected IDs, requires `/하기$/` for titles, and rejects a mission whose combined title/instruction is only a banned vague phrase.

- [ ] **Step 5: Implement a reusable Gemini JSON caller with one retry**

```js
async function callGeminiJson({ prompt, schema, temperature, validate }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await requestGemini({ prompt, schema, temperature })
    try {
      validate(result)
      return result
    } catch (error) {
      if (attempt === 1) throw new CoachingApiError('디노 응답을 이해하지 못했어요.', 502)
    }
  }
}
```

`getInterviewReportFeedback` calls assessment at `0`, uses `selectMissionTargets`, then calls mission writing at `0.7`. It returns early for `meaningless` and for unchanged writing as specified.

- [ ] **Step 6: Run coaching tests**

Run: `npx vitest run lib/coaching.test.js`

Expected: PASS, including all legacy tests.

- [ ] **Step 7: Commit**

```powershell
git add -- lib/coaching.js lib/coaching.test.js
git commit -m "feat: 면담 보고서 2단계 Gemini 프롬프트 추가"
```

### Task 4: Server-action persistence and backward compatibility

**Files:**
- Modify: `lib/actions.js`
- Create: `lib/actions.test.js`
- Modify: `lib/attainment.js`
- Modify: `lib/attainment.test.js`

**Interfaces:**
- `runCoachingRound` branches on `submission.activity.genre === INTERVIEW_REPORT_GENRE`.
- New feedback shape is `{ strength: string, missions: Mission[], assessments: Assessment[], complete: boolean }`.
- Legacy feedback remains `{ strength, improvements }`.
- New rounds store `assessments`, `missions`, `priorMissionStatuses`, and `attainmentAfter`.

- [ ] **Step 1: Write failing attainment tests**

Add `computeRubricAttainment(assessments)`:

```js
expect(computeRubricAttainment([
  { status: 'met' },
  { status: 'partial' },
  { status: 'unmet' },
])).toBe(50)
```

It maps `met=1`, `partial=0.5`, `unmet=0`, averages, multiplies by 100, and rounds.

- [ ] **Step 2: Implement and verify rubric attainment**

Run: `npx vitest run lib/attainment.test.js`

Expected: PASS without changing legacy `computeNextAttainment`.

- [ ] **Step 3: Write failing server-action orchestration tests**

Mock Prisma and coaching functions to verify:

- interview-report activities call `getInterviewReportFeedback`;
- other genres call `getGeminiFeedback`;
- the new round stores assessments and dynamic mission fields;
- mission text is projected into the response used by the UI;
- a failed second call writes nothing;
- meaningless and profanity flows remain unchanged.

- [ ] **Step 4: Implement the branch and persistence**

Add a focused `runInterviewReportRound` helper. Student-visible attainment is:

```js
const actualAttainment = computeRubricAttainment(result.assessments)
const attainment = Math.max(submission.attainment ?? 0, actualAttainment)
```

Persist the actual round assessment so the teacher view can later distinguish it from the monotonic student display.

- [ ] **Step 5: Run action and attainment tests**

Run: `npx vitest run lib/actions.test.js lib/attainment.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- lib/actions.js lib/actions.test.js lib/attainment.js lib/attainment.test.js
git commit -m "feat: 면담 보고서 코칭 라운드 저장 연결"
```

### Task 5: Student and revision-history UI compatibility

**Files:**
- Modify: `components/WritingScreen.jsx`
- Modify: `components/RevisionHistory.jsx`
- Modify: `app/globals.css`
- Create: `lib/feedback.js`
- Create: `lib/feedback.test.js`

**Interfaces:**
- UI derives `visibleMissions = feedback.missions ?? feedback.improvements?.map(...) ?? []`.
- Mission objects render title and instruction; legacy strings render unchanged.
- Zero missions renders a completion message instead of empty numbered cards.

- [ ] **Step 1: Add pure display normalization tests**

Create `lib/feedback.js` and `lib/feedback.test.js` with:

```js
expect(getVisibleMissions({
  missions: [{ title: '까닭 덧붙이기', instruction: '첫 번째 사실 뒤에 까닭을 써보세요.' }],
})).toEqual([
  { title: '까닭 덧붙이기', instruction: '첫 번째 사실 뒤에 까닭을 써보세요.' },
])

expect(getVisibleMissions({ improvements: ['문단을 나눠보세요'] })).toEqual([
  { title: null, instruction: '문단을 나눠보세요' },
])
```

- [ ] **Step 2: Verify normalization tests fail, then implement**

Run: `npx vitest run lib/feedback.test.js`

Expected after implementation: PASS.

- [ ] **Step 3: Update both components**

Render `mission.title` as the mission heading and `mission.instruction` as its explanation. Remove the hard-coded “2가지” label and render the actual count. When `complete` is true, render `면담 보고서가 루브릭의 기준을 모두 갖췄어요!`.

- [ ] **Step 4: Run unit tests and lint**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 5: Commit**

```powershell
git add -- components/WritingScreen.jsx components/RevisionHistory.jsx app/globals.css lib/feedback.js lib/feedback.test.js
git commit -m "feat: 동적 수정미션 표시 지원"
```

### Task 6: Frozen development and validation evaluation sets

**Files:**
- Create: `evals/interview-report/dev.json`
- Create: `evals/interview-report/validation.json`
- Create: `lib/interviewEval.js`
- Create: `lib/interviewEval.test.js`

**Interfaces:**
- Every fixture has `{ id, writing, expected: { meaningless, criteria }, allowedMissionCriterionSets }`.
- `scoreAssessmentCase(expected, actual)` returns counts for matches, total, hallucinatedMet, contradictions, schemaValid.
- `scoreMissionCase(fixture, result)` returns deterministic violations.

- [ ] **Step 1: Create 12 development and 8 validation fixtures**

The sets must include:

- complete report;
- missing purpose/target;
- new fact without detail;
- detailed fact but poor structure;
- missing closing reflection;
- all required content with no paragraph breaks;
- ambiguous boundary cases;
- consonant repetition and spacing filler;
- unchanged and minimally changed revision pairs.

Each expected criterion contains all seven IDs and a human label. Validation fixtures must not duplicate development wording.

- [ ] **Step 2: Write failing scorer tests**

Test exact agreement math, hallucinated `met` detection, contradiction detection, vague mission detection, non-`하기` title detection, unknown target IDs, and duplicate missions.

- [ ] **Step 3: Implement deterministic scorers**

Vague mission detection only fails when no concrete target/method follows the vague phrase. It must not reject a sentence that says “구체적으로 쓰기” and then names the exact fact and type of supporting information.

- [ ] **Step 4: Run scorer tests**

Run: `npx vitest run lib/interviewEval.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- evals/interview-report lib/interviewEval.js lib/interviewEval.test.js
git commit -m "test: 면담 보고서 프롬프트 평가셋 추가"
```

### Task 7: Live Gemini evaluation command and improvement loop

**Files:**
- Create: `scripts/eval-interview-report.js`
- Modify: `package.json`
- Modify: `.gitignore` if evaluation reports need a local-only directory.

**Interfaces:**
- Command: `npm run eval -- --set dev --runs 3`.
- Optional command: `npm run eval -- --set validation --runs 1`.
- Reports aggregate schema rate, criterion agreement, stability, hallucinated-met count, contradictions, meaningless accuracy, and mission violations.
- Exit code is nonzero when a required threshold fails.

- [ ] **Step 1: Add argument/parser and aggregation tests**

Expose pure parsing/aggregation functions from `lib/interviewEval.js`; test `--set`, `--runs`, invalid values, threshold pass, and threshold failure.

- [ ] **Step 2: Implement the CLI**

The script loads `.env`, requires `GEMINI_API_KEY`, reads the frozen JSON set, invokes the same production prompt functions, prints per-case failures and totals, and writes timestamped JSON to ignored `.eval-results/interview-report/`.

- [ ] **Step 3: Add the package script**

```json
"eval": "node scripts/eval-interview-report.js"
```

- [ ] **Step 4: Run the development loop**

Run: `npm run eval -- --set dev --runs 3`

For each failing iteration:

1. classify failures as anchor ambiguity, prompt instruction, schema validation, target selection, or mission writing;
2. change one cause only;
3. run focused Vitest tests;
4. rerun the entire development set;
5. commit only when metrics improve without regression.

Stop when schema is 100%, agreement at least 90%, stability at least 95%, hallucinated met 0, contradictions 0, meaningless cases all pass, and mission violations 0.

- [ ] **Step 5: Run the frozen validation set once**

Run: `npm run eval -- --set validation --runs 1`

Expected: agreement at least 85%, schema 100%, contradictions 0, and mission violations 0. If it fails, return to the development set; do not tune directly on validation wording.

- [ ] **Step 6: Commit**

```powershell
git add -- scripts/eval-interview-report.js package.json .gitignore lib/coaching.js lib/coaching.test.js lib/interviewEval.js lib/interviewEval.test.js
git commit -m "test: Gemini 프롬프트 평가 루프 추가"
```

### Task 8: Local application verification

**Files:**
- Modify only files implicated by verification failures.

**Interfaces:**
- Local URL: `http://localhost:3000`.
- The first activity card creates a `면담 보고서` activity and the student flow receives dynamic missions.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: production build succeeds.

- [ ] **Step 2: Start the local server**

Run: `npm run dev`

Expected: Next.js reports a ready URL at `http://localhost:3000`.

- [ ] **Step 3: Exercise the pilot flow**

Create the first `면담 보고서 쓰기` activity, join as a student, submit a development-set report, and verify:

- the first mission is generated dynamically from that writing;
- title ends in `하기`;
- instruction names a concrete target and method;
- no invented interview fact or finished answer appears;
- a revision produces prior-mission status and new targets;
- zero-target completion renders safely.

- [ ] **Step 4: Final regression and status check**

Run: `npm test && npm run lint && npm run build`

Expected: all commands succeed.

Run: `git status --short`

Expected: no unintended or uncommitted files except ignored local evaluation reports.
