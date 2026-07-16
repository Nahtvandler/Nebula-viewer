import { useEffect, useMemo, useState } from 'react'
import { useSchema } from '../hooks'
import { Highlight } from '../lib/highlight'
import { buildSuggestions, collectFieldsByTag } from '../lib/ngql'
import { useStore } from '../store'
import type { Frame as FrameType } from '../types'
import { CodeArea } from './CodeArea'
import { ContextMenu, type ExpandDir, type MenuState } from './ContextMenu'
import { GraphCanvas } from './GraphCanvas'
import { PropertiesPanel } from './PropertiesPanel'
import { TableView } from './TableView'

const mono = "'IBM Plex Mono', monospace"
const BODY_HEIGHT = 480

function metaText(f: FrameType): string {
  const time = new Date(f.ts).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  let meta: string
  if (f.status === 'running') meta = 'выполняется…'
  else if (f.status === 'error') meta = 'ошибка'
  else {
    const hidden = new Set(f.hidden)
    const nodes = f.nodes.filter((n) => !hidden.has(n.id))
    const ids = new Set(nodes.map((n) => n.id))
    const edges = f.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
    meta = `${nodes.length} узл. · ${edges.length} реб.`
  }
  return `${meta}   ·   ${time}`
}

const iconBtn = (title: string, onClick: (e: React.MouseEvent) => void, glyph: string, fontSize = 13) => (
  <button
    title={title}
    onClick={onClick}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--panel-2)'
      e.currentTarget.style.color = 'var(--fg)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent'
      e.currentTarget.style.color = 'var(--fg-3)'
    }}
    style={{
      width: 28,
      height: 28,
      background: 'transparent',
      border: 'none',
      borderRadius: 6,
      color: 'var(--fg-3)',
      cursor: 'pointer',
      fontSize,
    }}
  >
    {glyph}
  </button>
)

export function Frame({ frame }: { frame: FrameType }) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [view, setView] = useState<'graph' | 'table'>('graph')
  const [maximized, setMaximized] = useState(false)
  const theme = useStore((s) => s.theme)
  const focusTag = useStore((s) => s.focusTag)
  const setFocusTag = useStore((s) => s.setFocusTag)
  const {
    toggleCollapse,
    startEdit,
    cancelEdit,
    setDraft,
    execEdit,
    rerunFrame,
    closeFrame,
    select,
    expandNode,
    hideNode,
    collapseNode,
  } = useStore()

  const doExpand = (vid: string, dir: ExpandDir = 'both') => {
    void expandNode(frame.id, vid, dir)
    setMenu(null)
  }

  // Подсказки для редактора истории: словарь + теги/рёбра из схемы + имена
  // полей, реально присутствующих в свойствах узлов/рёбер этого результата.
  const space = useStore((s) => s.space)
  const { data: schema } = useSchema(space)
  const fieldKeys = useMemo(() => {
    const s = new Set<string>()
    for (const n of frame.nodes) for (const k of Object.keys(n.props)) s.add(k)
    for (const e of frame.edges) for (const k of Object.keys(e.props)) s.add(k)
    return [...s]
  }, [frame.nodes, frame.edges])
  const suggestions = useMemo(
    () =>
      buildSuggestions(
        (schema?.tags ?? []).map((t) => t.name),
        (schema?.edge_types ?? []).map((e) => e.name),
        fieldKeys,
      ),
    [schema, fieldKeys],
  )
  const fieldsByTag = useMemo(
    () => collectFieldsByTag(frame.nodes, frame.edges),
    [frame.nodes, frame.edges],
  )

  const statusColor =
    frame.status === 'error' ? '--danger' : frame.status === 'running' ? '--fg-3' : '--ok'
  const oneLine = frame.query.replace(/\s+/g, ' ').trim()

  // Граф и таблица доступны независимо: скалярный RETURN даёт таблицу без графа.
  const hasGraph = frame.status === 'graph' && frame.nodes.length > 0
  const hasTable = (frame.table?.rows.length ?? 0) > 0
  const showToggle = hasGraph && hasTable
  // Нет графа, но есть таблица → сразу показываем таблицу.
  const effView: 'graph' | 'table' = hasGraph ? view : hasTable ? 'table' : 'graph'

  // Esc выходит из полноэкранного режима.
  useEffect(() => {
    if (!maximized) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaximized(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maximized])

  const openCtx = (vid: string, pos: { x: number; y: number }) => {
    const node = frame.nodes.find((n) => n.id === vid)
    setMenu({ vid, label: node?.label ?? vid, x: Math.min(pos.x, 100000), y: pos.y })
  }
  const copyVid = (vid: string) => {
    try {
      void navigator.clipboard?.writeText(vid)
    } catch {
      /* ignore */
    }
  }

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginBottom: 14,
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--panel)',
        boxShadow: '0 6px 20px rgba(0,0,0,.16)',
        animation: 'ng-frame .22s ease',
      }}
    >
      {/* заголовок — клик по нему открывает редактирование запроса */}
      <div
        onClick={() => startEdit(frame.id)}
        title="Клик — редактировать запрос"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '9px 11px 9px 9px',
          borderBottom: frame.collapsed ? 'none' : '1px solid var(--border)',
          background: 'var(--panel)',
          cursor: 'pointer',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleCollapse(frame.id)
          }}
          title={frame.collapsed ? 'Развернуть' : 'Свернуть'}
          style={{
            flex: '0 0 auto',
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-3)',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'transform .15s',
            transform: `rotate(${frame.collapsed ? '0deg' : '90deg'})`,
          }}
        >
          ▶
        </button>
        <span
          style={{
            flex: '0 0 auto',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: `var(${statusColor})`,
            boxShadow: `0 0 6px var(${statusColor})`,
          }}
        />
        <pre
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontFamily: mono,
            fontSize: 12.5,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'var(--fg)',
          }}
        >
          <Highlight code={oneLine} />
        </pre>
        <span className="mono" style={{ flex: '0 0 auto', fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
          {metaText(frame)}
        </span>
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {showToggle && (
            <div
              style={{
                display: 'flex',
                border: '1px solid var(--border)',
                borderRadius: 7,
                overflow: 'hidden',
              }}
            >
              {(['graph', 'table'] as const).map((v) => {
                const active = view === v
                return (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    title={v === 'graph' ? 'Граф' : 'Таблица'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: active ? 'var(--panel-2)' : 'transparent',
                      border: 'none',
                      color: active ? 'var(--fg)' : 'var(--fg-3)',
                      cursor: 'pointer',
                      padding: '5px 9px',
                      fontSize: 12,
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{v === 'graph' ? '◱' : '▦'}</span>
                    {v === 'graph' ? 'Граф' : 'Таблица'}
                  </button>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {(hasGraph || hasTable) && iconBtn('На весь экран', () => setMaximized(true), '⤢', 14)}
            {iconBtn('Редактировать запрос', () => startEdit(frame.id), '✎')}
            {iconBtn('Выполнить снова', () => rerunFrame(frame.id), '↻', 14)}
            {iconBtn('Закрыть', () => closeFrame(frame.id), '✕', 14)}
          </div>
        </div>
      </div>

      {/* редактор */}
      {frame.editing && (
        <div
          style={{
            padding: '11px 12px',
            background: 'var(--panel-2)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
          }}
        >
          <CodeArea
            value={frame.draft}
            onChange={(v) => setDraft(frame.id, v)}
            onSubmit={() => execEdit(frame.id)}
            height={88}
            autoFocus
            background="var(--canvas)"
            paddingLeft={12}
            suggestions={suggestions}
            fieldsByTag={fieldsByTag}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <button
              onClick={() => execEdit(frame.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                border: 'none',
                borderRadius: 7,
                padding: '7px 15px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 9 }}>▶</span> Выполнить
            </button>
            <button
              onClick={() => cancelEdit(frame.id)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--fg-2)',
                borderRadius: 7,
                padding: '7px 14px',
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 'auto' }}>
              ⌃ / ⌘ + ⏎
            </span>
          </div>
        </div>
      )}

      {/* тело */}
      {!frame.collapsed && (() => {
        const body = (
          <FrameBody frame={frame} theme={theme} focusTag={focusTag} menu={menu} view={effView} maximized={maximized}
            onSelect={(sel) => { select(frame.id, sel); if (sel === null) setMenu(null) }}
            onExpand={doExpand}
            onFocusTag={setFocusTag}
            onContextMenu={openCtx}
            onCloseMenu={() => setMenu(null)}
            onHide={(vid) => { hideNode(frame.id, vid); setMenu(null) }}
            onCollapse={(vid) => { collapseNode(frame.id, vid); setMenu(null) }}
            onCopyVid={(vid) => { copyVid(vid); setMenu(null) }}
          />
        )
        // Дерево держим стабильным (display:contents в обычном режиме), чтобы
        // при входе/выходе из полноэкранного графа canvas НЕ перемонтировался
        // и не терял раскладку/закрепления — меняется только стиль.
        return (
          <div style={maximized ? { position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } : { display: 'contents' }}>
            <div style={{ display: maximized ? 'flex' : 'none', flex: '0 0 auto', alignItems: 'center', gap: 12, padding: '9px 14px', borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
              <pre style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: mono, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Highlight code={oneLine} />
              </pre>
              <button
                onClick={() => setMaximized(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 12.5 }}
              >
                ⤡ Свернуть <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>Esc</span>
              </button>
            </div>
            <div style={maximized ? { flex: 1, minHeight: 0, position: 'relative' } : { display: 'contents' }}>{body}</div>
          </div>
        )
      })()}
    </section>
  )
}

interface BodyProps {
  frame: FrameType
  theme: string
  focusTag: string | null
  menu: MenuState | null
  view: 'graph' | 'table'
  maximized: boolean
  onSelect: (sel: import('../types').Selection) => void
  onExpand: (vid: string, dir?: ExpandDir) => void
  onFocusTag: (tag: string) => void
  onContextMenu: (vid: string, pos: { x: number; y: number }) => void
  onCloseMenu: () => void
  onHide: (vid: string) => void
  onCollapse: (vid: string) => void
  onCopyVid: (vid: string) => void
}

function FrameBody({ frame, theme, focusTag, menu, view, maximized, onSelect, onExpand, onFocusTag, onContextMenu, onCloseMenu, onHide, onCollapse, onCopyVid }: BodyProps) {
  const bodyHeight = maximized ? '100%' : BODY_HEIGHT
  if (frame.status === 'running') {
    return (
      <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--canvas)' }}>
        <div style={{ width: 34, height: 34, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'ng-spin .8s linear infinite' }} />
        <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>Выполнение запроса…</div>
      </div>
    )
  }

  if (frame.status === 'error') {
    return (
      <div style={{ padding: '20px 22px', background: 'var(--canvas)' }}>
        <div style={{ maxWidth: 560, background: 'var(--panel)', border: '1px solid color-mix(in oklch,var(--danger) 45%,var(--border))', borderRadius: 11, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px', borderBottom: '1px solid var(--border)', background: 'color-mix(in oklch,var(--danger) 12%,var(--panel))' }}>
            <span style={{ width: 22, height: 22, flex: '0 0 auto', borderRadius: '50%', background: 'var(--danger)', color: 'var(--danger-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>!</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Ошибка выполнения nGQL</span>
            {frame.error?.code != null && (
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--danger)' }}>{frame.error.code}</span>
            )}
          </div>
          <div className="mono" style={{ padding: '14px 15px', fontSize: 12.5, lineHeight: 1.65, color: 'var(--fg-2)' }}>
            <div style={{ color: 'var(--danger)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{frame.error?.error}</div>
            <div style={{ marginTop: 9, color: 'var(--fg-3)' }}>Проверьте ключевые слова (RETURN, MATCH) и синтаксис.</div>
            <div style={{ marginTop: 11, display: 'flex', gap: 9 }}>
              <button onClick={() => useStore.getState().rerunFrame(frame.id)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--fg)', borderRadius: 7, padding: '8px 15px', fontSize: 12.5, cursor: 'pointer' }}>↻ Повторить</button>
              <button onClick={() => useStore.getState().startEdit(frame.id)} style={{ background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 7, padding: '8px 15px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Исправить запрос</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isEmpty = frame.nodes.length === 0

  // Табличный вид — как вкладка Table в Neo4j (в т.ч. для скалярного RETURN,
  // когда граф пуст, но таблица результата есть).
  if (view === 'table') {
    return (
      <div style={{ position: 'relative', height: bodyHeight, overflow: 'hidden', background: 'var(--canvas)' }}>
        <TableView frame={frame} onSelect={onSelect} />
      </div>
    )
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        height: bodyHeight,
        overflow: 'hidden',
        background: 'var(--canvas)',
        backgroundImage: 'radial-gradient(var(--grid) 1.1px, transparent 1.1px)',
        backgroundSize: '22px 22px',
      }}
    >
      {isEmpty ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)', fontSize: 13.5 }}>
          Запрос выполнен, но не вернул узлов графа.
        </div>
      ) : (
        <GraphCanvas
          frame={frame}
          theme={theme}
          focusTag={focusTag}
          onSelect={onSelect}
          onExpand={(vid) => onExpand(vid)}
          onHide={onHide}
          onFocusTag={onFocusTag}
          onContextMenu={onContextMenu}
        />
      )}

      {menu && (
        <ContextMenu
          menu={menu}
          onClose={onCloseMenu}
          onExpand={(dir) => onExpand(menu.vid, dir)}
          onCollapse={() => onCollapse(menu.vid)}
          onHide={() => onHide(menu.vid)}
          onProps={() => { onSelect({ kind: 'node', id: menu.vid }); onCloseMenu() }}
          onCopyVid={() => onCopyVid(menu.vid)}
        />
      )}

      <PropertiesPanel frame={frame} onClose={() => onSelect(null)} />
    </div>
  )
}
