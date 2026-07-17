import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useHealth, useSchema } from '../hooks'
import { buildSuggestions, collectFieldsByTag, mergeFieldsByTag, schemaFieldsByTag } from '../lib/ngql'
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
  const frames = useStore((s) => s.frames)
  const { data: health } = useHealth()
  const { data: schema } = useSchema(space)
  const qc = useQueryClient()
  const [reconnecting, setReconnecting] = useState(false)

  const doReconnect = async () => {
    setReconnecting(true)
    try {
      await api.reconnect()
    } catch {
      /* игнорируем — статус подтянет health */
    }
    await qc.invalidateQueries({ queryKey: ['health'] })
    await qc.invalidateQueries({ queryKey: ['spaces'] })
    await qc.invalidateQueries({ queryKey: ['schema'] })
    setReconnecting(false)
  }

  // Поля берём СРАЗУ из схемы (DESCRIBE) + дополняем фактическими из результатов
  // истории. Так подсказки по полям (в т.ч. контекстные c.Component.<field>)
  // доступны без ожидания первого запроса.
  const fieldsByTag = useMemo(
    () =>
      mergeFieldsByTag([
        schemaFieldsByTag(schema?.tags ?? [], schema?.edge_types ?? []),
        ...frames.map((f) => collectFieldsByTag(f.nodes, f.edges)),
      ]),
    [schema, frames],
  )
  const suggestions = useMemo(
    () =>
      buildSuggestions(
        (schema?.tags ?? []).map((t) => t.name),
        (schema?.edge_types ?? []).map((e) => e.name),
        [...new Set(Object.values(fieldsByTag).flat())],
      ),
    [schema, fieldsByTag],
  )

  const connected = health?.connected ?? false

  // Выполнить запрос из верхнего поля: очистить поле и проскроллить ленту
  // результатов наверх (новый фрейм добавляется первым), если она была прокручена.
  const handleRun = () => {
    if (!query.trim()) return
    runQuery(query)
    setQuery('')
    requestAnimationFrame(() =>
      document.getElementById('frame-stream')?.scrollTo({ top: 0, behavior: 'smooth' }),
    )
  }

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
            <button
              onClick={doReconnect}
              disabled={reconnecting}
              title="Переподключиться к Nebula"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                color: connected ? 'var(--fg-3)' : 'var(--danger)',
                cursor: reconnecting ? 'default' : 'pointer',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 13,
                  animation: reconnecting ? 'ng-spin .7s linear infinite' : 'none',
                }}
              >
                ↻
              </span>
            </button>
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
            onSubmit={handleRun}
            height={78}
            lineNumbers
            suggestions={suggestions}
            fieldsByTag={fieldsByTag}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center', flex: '0 0 auto' }}>
          <button
            onClick={handleRun}
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
