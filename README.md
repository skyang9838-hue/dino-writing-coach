# 디노 글쓰기 코치 (Dino Writing Coach)

어린이를 위한 글쓰기 연습 웹앱입니다. 주제를 정하고 400자 글쓰기를 마치면 AI(Gemini)가 코칭 피드백을 줍니다.

## 기능

- 글쓰기 주제 입력 + 글자 수 실시간 카운트 / 진행 바
- 400자 달성 시 "디노 코칭 받기" 버튼 활성화
- Gemini API 연동 코칭 피드백 (잘한 점 1 + 보완할 점 2)
- 수정할수록 오르는 **도달도** 시각화 (40%에서 시작, 보완점을 고칠 때마다 상승)
- **API 키는 서버에만 저장** — Gemini API 키는 Vercel 서버리스 함수(`api/coach.js`)의 환경변수로만 존재하고 브라우저에는 절대 노출되지 않음

## 시작하기

```bash
npm install
npm run dev
```

`/api/coach`까지 포함해서 로컬에서 테스트하려면 [Vercel CLI](https://vercel.com/docs/cli)로 실행해야 합니다:

```bash
npx vercel dev
```

이 경우 프로젝트 루트에 `.env` 파일을 만들고 `GEMINI_API_KEY=발급받은_키`를 넣어야 합니다 (`.env.example` 참고).

## 기술 스택

React, Vite, oxlint

## 프로젝트 현황

현재 진행 상황, 완료된 기능, TODO는 [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)에서 확인할 수 있습니다.
