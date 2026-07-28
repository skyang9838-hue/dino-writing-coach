import localFont from 'next/font/local'
import './globals.css'

// Pretendard (self-hosted via the `pretendard` npm package) — the app's single
// typeface. Exposed as a CSS variable so globals.css can put it on `body` and
// let everything (including form controls) inherit it.
const pretendard = localFont({
  src: '../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2',
  weight: '45 920',
  style: 'normal',
  display: 'swap',
  variable: '--font-pretendard',
})

export const metadata = {
  title: '🦕 디노 글쓰기 코치',
  description: '초등학생을 위한 과정 중심 AI 글쓰기 코치',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  )
}
