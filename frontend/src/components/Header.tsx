import { useMemo } from 'react'
import { useHealth, useSchema } from '../hooks'
import { buildSuggestions } from '../lib/ngql'
import { useStore } from '../store'
import { CodeArea } from './CodeArea'
import { SpaceSelector } from './SpaceSelector'

export function Header() {
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const runQuery = useStore((s) => s.runQuery)
  const clearHistory = useStore((s) => s.clearHistory)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const space = useStore((s) => s.space)
  const { data: health } = useHealth()
  const { data: schema } = useSchema(space)

  const suggestions = useMemo(
    () =>
      buildSuggestions(
        (schema?.tags ?? []).map((t) => t.name),
        (schema?.edge_types ?? []).map((e) => e.name),
      ),
    [schema],
  )

  const connected = health?.connected ?? false

  const ghostBtn = (onClick: () => void, title: string, children: React.ReactNode) => (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--panel-2)'
        e.currentTarget.style.borderColor = 'var(--border-2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '6px 11px',
        cursor: 'pointer',
        color: 'var(--fg-2)',
        fontSize: 12,
      }}
    >
      {children}
    </button>
  )

  return (
    <header
      style={{
        flex: '0 0 auto',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)',
        padding: '11px 16px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingRight: 14, borderRight: '1px solid var(--border)' }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
            <span style={{ fontWeight: 700, fontSize: 13.5, letterSpacing: '.2px' }}>
              Nebula<span style={{ color: 'var(--fg-3)', fontWeight: 600 }}>Viewer</span>
            </span>
          </div>
          <SpaceSelector />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? 'var(--ok)' : 'var(--danger)', boxShadow: `0 0 7px ${connected ? 'var(--ok)' : 'var(--danger)'}` }} />
            <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{connected ? 'Подключено' : 'Нет связи'}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>nebula://{health?.address ?? '—'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {ghostBtn(clearHistory, 'Очистить историю', (<><span style={{ fontSize: 12 }}>⌫</span><span>Очистить</span></>))}
          {ghostBtn(toggleTheme, 'Переключить тему', (
            <span style={{ color: 'var(--fg)' }}>
              <span style={{ fontSize: 13, marginRight: 7 }}>{theme === 'dark' ? '☾' : '☀'}</span>
              <span>{theme === 'dark' ? 'Тёмная' : 'Светлая'}</span>
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CodeArea
            value={query}
            onChange={setQuery}
            onSubmit={() => runQuery()}
            height={78}
            lineNumbers
            suggestions={suggestions}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center', flex: '0 0 auto' }}>
          <button
            onClick={() => runQuery()}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              border: 'none',
              borderRadius: 8,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 10 }}>▶</span> Выполнить
          </button>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'center' }}>⌃ / ⌘ + ⏎</div>
        </div>
      </div>
    </header>
  )
}
