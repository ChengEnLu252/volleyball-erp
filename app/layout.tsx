import type { Metadata } from 'next'
import './globals.css'
import ChromeShell from '@/components/ChromeShell'

export const metadata: Metadata = {
  title: 'VolleyOps',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      {/* body 樣式（背景 / 字體）改由 globals.css 統一管理，這裡保持乾淨 */}
      <body>
        <ChromeShell>{children}</ChromeShell>
      </body>
    </html>
  )
}
