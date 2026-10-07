# 디노 글쓰기 코치 — Ponytail 코드 점검 계획

> 2026-10-07 학교 컴에서 세운 계획. 집에서 실행한다.
> 시작할 때 할 말: "docs/superpowers/plans/2026-10-07-ponytail-cleanup.md 계획대로 진행해"

## 배경
사용자는 Ponytail(`DietrichGebert/ponytail`, 2026-10-07 설치)을 써서 디노 코드에서 과하게 짠 곳을 줄이고 싶어 한다.
디노는 교실에서 쓰는 운영 앱이고, `master`에 push하면 곧바로 프로덕션에 배포된다.

사용자가 정한 것 (2026-10-07)
- 범위: **코드 줄이기만** 한다 (Ponytail). 버그 찾기(`/code-review`)는 하지 않는다.
- 위험 구역은 점검 목록에는 넣되 **이번엔 고치지 않는다**.
- 고친 것은 **브랜치에만** 둔다. 배포는 나중에 따로 정한다.
- 스모크는 이번에 돌리지 않는다.

계획을 세운 시점의 상태: master = origin/master = `30e59a8`이고, 이 커밋이 프로덕션에 배포돼 있다. 9/8 변경도 배포됐지만 스모크는 아직 안 돌렸다.

## 위험 구역 (목록에만 넣고 손대지 않음)
- 코칭·미션 프롬프트, Gemini 호출: `lib/coaching.js`, 그리고 프롬프트를 만드는 lib 파일들
- 판정 잠금: `lib/assessmentRatchet.js`
- 가드(무의미한 글·욕설): `lib/guard.js`
- 단원·채점기준 데이터: `lib/curriculum.js` (`getAiRubrics`, `showsAiVerdict`)
- DB 스키마·마이그레이션: `prisma/`

## 단계
0. **준비**
   - `git pull`을 한다.
   - `/ponytail-audit` 명령이 보이는지 확인한다. 집 컴에서는 Ponytail이 sync로 자동 설치된다. 명령이 안 보이면 `/plugin install ponytail@ponytail`을 친다.
   - 이 폴더에서 `npm install`을 한다. node_modules(1GB 이상)가 드라이브로 동기화된다.
1. **기준선 확인**
   - `npm test`(254개), `npm run lint`, `npm run build`를 돌려 결과를 적어 둔다.
   - 추적되지 않는 파일(`demo/`, `scripts/*` 6개, 교육과정 txt)은 점검 대상에서 뺀다. 지우지도 않는다.
2. **점검만 한다**
   - `/ponytail-audit`으로 저장소 전체를 본다. 이 단계에서는 코드를 고치지 않는다.
   - 결과는 `docs/superpowers/plans/2026-10-07-ponytail-audit.md`에 정리한다.
   - 항목마다 파일, 무엇을 줄이나, 줄어드는 줄 수, 위험도(🟢 안전 / 🟡 중간 / 🔴 위험 구역)를 적는다.
3. **사용자와 같이 고른다**
   - 🟢·🟡 항목을 보여 주고, 사용자가 고른 것만 고친다. 🔴는 목록에만 남긴다.
4. **브랜치에서 고친다**
   - `ponytail-cleanup` 브랜치를 만든다.
   - 고른 항목을 작은 묶음으로 나눠 묶음마다 커밋한다.
   - 묶음마다 `npm test`와 `npm run lint`를 돌린다.
   - 동작은 바꾸지 않는다. CLAUDE.md의 "곁다리 리팩터링 금지"를 지킨다.
5. **마무리**
   - `npm run build`를 돌린다.
   - 화면을 건드린 묶음이 있으면 로컬에서 Playwright로 캡처해 사용자에게 보여 준다. 테스트 교사 로그인을 쓴다.
   - 로컬 `.env.local`은 운영 DB를 가리키므로, 화면 확인은 **읽기만** 한다. 활동을 만들지 않는다.
   - 브랜치는 push하지 않는다. 사용자가 원하면 브랜치만 push한다. 브랜치 push는 배포가 아니다.
   - `docs/PROJECT_STATUS.md`의 다음 할 일에 "ponytail-cleanup 브랜치, 머지·배포 결정 대기"를 적는다.
   - Playground의 `웹앱 보드.md`에서 디노 카드를 갱신한다.

## 검증
- 기준선과 같은 테스트 수가 통과하고, lint 경고가 0이고, build가 성공한다.
- `git diff master..ponytail-cleanup`에 🔴 위험 구역 파일이 들어 있지 않다.
- 화면을 건드렸으면 변경 전후 캡처를 비교한다.
