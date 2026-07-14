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

/** Собрать полный список подсказок: словарь + теги/рёбра/поля из схемы. */
export function buildSuggestions(tags: string[], edgeTypes: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...NGQL_KEYWORDS, ...NGQL_FUNCTIONS, ...tags, ...edgeTypes, ...COMMON_FIELDS]) {
    if (!seen.has(item)) {
      seen.add(item)
      out.push(item)
    }
  }
  return out
}
