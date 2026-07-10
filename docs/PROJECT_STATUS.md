# 디노 글쓰기 코치 — 프로젝트 현황

> 이 문서는 세션이 끝날 때마다 갱신되는 "현재 상태 스냅샷"입니다. 다음 세션은 이 문서에서 시작하세요.

**마지막 갱신:** 2026-07-10
**최신 커밋:** `f1b4bf4` chore: 미사용 에셋 삭제
**GitHub 저장소:** https://github.com/skyang9838-hue/dino-writing-coach (public)

## 완료된 기능

**5단계 — 교실용 MVP 재구성 (BYOK 제거 + 도달도 시각화)**
- API 키 입력 UI를 완전히 제거하고, Vercel 서버리스 함수(`api/coach.js`)가 `GEMINI_API_KEY` 환경변수로 Gemini를 호출하는 구조로 전환. 브라우저에는 키가 전혀 노출되지 않음.
- Gemini 응답을 정규식 텍스트 파싱 대신 `responseSchema` 기반 JSON 구조화 출력으로 받도록 변경.
- "도달도" 시각화 추가: 40%로 시작, 직전 라운드의 보완할 점 2개 중 고친 개수 × 10%씩 증가, 상한 없음. 점수 계산은 클라이언트가 수행하고 AI는 O/X 판단만 함.
- 미사용 에셋(`hero.png`, `react.svg`, `vite.svg`, `icons.svg`) 삭제.
- 상세 설계는 [`docs/superpowers/specs/2026-07-09-classroom-mvp-design.md`](superpowers/specs/2026-07-09-classroom-mvp-design.md) 참고.

**1단계 (커밋 `d394a04`) — 기본 UI**
- 글쓰기 주제 입력창, 글쓰기 textarea
- 글자 수 실시간 카운트 + 진행 바 (400자 기준)
- 400자 달성 시 "✅ 준비 완료!" 배지, 버튼 활성화

**2단계 (커밋 `1925d91`) — AI 코칭 Mock UI + 레이아웃 버그 수정**
- "디노 코칭 받기" 버튼 클릭 → 로딩(1.2초, "코칭 준비 중...") → mock 피드백 카드 표시
- mock 피드백 3세트 중 랜덤 선택, `topic` 값을 문구에 반영
- `.container`에 `width`가 없어 코칭 카드 표시 여부에 따라 전체 레이아웃 너비가 흔들리던 버그 발견 및 수정 (`width: 100%; box-sizing: border-box;` 추가)

**3단계 — Gemini API 실제 연동 (BYOK 방식)**
- 키 보호 방식으로 "BYOK(Bring Your Own Key)"를 채택: 공유 키를 번들/서버에 두지 않고, 각 사용자가 자신의 Gemini API 키를 직접 발급받아 앱에 입력. 키는 `localStorage`(`dino-writing-coach:gemini-api-key`)에만 저장되고 브라우저에서 Gemini API를 직접 호출. 서버/프록시 불필요.
- 키 입력 UI는 별도 모달 없이 인라인: 키가 없으면 "디노 코칭 받기" 버튼 자리에 입력창+저장 버튼 표시, 저장 후 버튼로 전환. "키 변경" 링크로 재입력 가능.
- 신규 파일 `src/geminiCoachService.js` — `fetch`로 Gemini REST `generateContent` 엔드포인트 직접 호출 (SDK 미사용), 모델은 `gemini-2.5-flash-lite` 사용. 프롬프트는 "칭찬 1 + 개선 제안 2" 3줄 피드백을 요청하고, 응답을 파싱해 실패해도 항상 문자열 배열을 반환하도록 fallback 처리.
- 키는 헤더(`x-goog-api-key`)가 아닌 `?key=` 쿼리 파라미터로 전송 — CORS preflight 실패 가능성을 줄이기 위한 선택.
- **CORS 검증 완료:** Playwright로 실제 브라우저(`localhost` origin)에서 직접 fetch 호출을 확인한 결과, CORS가 막히지 않고 정상적인 JSON 응답(가짜 키 사용 시 `400 INVALID_ARGUMENT`)을 받음. BYOK 방식이 기술적으로 유효함을 확인.
- 인증 오류(잘못된 키) 시 "API 키가 올바르지 않아요" 메시지와 함께 키 입력창을 자동으로 다시 염. 그 외 오류는 일반 재시도 메시지.
- `MOCK_FEEDBACK_SETS`는 실제 연동으로 대체되어 제거함.
- Playwright 스크래치패드 스크립트로 자동 검증: 최초 진입 시 키 입력창 표시, 키 저장/localStorage 반영, 잘못된 키 에러 처리 및 재입력 유도, `.container` 너비가 상태 전환에도 흔들리지 않음, 새로고침 후 키 유지 — 모두 통과. (실제 유효한 키로 받는 진짜 피드백 내용은 자동화하지 않았으므로 사용자가 직접 한 번 확인 필요.)

**4단계 — GitHub 업로드 & 문서 정리**
- `gh auth login`으로 GitHub 인증 완료 후 `gh repo create`로 public 저장소 생성 및 기존 로컬 커밋 push.
- 기본 Vite 템플릿 README를 프로젝트 소개(기능, 실행법, BYOK 안내, 기술 스택, 현황 문서 링크)로 교체.

## 다음 작업 우선순위 (TODO)

1. **데이터 저장 (localStorage)** — 새로고침해도 주제/글쓰기 내용이 유지되도록
2. **디노 캐릭터 이미지/애니메이션 적용** — (5단계에서 `hero.png`, `icons.svg`는 미사용 상태로 삭제됨, 다시 도입 시 새로 준비 필요)
3. **라우팅** — 화면이 여러 개로 늘어날 경우에만 필요 (현재는 불필요할 수 있음)
4. **Vercel 배포** — `vercel link` → 대시보드에서 `GEMINI_API_KEY` 환경변수 설정 → git push로 자동 배포 (`docs/superpowers/specs/2026-07-09-classroom-mvp-design.md`의 "로컬 개발 / 배포" 참고)

## 주의할 점 / 기술 부채

- **Flexbox 중앙 정렬 패턴 주의:** `margin: 0 auto`로 가운데 정렬하는 요소는 반드시 명시적 `width`(또는 `width:100%` + `box-sizing:border-box`)를 함께 지정할 것. 그렇지 않으면 부모가 `display:flex`인 경우 `align-items:stretch`가 무시되고 콘텐츠 양에 따라 너비가 흔들리는 버그가 재발할 수 있음 (2단계에서 실제로 겪은 문제, `src/App.css`의 `.container` 참고).
- **테스트 프레임워크 없음.** 검증은 브라우저 수동 확인 또는 임시 Playwright 스크립트(스크래치패드)로 진행하는 것이 이 프로젝트의 관례. 정식 테스트 도입 여부는 아직 논의된 바 없음.

## 다음 세션 시작 프롬프트 (복사해서 사용)

```
dino-writing-coach 프로젝트를 이어서 작업합니다.
docs/PROJECT_STATUS.md에서 현재 상태와 TODO를 확인해줘.
오늘은 [데이터 저장 / 디노 캐릭터 적용 / 라우팅 / Vercel 배포] 중에서
[여기에 하나 선택 또는 "우선순위대로 제안해줘"]를 진행하고 싶어.
아직 코드는 수정하지 말고 계획부터 세워줘.
```
