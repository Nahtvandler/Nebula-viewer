import { useEffect, useRef, useState } from 'react'
import { useSpaces } from '../hooks'
import { useStore } from '../store'

export function SpaceSelector() {
  const space = useStore((s) => s.space)
  const setSpace = useStore((s) => s.setSpace)
  const { data } = useSpaces()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const spaces = data?.spaces ?? []

  // Инициализируем текущее пространство, когда список подгрузился.
  useEffect(() => {
    if (space || !data) return
    const initial = data.current && spaces.includes(data.current) ? data.current : spaces[0]
    if (initial) setSpace(initial)
  }, [data, space, spaces, setSpace])

  // Закрытие по клику вне.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
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
          gap: 9,
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 7,
          padding: '5px 11px 5px 10px',
          cursor: 'pointer',
          color: 'var(--fg)',
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.9px', color: 'var(--fg-3)' }}>SPACE</span>
        <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{space || '—'}</span>
        <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 60,
            minWidth: 200,
            maxHeight: 320,
            overflowY: 'auto',
            background: 'var(--panel)',
            border: '1px solid var(--border-2)',
            borderRadius: 9,
            padding: 5,
            boxShadow: '0 12px 36px rgba(0,0,0,.34)',
            animation: 'ng-fade .12s ease',
          }}
        >
          {spaces.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--fg-3)' }}>Нет пространств</div>
          )}
          {spaces.map((s) => {
            const active = s === space
            return (
              <button
                key={s}
                onClick={() => {
                  setSpace(s)
                  setOpen(false)
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--panel-2)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                className="mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  background: active ? 'var(--panel-2)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 12.5,
                  color: 'var(--fg)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 12, color: 'var(--accent)' }}>{active ? '✓' : ''}</span>
                {s}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
