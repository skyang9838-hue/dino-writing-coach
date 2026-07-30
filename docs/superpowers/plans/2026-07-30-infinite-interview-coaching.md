# Infinite Interview Coaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore cumulative, uncapped attainment and guarantee two actionable interview-report missions on every meaningful coaching round.

**Architecture:** Keep rubric assessment as diagnostic metadata, but route student-visible attainment through the existing cumulative `computeNextAttainment` function. Extend deterministic target selection with refinement targets when fewer than two unmet/partial targets remain, then remove the terminal `complete` contract from generation, persistence, scoring, and UI.

**Tech Stack:** Next.js 16, React 19, Prisma/PostgreSQL, Gemini structured JSON, Vitest, oxlint

## Global Constraints

- First meaningful coaching round always produces 40% attainment.
- Later rounds add exactly 10% for each prior mission whose status is `done`; `partial` and `not-done` add 0%.
- Attainment is monotonic and uncapped.
- Every meaningful round returns exactly two missions, including when all rubric criteria are `met`.
- Student-facing completion states and “perfect” copy are forbidden.
- Existing meaningless/profanity handling and non-interview coaching must not regress.

---

### Task 1: Restore cumulative attainment

**Files:**
- Modify: `lib/interviewRound.js`
- Modify: `lib/interviewRound.test.js`
- Test: `lib/attainment.test.js`

**Interfaces:**
- Consumes: `computeNextAttainment(currentAttainment, addressed)`
- Produces: `buildInterviewRoundState({ submission, writing, result })` with cumulative `attainment`

- [ ] **Step 1: Write failing tests**

Add tests proving the first round is 40 regardless of rubric status, `done/done` adds 20, `done/partial` adds 10, and an arbitrarily large number of rounds keeps increasing by the same formula without a cap.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- lib/interviewRound.test.js lib/attainment.test.js`
Expected: FAIL because interview rounds currently use rubric percentage.

- [ ] **Step 3: Implement minimal cumulative calculation**

Map `result.priorMissions` to booleans using `status === 'done'` and pass the array, or `null` on the first round, to `computeNextAttainment`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- lib/interviewRound.test.js lib/attainment.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/interviewRound.js lib/interviewRound.test.js lib/attainment.test.js
git commit -m "fix: 면담 도달도 누적 규칙 복구"
```

### Task 2: Guarantee two non-terminal missions

**Files:**
- Modify: `lib/missions.js`
- Modify: `lib/missions.test.js`
- Modify: `lib/coaching.js`
- Modify: `lib/coaching.test.js`

**Interfaces:**
- Consumes: seven rubric assessments and prior round targets
- Produces: `selectMissionTargets(...)` returning exactly two targets for meaningful writing

- [ ] **Step 1: Write failing selector and validator tests**

Cover all criteria `met`, only one weak criterion, repeated refinement targets, and mission responses containing fewer or more than two missions.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- lib/missions.test.js lib/coaching.test.js`
Expected: FAIL because selection can return zero or one target and `complete` permits an empty mission array.

- [ ] **Step 3: Add refinement fallback**

After sorting weak targets, fill remaining slots from `met` criteria in human priority order while demoting recently repeated targets. Preserve distinct normalized target keys and return exactly two.

- [ ] **Step 4: Remove completion generation**

Require exactly two missions in the schema validator and prompt. Stop asking Gemini for a terminal completion decision; tolerate a legacy `complete` field only at the normalization boundary if needed, but never store or render it.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- lib/missions.test.js lib/coaching.test.js`
Expected: PASS.

```powershell
git add lib/missions.js lib/missions.test.js lib/coaching.js lib/coaching.test.js
git commit -m "fix: 면담 수정미션을 매 라운드 두 개로 유지"
```

### Task 3: Remove terminal UI and persistence semantics

**Files:**
- Modify: `lib/interviewRound.js`
- Modify: `lib/interviewRound.test.js`
- Modify: `lib/feedback.js`
- Modify: `lib/feedback.test.js`
- Modify: `components/WritingScreen.jsx`
- Modify: `components/RevisionHistory.jsx`
- Modify: `lib/mascot.js`
- Modify: `lib/mascot.test.js`

**Interfaces:**
- Consumes: feedback containing two missions and uncapped attainment
- Produces: continuous-coaching UI with no completion branch

- [ ] **Step 1: Write failing helper and mascot tests**

Assert missions remain visible without a `complete` property and attainment values at or above 100 use continuing-growth copy rather than “완벽”.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- lib/feedback.test.js lib/mascot.test.js lib/interviewRound.test.js`
Expected: FAIL on legacy completion semantics.

- [ ] **Step 3: Remove completion state**

Delete `complete` from feedback/round persistence, always render the two missions, remove completion banners from current feedback and history, and change 100%+ mascot copy to continuing-growth language.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- lib/feedback.test.js lib/mascot.test.js lib/interviewRound.test.js`
Expected: PASS.

```powershell
git add lib/interviewRound.js lib/interviewRound.test.js lib/feedback.js lib/feedback.test.js components/WritingScreen.jsx components/RevisionHistory.jsx lib/mascot.js lib/mascot.test.js
git commit -m "fix: 면담 코칭의 완료 상태 제거"
```

### Task 4: Extend live evaluation gates

**Files:**
- Modify: `evals/interview-report/dev.json`
- Modify: `evals/interview-report/validation.json`
- Modify: `lib/interviewEval.js`
- Modify: `lib/interviewEval.test.js`
- Modify: `scripts/eval-interview-report.js`

**Interfaces:**
- Consumes: live `getInterviewReportFeedback` results
- Produces: metrics for exact mission count, terminal-state absence, and cumulative progression

- [ ] **Step 1: Write failing scorer tests**

Add violations for mission count not equal to two, terminal completion output, and invalid prior mission status effects.

- [ ] **Step 2: Add all-met and multi-round fixtures**

Ensure frozen sets include several all-met reports and unchanged/minimally changed revisions without tuning validation expectations after execution.

- [ ] **Step 3: Implement aggregate gates**

Report `twoMissionRate`, `terminalStates`, and progression invariant failures; fail the CLI unless rates are 100% and counts are zero.

- [ ] **Step 4: Run deterministic tests and commit**

Run: `npm test -- lib/interviewEval.test.js`
Expected: PASS.

```powershell
git add evals/interview-report/dev.json evals/interview-report/validation.json lib/interviewEval.js lib/interviewEval.test.js scripts/eval-interview-report.js
git commit -m "test: 무한 면담 코칭 평가 조건 추가"
```

### Task 5: Full verification loop

**Files:**
- Verify all changed files
- Generated reports: `.eval-results/interview-report/`

**Interfaces:**
- Consumes: completed implementation
- Produces: evidence that every global constraint passes

- [ ] **Step 1: Run automated checks**

Run: `npm test`
Expected: all tests pass.

Run: `npm run lint`
Expected: exit 0.

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 2: Run live development evaluation**

Run: `npm run eval -- --set dev --runs 3`
Expected: agreement ≥90%, schema 100%, two-mission rate 100%, terminal states 0, contradictions 0, hallucinated met 0, mission violations 0.

- [ ] **Step 3: Run frozen validation once**

Run: `npm run eval -- --set validation --runs 1`
Expected: agreement ≥85% with all safety and infinite-coaching gates passing.

- [ ] **Step 4: Verify local integration**

Confirm a meaningful interview report receives two missions and 40%; simulate many persisted later rounds beyond 100% with no upper bound; confirm the screen never displays completion or perfect-copy language.

- [ ] **Step 5: Review and final commit**

Run: `git diff --check` and review the complete branch diff. Fix any discovered issue using a failing test first, repeat all affected gates, and stop only when every expected result above is satisfied.
