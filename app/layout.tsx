import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'VolleyOps',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body style={{ margin: 0, background: '#f5f4f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main style={{ flex: 1, overflow: 'auto' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}