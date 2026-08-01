# 디노 글쓰기 코치 — 현재 상태

> **세션은 이 문서에서 시작합니다.** 1페이지를 넘기지 마세요 — 끝난 작업은 [`CHANGELOG.md`](CHANGELOG.md)로 내려보냅니다.
> 개발 규칙·명령어·함정은 [`../CLAUDE.md`](../CLAUDE.md), 화면별 동작 명세는 [`FEATURES.md`](FEATURES.md).

**마지막 갱신:** 2026-08-01
**저장소:** https://github.com/skyang9838-hue/dino-writing-coach (public)
**배포:** https://dino-writing-coach.vercel.app — `950e4f3`까지만 반영되어 있고 **그 이후 작업은 미배포**

## 어디까지 왔나

교사가 활동을 만들고 학생이 참여 코드로 들어와 글을 쓰며 AI 코칭을 반복해 받는 교실 플랫폼. 프로덕션에 올라가 있다.

- **Phase 1** 기반 인프라 + 학생/교사 핵심 루프 — 완료
- **Phase 2** 교사의 학생별 성장 과정(diff) 보기 — 완료 (잔여: 학생 목록 정렬/검색, 필요해지면)
- **Phase 4** 무의미한 글 가드 + 욕설 감지 + 교사 승인 큐 — 완료
- **Phase 3(루브릭)** — 범용 업로드 대신 **"면담 보고서" 파일럿으로 좁혀서 진행 중** ↓

## 진행 중: 면담 보고서 파일럿

루브릭을 교사가 업로드하는 범용 기능으로 만들기 전에, **한 장르에 루브릭을 고정해 넣어 코칭 품질을 먼저 검증**하는 파일럿. 2026-07-30~31에 26커밋 들어갔다.

**핵심 규칙 — 코칭에는 끝이 없다**

| 항목 | 규칙 |
|---|---|
| 첫 코칭 도달도 | 글 상태와 무관하게 **40%** |
| 이후 도달도 | 직전 미션 `done` 하나당 **+10%** (`partial`/`not-done`은 0%) |
| 상한 | **없음.** 감소도 없음. 막대 너비만 100%에서 멈추고 숫자는 계속 올라감 |
| 매 라운드 미션 | 항상 **정확히 2개.** 모든 기준이 `met`이어도 "더 다듬을" 미션을 채워서 2개 |
| 완료 상태 | **없음.** `complete`/"완성"/"완벽" 같은 제품 상태를 쓰지 않음 |
| 루브릭 백분율 | 학생에게 안 보임. 라운드의 `actualAttainment`로 교사 분석용 저장만 |

**구조**

- `lib/curriculum.js` — 면담 보고서 장르 + 루브릭 3개/채점기준 7개 (코드 상수, 교사 업로드 아님)
- `lib/coaching.js` — 2단계 Gemini 파이프라인: 판정(`buildInterviewAssessmentPrompt`) → 미션 생성(`buildInterviewMissionPrompt`). 진입점 `getInterviewReportFeedback`
- `lib/missions.js` — `selectMissionTargets`가 **AI가 아니라 코드로** 수정 대상 2개를 고름 (unmet→partial→우선순위, 최근 반복 대상 후순위, 짝 기준 병합)
- `lib/attainment.js` / `lib/interviewRound.js` — 누적 도달도 계산과 라운드 영속화
- `evals/` + `scripts/eval-interview-report.js` — 프롬프트 품질 라이브 평가

**남은 것 — 라이브 평가 (`2026-07-30-infinite-interview-coaching.md`의 Task 5)**

자동 테스트는 다 통과했지만 **Gemini 실호출 평가를 아직 안 돌렸다** (`.eval-results/` 없음). 남은 작업:

1. `npm run eval -- --set dev --runs 3` — 판정 일치율 90%+, 스키마 100%, 미션 2개 생성률 100%, 종료 상태 0건, 허위 충족·논리 모순 0건
2. `npm run eval -- --set validation --runs 1` — 일치율 85%+
3. 로컬 통합 확인 — 의미 있는 면담 보고서가 미션 2개와 40%를 받는지, 100%를 넘겨도 상한이 안 걸리는지, 화면에 완료 문구가 안 나오는지

**⚠️ 라이브 평가는 Gemini를 실제로 호출하므로 비용이 발생한다.** 돌리기 전에 사용자에게 확인할 것.

## 파일럿 이후 후보

- 면담 보고서에서 검증된 루브릭 코칭을 **다른 장르로 확장** (교사 업로드 방식으로 갈지, 장르별 고정 루브릭을 늘릴지 결정 필요)
- Phase 2 잔여 — 참여 학생 목록 정렬/검색
- 가드 임계값(`lib/guard.js`)을 실제 학생 글 샘플로 튜닝

## 다음 세션 시작 프롬프트

```
dino-writing-coach 프로젝트를 이어서 작업합니다 (master 브랜치).
docs/PROJECT_STATUS.md에서 현재 상태를 확인해줘.

면담 보고서 파일럿을 진행 중이고, 자동 테스트는 다 통과했지만
Gemini 실호출 평가(npm run eval)를 아직 안 돌린 상태야.
```
