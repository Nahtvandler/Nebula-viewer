import type { Frame, GraphEdge, GraphNode } from '../types'

/** Видимая часть графа фрейма (без скрытых узлов и висящих рёбер). */
export function visibleGraph(frame: Frame): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const hidden = new Set(frame.hidden)
  const nodes = frame.nodes.filter((n) => !hidden.has(n.id))
  const ids = new Set(nodes.map((n) => n.id))
  const edges = frame.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
  return { nodes, edges }
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(name: string, text: string, mime: string) {
  downloadBlob(name, new Blob([text], { type: mime }))
}

/** Скопировать текст в буфер обмена. Возвращает true при успехе. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Фолбэк для окружений без Clipboard API (напр. небезопасный контекст).
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/** CSV c UTF-8 BOM — иначе Excel коверкает кириллицу. */
export function downloadCsv(name: string, csv: string) {
  downloadBlob(name, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const head = columns.map(csvCell).join(',')
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(',')).join('\r\n')
  return body ? `${head}\r\n${body}` : head
}

/** Колонки таблицы узлов: фиксированные + объединение ключей свойств. */
export function nodeColumns(nodes: GraphNode[]): string[] {
  const keys = new Set<string>()
  nodes.forEach((n) => Object.keys(n.props).forEach((k) => keys.add(k)))
  return ['id', 'label', 'tags', ...[...keys].sort()]
}

export function edgeColumns(edges: GraphEdge[]): string[] {
  const keys = new Set<string>()
  edges.forEach((e) => Object.keys(e.props).forEach((k) => keys.add(k)))
  return ['id', 'type', 'source', 'target', 'rank', ...[...keys].sort()]
}

export function nodeRow(n: GraphNode): Record<string, unknown> {
  return { id: n.id, label: n.label, tags: n.tags.join(';'), ...n.props }
}

export function edgeRow(e: GraphEdge): Record<string, unknown> {
  return { id: e.id, type: e.type, source: e.source, target: e.target, rank: e.rank, ...e.props }
}

export function nodesCsv(frame: Frame): string {
  const { nodes } = visibleGraph(frame)
  return toCsv(nodes.map(nodeRow), nodeColumns(nodes))
}

export function edgesCsv(frame: Frame): string {
  const { edges } = visibleGraph(frame)
  return toCsv(edges.map(edgeRow), edgeColumns(edges))
}

export function graphJson(frame: Frame): string {
  const { nodes, edges } = visibleGraph(frame)
  return JSON.stringify({ query: frame.query, nodes, edges }, null, 2)
}

function propsText(p: Record<string, unknown>): string {
  return Object.entries(p)
    .map(([k, v]) => `${k}: ${v === null || v === undefined ? 'null' : String(v)}`)
    .join(', ')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isEntity(v: unknown): v is any {
  return !!v && typeof v === 'object' && '_t' in (v as object)
}

/** Плоский текст ячейки (вершина/ребро/путь → одна строка) для CSV. */
export function cellToText(v: unknown): string {
  if (isEntity(v)) {
    if (v._t === 'node') return `(:${v.labels.join(':')} {${propsText(v.props)}})`
    if (v._t === 'edge') return `[:${v.etype} {${propsText(v.props)}}]`
    if (v._t === 'path') {
      let s = ''
      v.nodes.forEach((n: { labels: string[]; props: Record<string, unknown> }, i: number) => {
        s += `(:${n.labels.join(':')} {${propsText(n.props)}})`
        const r = v.rels[i]
        if (r) {
          const et = `[:${r.etype} {${propsText(r.props)}}]`
          s += r.forward ? `-${et}->` : `<-${et}-`
        }
      })
      return s
    }
  }
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** CSV сырой результирующей таблицы (колонки RETURN). */
export function resultCsv(frame: Frame): string {
  const t = frame.table
  if (!t || t.columns.length === 0) return ''
  const head = t.columns.map(csvCell).join(',')
  const body = t.rows.map((r) => r.map((c) => csvCell(cellToText(c))).join(',')).join('\r\n')
  return body ? `${head}\r\n${body}` : head
}
