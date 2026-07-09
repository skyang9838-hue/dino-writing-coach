# 디노 글쓰기 코치 (Dino Writing Coach)

어린이를 위한 글쓰기 연습 웹앱입니다. 주제를 정하고 400자 글쓰기를 마치면 AI(Gemini)가 코칭 피드백을 줍니다.

## 기능

- 글쓰기 주제 입력 + 글자 수 실시간 카운트 / 진행 바
- 400자 달성 시 "디노 코칭 받기" 버튼 활성화
- Gemini API 연동 코칭 피드백 (칭찬 1 + 개선 제안 2)
- **BYOK(Bring Your Own Key)** 방식 — 각자 자신의 Gemini API 키를 브라우저 `localStorage`에만 저장해서 사용, 서버/프록시 불필요

## 시작하기

```bash
npm install
npm run dev
```

앱 실행 후 [Google AI Studio](https://aistudio.google.com/apikey)에서 발급받은 Gemini API 키를 입력하면 코칭 기능을 사용할 수 있습니다.

## 기술 스택

React, Vite, oxlint

## 프로젝트 현황

현재 진행 상황, 완료된 기능, TODO는 [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)에서 확인할 수 있습니다.
