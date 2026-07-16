import type { GraphEdge, GraphNode } from '../types'

// Базовый словарь nGQL для автоподсказок в редакторе.

export const NGQL_KEYWORDS = [
  'MATCH',
  'RETURN',
  'WHERE',
  'LIMIT',
  'SKIP',
  'YIELD',
  'ORDER BY',
  'GROUP BY',
  'WITH',
  'UNWIND',
  'AS',
  'AND',
  'OR',
  'NOT',
  'IN',
  'DISTINCT',
  'GO FROM',
  'OVER',
  'BIDIRECT',
  'REVERSELY',
  'STEPS',
  'UPTO',
  'LOOKUP ON',
  'FETCH PROP ON',
  'GET SUBGRAPH',
  'FIND PATH',
  'SHORTEST',
  'USE',
  'SHOW',
  'DESCRIBE',
]

export const NGQL_FUNCTIONS = [
  'id()',
  'tags()',
  'labels()',
  'properties()',
  'type()',
  'src()',
  'dst()',
  'rank()',
  'startNode()',
  'endNode()',
  'count()',
  'collect()',
  'keys()',
  'length()',
  'size()',
  'toString()',
  'toInteger()',
  'toFloat()',
  'now()',
  'timestamp()',
]

// Часто встречающиеся имена свойств в нашей схеме.
export const COMMON_FIELDS = [
  'name',
  'id',
  'key',
  'type',
  'status',
  'description',
  'updated_at',
  'path',
  'file_path',
  'owner',
  'method',
]

/** Карта тег/тип-ребра → имена полей, собранная из свойств узлов и рёбер
 *  результата. Даёт контекстные подсказки полей по конкретному тегу. */
export function collectFieldsByTag(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Record<string, string[]> {
  const m: Record<string, Set<string>> = {}
  const add = (label: string, keys: string[]) => {
    if (!label) return
    const set = (m[label] ??= new Set())
    for (const k of keys) set.add(k)
  }
  for (const n of nodes) for (const tag of n.tags) add(tag, Object.keys(n.props))
  for (const e of edges) add(e.type, Object.keys(e.props))
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(m)) out[k] = [...v].sort()
  return out
}

/** Слить несколько карт полей (напр. со всех фреймов истории) в одну. */
export function mergeFieldsByTag(maps: Record<string, string[]>[]): Record<string, string[]> {
  const m: Record<string, Set<string>> = {}
  for (const map of maps)
    for (const [tag, fields] of Object.entries(map)) {
      const set = (m[tag] ??= new Set())
      for (const f of fields) set.add(f)
    }
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(m)) out[k] = [...v].sort()
  return out
}

/** Разобрать привязки переменных к тегам/типам из текста запроса:
 *  `(c:Component)` → c→Component, `[e:CALLS]` → e→CALLS. */
export function parseVarTags(query: string): Record<string, string> {
  const map: Record<string, string> = {}
  const re = /[([]\s*([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(query)) !== null) map[m[1]] = m[2]
  return map
}

/** Собрать полный список подсказок: словарь + теги/рёбра + поля (из схемы и,
 *  при редактировании, из свойств узлов/рёбер уже полученного результата). */
export function buildSuggestions(
  tags: string[],
  edgeTypes: string[],
  fields: string[] = [],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [
    ...NGQL_KEYWORDS,
    ...NGQL_FUNCTIONS,
    ...tags,
    ...edgeTypes,
    ...COMMON_FIELDS,
    ...fields,
  ]) {
    if (item && !seen.has(item)) {
      seen.add(item)
      out.push(item)
    }
  }
  return out
}
