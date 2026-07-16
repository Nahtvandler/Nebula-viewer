export interface GraphNode {
  id: string
  tags: string[]
  label: string
  props: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
  rank: number
  props: Record<string, unknown>
}

export interface GraphStats {
  nodes: number
  edges: number
  latency_ms?: number | null
  truncated?: boolean
}

export interface TableData {
  columns: string[]
  rows: unknown[][]
  truncated?: boolean
}

export interface GraphResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  table?: TableData | null
  stats: GraphStats
}

export interface QueryError {
  error: string
  code?: number | null
}

export interface TagInfo {
  name: string
  count?: number | null
  fields?: string[]
}

export interface EdgeTypeInfo {
  name: string
  count?: number | null
  fields?: string[]
}

export interface SchemaInfo {
  space: string
  tags: TagInfo[]
  edge_types: EdgeTypeInfo[]
}

export interface HealthInfo {
  connected: boolean
  space: string
  address: string
  version?: string | null
  error?: string | null
}

export interface SpacesInfo {
  spaces: string[]
  current: string
}

export type FrameStatus = 'running' | 'graph' | 'error'

export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null

export interface Frame {
  id: number
  query: string
  ts: number
  status: FrameStatus
  collapsed: boolean
  editing: boolean
  draft: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  table?: TableData | null
  hidden: string[]
  selection: Selection
  stats?: GraphStats
  error?: QueryError
  /** VID узлов, для которых сейчас выполняется expand (индикатор загрузки) */
  expanding?: string[]
  /** увеличивается, когда во фрейм добавились узлы (для перезапуска раскладки) */
  layoutSeq: number
}
