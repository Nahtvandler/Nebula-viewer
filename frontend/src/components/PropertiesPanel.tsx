import { useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { copyText } from '../lib/exportData'
import { primaryTag, tagColorVar } from '../lib/tags'
import { useStore } from '../store'
import type { Frame } from '../types'

interface Props {
  frame: Frame
  onClose: () => void
}

const mono = "'IBM Plex Mono', monospace"

/** Маленькая кнопка копирования с галочкой. */
function CopyMini({ text, title }: { text: string; title: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      onClick={async () => {
        if (await copyText(text)) {
          setOk(true)
          setTimeout(() => setOk(false), 1200)
        }
      }}
      title={title}
      style={{
        flex: '0 0 auto',
        background: 'transparent',
        border: 'none',
        color: ok ? 'var(--ok)' : 'var(--fg-3)',
        cursor: 'pointer',
        fontSize: 13,
        lineHeight: 1,
        padding: '2px 4px',
      }}
    >
      {ok ? '✓' : '⧉'}
    </button>
  )
}

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
  background: 'var(--panel)',
  borderLeft: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  animation: 'ng-panel .2s ease',
  zIndex: 20,
  boxShadow: '-8px 0 24px rgba(0,0,0,.14)',
}

export function PropertiesPanel({ frame, onClose }: Props) {
  const panelWidth = useStore((s) => s.panelWidth)
  const setPanelWidth = useStore((s) => s.setPanelWidth)
  const panelRef = useRef<HTMLDivElement>(null)

  // Тянем левую грань — меняем ширину панели (сохраняется в сторе/localStorage).
  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault()
    const parent = panelRef.current?.offsetParent as HTMLElement | null
    const right = parent ? parent.getBoundingClientRect().right : window.innerWidth
    const onMove = (ev: globalThis.MouseEvent) => setPanelWidth(right - ev.clientX)
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const sel = frame.selection
  if (!sel) return null

  let kindLabel = ''
  let chips: React.ReactNode = null
  let head: React.ReactNode = null
  let entries: [string, unknown][] = []

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
          <CopyMini text={n.id} title="Скопировать VID" />
        </div>
      </div>
    )
    entries = Object.entries(n.props)
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
    <div ref={panelRef} style={{ ...panelStyle, width: panelWidth }}>
      {/* ручка изменения ширины на левой грани */}
      <div
        onMouseDown={startResize}
        title="Потянуть — изменить ширину"
        style={{
          position: 'absolute',
          left: -3,
          top: 0,
          bottom: 0,
          width: 7,
          cursor: 'col-resize',
          zIndex: 22,
        }}
      />
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
    </div>
  )
}
