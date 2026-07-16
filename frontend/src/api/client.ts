import type { GraphResult, HealthInfo, QueryError, SchemaInfo, SpacesInfo } from '../types'

const BASE = '/api'

export interface ExpandParams {
  vid: string
  space?: string
  edge_types?: string[]
  direction?: 'both' | 'out' | 'in'
  limit?: number
}

/** Ответ query/expand: либо граф, либо ошибка nGQL (бэкенд отдаёт её 200-м). */
export type GraphResponse = GraphResult | QueryError

export function isQueryError(r: GraphResponse): r is QueryError {
  return (r as QueryError).error !== undefined
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok && res.status !== 200) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  query: (query: string, space?: string) => post<GraphResponse>('/query', { query, space }),
  expand: (params: ExpandParams) => post<GraphResponse>('/expand', params),
  schema: (space?: string) =>
    get<SchemaInfo>(space ? `/schema?space=${encodeURIComponent(space)}` : '/schema'),
  spaces: () => get<SpacesInfo>('/spaces'),
  health: () => get<HealthInfo>('/health'),
  reconnect: () => post<HealthInfo>('/reconnect', {}),
}
