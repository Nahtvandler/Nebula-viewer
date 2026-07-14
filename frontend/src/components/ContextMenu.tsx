import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

export interface MenuState {
  vid: string
  label: string
  x: number
  y: number
}

export type ExpandDir = 'both' | 'out' | 'in'

interface Props {
  menu: MenuState
  onClose: () => void
  onExpand: (dir: ExpandDir) => void
  onCollapse: () => void
  onHide: () => void
  onProps: () => void
  onCopyVid: () => void
}

const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  background: 'transparent',
  border: 'none',
  color: 'var(--fg)',
  cursor: 'pointer',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 12.5,
  textAlign: 'left',
}

function Item({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      style={itemStyle}
    >
      <span style={{ width: 16, textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  )
}

export function ContextMenu({ menu, onClose, onExpand, onCollapse, onHide, onProps, onCopyVid }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: menu.x, top: menu.y })

  // Держим меню внутри границ канваса — не даём уехать за правый/нижний край.
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) {
      setPos({ left: Math.max(6, menu.x), top: Math.max(6, menu.y) })
      return
    }
    const pw = parent.clientWidth
    const ph = parent.clientHeight
    const mw = el.offsetWidth
    const mh = el.offsetHeight
    setPos({
      left: Math.max(6, Math.min(menu.x, pw - mw - 6)),
      top: Math.max(6, Math.min(menu.y, ph - mh - 6)),
    })
  }, [menu.x, menu.y, menu.vid])

  return (
    <>
      <div
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
        style={{ position: 'absolute', inset: 0, zIndex: 40 }}
      />
      <div
        ref={ref}
        style={{
          position: 'absolute',
          left: pos.left,
          top: pos.top,
          zIndex: 41,
          minWidth: 210,
          maxWidth: 224,
          background: 'var(--panel)',
          border: '1px solid var(--border-2)',
          borderRadius: 10,
          padding: 5,
          boxShadow: '0 12px 36px rgba(0,0,0,.34)',
          animation: 'ng-fade .12s ease',
        }}
      >
        <div
          className="mono"
          style={{
            padding: '7px 10px 8px',
            fontSize: 11,
            color: 'var(--fg-3)',
            borderBottom: '1px solid var(--border)',
            marginBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {menu.label}
        </div>
        <Item icon="⊕" label="Раскрыть соседей" onClick={() => onExpand('both')} />
        <Item icon="→" label="Только исходящие" onClick={() => onExpand('out')} />
        <Item icon="←" label="Только входящие" onClick={() => onExpand('in')} />
        <Item icon="⊖" label="Схлопнуть связи" onClick={onCollapse} />
        <Item icon="◌" label="Скрыть узел" onClick={onHide} />
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
        <Item icon="☰" label="Свойства" onClick={onProps} />
        <Item icon="⧉" label="Скопировать VID" onClick={onCopyVid} />
      </div>
    </>
  )
}
