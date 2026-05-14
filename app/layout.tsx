import type { Metadata } from 'next'
import './globals.css'
import ChromeShell from '@/components/ChromeShell'

export const metadata: Metadata = {
  title: 'VolleyOps',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body style={{ margin: 0, background: '#f5f4f0', fontFamily: 'system-ui, sans-serif' }}>
        <ChromeShell>{children}</ChromeShell>
      </body>
    </html>
  )
}