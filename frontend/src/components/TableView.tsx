import { useMemo, useState } from 'react'
import {
  cellToText,
  copyText,
  downloadCsv,
  edgeColumns,
  edgeRow,
  edgesCsv,
  nodeColumns,
  nodeRow,
  nodesCsv,
  resultCsv,
  visibleGraph,
} from '../lib/exportData'
import { tagColorVar } from '../lib/tags'
import type { Frame, Selection } from '../types'

const mono = "'IBM Plex Mono', monospace"

type Tab = 'result' | 'nodes' | 'edges'

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

interface Props {
  frame: Frame
  onSelect: (sel: Selection) => void
}

export function TableView({ frame, onSelect }: Props) {
  const { nodes, edges } = useMemo(() => visibleGraph(frame), [frame])
  const table = frame.table
  const hasResult = !!table && table.columns.length > 0

  const [tab, setTab] = useState<Tab>(() => (hasResult ? 'result' : 'nodes'))

  const tabBtn = (key: Tab, label: string, n: number) => {
    const active = tab === key
    return (
      <button
        key={key}
        onClick={() => setTab(key)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: active ? 'var(--panel-2)' : 'transparent',
          border: '1px solid',
          borderColor: active ? 'var(--border-2)' : 'transparent',
          borderRadius: 7,
          padding: '5px 11px',
          fontSize: 12.5,
          fontWeight: active ? 600 : 500,
          color: active ? 'var(--fg)' : 'var(--fg-2)',
          cursor: 'pointer',
        }}
      >
        {label}
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          {n}
        </span>
      </button>
    )
  }

  const csvText = () =>
    tab === 'result' ? resultCsv(frame) : tab === 'nodes' ? nodesCsv(frame) : edgesCsv(frame)
  const exportCsv = () => downloadCsv(`nebula-${tab}-${frame.id}.csv`, csvText())

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--canvas)',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        {hasResult && tabBtn('result', 'Результат', table!.rows.length)}
        {tabBtn('nodes', 'Узлы', nodes.length)}
        {tabBtn('edges', 'Рёбра', edges.length)}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <CopyButton getText={csvText} title="Скопировать CSV в буфер" label="CSV" icon="⧉" />
          <button
            onClick={exportCsv}
            title="Скачать текущую таблицу в CSV"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '5px 11px',
              fontSize: 12,
              color: 'var(--fg-2)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 12 }}>⤓</span> CSV
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tab === 'result' ? (
          <ResultTable columns={table?.columns ?? []} rows={table?.rows ?? []} truncated={table?.truncated} />
        ) : (
          <EntityTable
            tab={tab}
            columns={tab === 'nodes' ? nodeColumns(nodes) : edgeColumns(edges)}
            rows={tab === 'nodes' ? nodes.map(nodeRow) : edges.map(edgeRow)}
            selection={frame.selection}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  )
}

/** Сырая таблица результата (колонки RETURN, ячейки — текст/скаляры). */
function ResultTable({ columns, rows, truncated }: { columns: string[]; rows: unknown[][]; truncated?: boolean }) {
  if (rows.length === 0) return <div style={emptyStyle}>Запрос не вернул строк.</div>
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>#</th>
          {columns.map((c) => (
            <th key={c} style={thStyle}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={rowStyle}>
            <td style={{ ...tdStyle, color: 'var(--fg-3)', textAlign: 'right', verticalAlign: 'top' }}>
              {i + 1}
            </td>
            {columns.map((_, j) => (
              <ResultCell key={j} value={r[j]} />
            ))}
          </tr>
        ))}
        {truncated && (
          <tr>
            <td style={{ ...tdStyle, color: 'var(--fg-3)' }} colSpan={columns.length + 1}>
              …показаны первые {rows.length} строк
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

/** Таблица узлов/рёбер со структурированными колонками и выделением строки. */
function EntityTable({
  tab,
  columns,
  rows,
  selection,
  onSelect,
}: {
  tab: 'nodes' | 'edges'
  columns: string[]
  rows: Record<string, unknown>[]
  selection: Selection
  onSelect: (sel: Selection) => void
}) {
  if (rows.length === 0) return <div style={emptyStyle}>Нет строк.</div>
  const kindOf = tab === 'nodes' ? 'node' : 'edge'
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>#</th>
          {columns.map((c) => (
            <th key={c} style={thStyle}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const id = String(r.id)
          const sel = !!selection && selection.id === id && selection.kind === kindOf
          return (
            <tr
              key={id + i}
              onClick={() => onSelect({ kind: kindOf, id } as Selection)}
              style={{
                background: sel ? 'color-mix(in oklch, var(--accent) 16%, transparent)' : 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!sel) e.currentTarget.style.background = 'var(--panel-2)'
              }}
              onMouseLeave={(e) => {
                if (!sel) e.currentTarget.style.background = 'transparent'
              }}
            >
              <td style={{ ...tdStyle, color: 'var(--fg-3)', textAlign: 'right' }}>{i + 1}</td>
              {columns.map((c) => {
                if (c === 'tags' && tab === 'nodes') {
                  const first = String(r.tags || '').split(';')[0]
                  return (
                    <td key={c} style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: `var(${tagColorVar(first || undefined)})`,
                          }}
                        />
                        {String(r.tags || '')}
                      </span>
                    </td>
                  )
                }
                return <Cell key={c} value={r[c]} muted={c === 'id'} />
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Cell({ value, muted }: { value: unknown; muted?: boolean }) {
  const text = fmtCell(value)
  return (
    <td style={tdStyle} title={text.length > 60 ? text : undefined}>
      <span
        style={{
          display: 'inline-block',
          maxWidth: 360,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          verticalAlign: 'bottom',
          color: muted ? 'var(--fg-3)' : 'var(--fg)',
        }}
      >
        {text}
      </span>
    </td>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isEntity(v: unknown): v is any {
  return !!v && typeof v === 'object' && '_t' in (v as object)
}

/** Кнопка «скопировать» с галочкой-подтверждением. */
function CopyButton({
  getText,
  title,
  label,
  icon = '⧉',
}: {
  getText: () => string
  title: string
  label?: string
  icon?: string
}) {
  const [ok, setOk] = useState(false)
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation()
        if (await copyText(getText())) {
          setOk(true)
          setTimeout(() => setOk(false), 1200)
        }
      }}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 7,
        padding: label ? '5px 11px' : '3px 5px',
        fontSize: 12,
        lineHeight: 1,
        color: ok ? 'var(--ok)' : 'var(--fg-2)',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 12 }}>{ok ? '✓' : icon}</span>
      {label ? (ok ? 'Скопировано' : label) : null}
    </button>
  )
}

/** Ячейка «Результата»: сложное значение — форматированным блоком, скаляр — строкой. */
function ResultCell({ value }: { value: unknown }) {
  if (isEntity(value)) {
    return (
      <td style={{ ...tdStyle, whiteSpace: 'normal', verticalAlign: 'top', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 5, right: 6, zIndex: 1 }}>
          <CopyButton getText={() => cellToText(value)} title="Скопировать значение" />
        </div>
        <div style={{ paddingRight: 30 }}>
          <EntityValue data={value} />
        </div>
      </td>
    )
  }
  const text = fmtCell(value)
  return (
    <td style={{ ...tdStyle, verticalAlign: 'top' }} title={text.length > 60 ? text : undefined}>
      <span
        style={{
          display: 'inline-block',
          maxWidth: 460,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          verticalAlign: 'bottom',
        }}
      >
        {text}
      </span>
    </td>
  )
}

const P = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: 'var(--fg-3)' }}>{children}</span>
)
const Lbl = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{children}</span>
)

function PropVal({ v }: { v: unknown }) {
  if (v === null || v === undefined) return <span style={{ color: 'var(--fg-3)' }}>null</span>
  if (typeof v === 'number' || typeof v === 'boolean')
    return <span style={{ color: 'var(--accent)' }}>{String(v)}</span>
  if (typeof v === 'object') return <span style={{ color: 'var(--fg)' }}>{JSON.stringify(v)}</span>
  return <span style={{ color: 'var(--fg)' }}>"{String(v)}"</span>
}

function PropLines({ props }: { props: Record<string, unknown> }) {
  const entries = Object.entries(props)
  return (
    <>
      {entries.map(([k, v], i) => (
        <div key={k} style={{ paddingLeft: 18 }}>
          <span style={{ color: 'var(--fg-2)' }}>{k}</span>
          <P>: </P>
          <PropVal v={v} />
          {i < entries.length - 1 ? <P>,</P> : null}
        </div>
      ))}
    </>
  )
}

interface NodeStruct {
  labels: string[]
  props: Record<string, unknown>
}
interface EdgeStruct {
  etype: string
  props: Record<string, unknown>
  forward?: boolean
}

function NodeBlock({ node }: { node: NodeStruct }) {
  return (
    <>
      <div>
        <P>(:</P>
        <Lbl>{node.labels.join(':')}</Lbl>
        <P> {'{'}</P>
      </div>
      <PropLines props={node.props} />
      <div>
        <P>{'})'}</P>
      </div>
    </>
  )
}

function EdgeInPath({ edge }: { edge: EdgeStruct }) {
  const fwd = edge.forward !== false
  return (
    <>
      <div>
        <P>{fwd ? '-[:' : '<-[:'}</P>
        <Lbl>{edge.etype}</Lbl>
        <P> {'{'}</P>
      </div>
      <PropLines props={edge.props} />
      <div>
        <P>{fwd ? '}]->' : '}]-'}</P>
      </div>
    </>
  )
}

/** Форматированный вид вершины/ребра/пути (Neo4j-стиль). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EntityValue({ data }: { data: any }) {
  const base: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 12,
    lineHeight: 1.55,
    color: 'var(--fg)',
  }
  if (data._t === 'node') {
    return (
      <div style={base}>
        <NodeBlock node={data} />
      </div>
    )
  }
  if (data._t === 'edge') {
    return (
      <div style={base}>
        <div>
          <P>[:</P>
          <Lbl>{data.etype}</Lbl>
          <P> {'{'}</P>
        </div>
        <PropLines props={data.props} />
        <div>
          <P>{'}]'}</P>
        </div>
      </div>
    )
  }
  if (data._t === 'path') {
    const nodes: NodeStruct[] = data.nodes ?? []
    const rels: EdgeStruct[] = data.rels ?? []
    return (
      <div style={base}>
        {nodes.map((n, i) => (
          <div key={i}>
            <NodeBlock node={n} />
            {i < rels.length ? <EdgeInPath edge={rels[i]} /> : null}
          </div>
        ))}
      </div>
    )
  }
  return <span style={base}>{JSON.stringify(data)}</span>
}

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: 'max-content',
  minWidth: '100%',
  fontFamily: mono,
  fontSize: 12,
}
const emptyStyle: React.CSSProperties = { padding: 24, color: 'var(--fg-3)', fontSize: 13 }
const rowStyle: React.CSSProperties = {}
const thStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'var(--panel)',
  borderBottom: '1px solid var(--border-2)',
  borderRight: '1px solid var(--border)',
  padding: '7px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--fg-2)',
  whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
  padding: '6px 12px',
  whiteSpace: 'nowrap',
}
