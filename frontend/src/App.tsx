import { useEffect } from 'react'
import { Header } from './components/Header'
import { SchemaSidebar } from './components/SchemaSidebar'
import { FrameStream } from './components/FrameStream'
import { useStore } from './store'

export default function App() {
  const theme = useStore((s) => s.theme)

  // Тема управляет всем через data-theme на <html>.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: 640,
        minWidth: 1080,
        background: 'var(--bg)',
        color: 'var(--fg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Header />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <SchemaSidebar />
        <FrameStream />
      </div>
    </div>
  )
}
