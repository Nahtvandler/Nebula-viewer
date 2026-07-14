import type { CSSProperties } from 'react'
import { primaryTag, tagColorVar } from '../lib/tags'
import type { Frame } from '../types'

interface Props {
  frame: Frame
  onClose: () => void
  onExpand: (vid: string) => void
  onCollapse: (vid: string) => void
}

const mono = "'IBM Plex Mono', monospace"

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function PropRows({ entries }: { entries: [string, unknown][] }) {
  return (
    <div style={{ margin: '0 14px', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
      {entries.map(([k, v], i) => (
        <div
          key={k + i}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,40%) minmax(0,60%)',
            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
          }}
        >
          <div style={{ padding: '8px 12px', fontFamily: mono, fontSize: 11, color: 'var(--fg-3)', wordBreak: 'break-word' }}>
            {k}
          </div>
          <div
            style={{
              padding: '8px 12px',
              fontFamily: mono,
              fontSize: 12,
              color: 'var(--fg)',
              wordBreak: 'break-word',
              borderLeft: '1px solid var(--border)',
            }}
          >
            {fmt(v)}
          </div>
        </div>
      ))}
    </div>
  )
}

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  width: 314,
  background: 'var(--panel)',
  borderLeft: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  animation: 'ng-panel .2s ease',
  zIndex: 20,
  boxShadow: '-8px 0 24px rgba(0,0,0,.14)',
}

export function PropertiesPanel({ frame, onClose, onExpand, onCollapse }: Props) {
  const sel = frame.selection
  if (!sel) return null

  let kindLabel = ''
  let chips: React.ReactNode = null
  let head: React.ReactNode = null
  let entries: [string, unknown][] = []
  let footer: React.ReactNode = null

  if (sel.kind === 'node') {
    const n = frame.nodes.find((x) => x.id === sel.id)
    if (!n) return null
    kindLabel = 'УЗЕЛ · ТЕГ'
    chips = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {n.tags.map((t) => (
          <span
            key={t}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '3px 9px 3px 7px',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: `var(${tagColorVar(t)})` }} />
            {t}
          </span>
        ))}
      </div>
    )
    head = (
      <div style={{ padding: '15px 14px 4px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 11, wordBreak: 'break-word' }}>{n.label}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '9px 11px',
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            borderRadius: 9,
          }}
        >
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.7px', color: 'var(--fg-3)' }}>VID</span>
          <span
            className="mono"
            style={{ flex: 1, fontSize: 12.5, color: 'var(--fg)', userSelect: 'all', wordBreak: 'break-all' }}
          >
            {n.id}
          </span>
        </div>
      </div>
    )
    entries = Object.entries(n.props)
    const isExpanding = (frame.expanding ?? []).includes(n.id)
    footer = (
      <div
        style={{
          flex: '0 0 auto',
          padding: '12px 14px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          onClick={() => !isExpanding && onExpand(n.id)}
          disabled={isExpanding}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            width: '100%',
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            border: 'none',
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: isExpanding ? 'default' : 'pointer',
            opacity: isExpanding ? 0.75 : 1,
          }}
        >
          {isExpanding ? (
            <>
              <span
                style={{
                  width: 13,
                  height: 13,
                  border: '2px solid var(--accent-fg)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'ng-spin .7s linear infinite',
                }}
              />
              Раскрываю…
            </>
          ) : (
            <>⊕ Раскрыть соседей</>
          )}
        </button>
        <button
          onClick={() => onCollapse(n.id)}
          style={{
            width: '100%',
            background: 'transparent',
            color: 'var(--fg-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 9,
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          ⊖ Схлопнуть связи
        </button>
      </div>
    )
  } else {
    const e = frame.edges.find((x) => x.id === sel.id)
    if (!e) return null
    const a = frame.nodes.find((n) => n.id === e.source)
    const b = frame.nodes.find((n) => n.id === e.target)
    kindLabel = 'РЕБРО · ТИП СВЯЗИ'
    chips = (
      <span
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--panel-2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 9px',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent)',
        }}
      >
        {e.type}
      </span>
    )
    const endpoint = (label: string, tag: string | undefined) => (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '9px 11px',
          background: 'var(--panel-2)',
          border: '1px solid var(--border)',
          borderRadius: 9,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: `var(${tagColorVar(tag)})`, flex: '0 0 auto' }} />
        <span style={{ flex: 1, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      </div>
    )
    head = (
      <div style={{ padding: '15px 14px 4px' }}>
        {endpoint(a?.label ?? e.source, primaryTag(a?.tags ?? []))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', color: 'var(--fg-3)' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
            {e.type} ▶
          </span>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        {endpoint(b?.label ?? e.target, primaryTag(b?.tags ?? []))}
      </div>
    )
    entries = [
      ['@type', e.type],
      ['rank', e.rank],
      ...Object.entries(e.props),
    ]
  }

  return (
    <div style={panelStyle}>
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          padding: '14px 14px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.9px', color: 'var(--fg-3)', marginBottom: 7 }}>
            {kindLabel}
          </div>
          {chips}
        </div>
        <button
          onClick={onClose}
          style={{
            flex: '0 0 auto',
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-3)',
            cursor: 'pointer',
            borderRadius: 6,
            width: 26,
            height: 26,
            fontSize: 15,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {head}
        <div style={{ padding: '16px 14px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '.8px', color: 'var(--fg-3)' }}>
          СВОЙСТВА · {entries.length}
        </div>
        <PropRows entries={entries} />
        <div style={{ height: 16 }} />
      </div>
      {footer}
    </div>
  )
}
