import './globals.css'

export const metadata = {
  title: '🦕 디노 글쓰기 코치',
  description: '초등학생을 위한 과정 중심 AI 글쓰기 코치',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
