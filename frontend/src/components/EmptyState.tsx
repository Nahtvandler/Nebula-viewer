import { useStore } from '../store'

interface Props {
  onRunExample: () => void
}

// Рабочие для nGQL (Nebula) шаблоны. Nebula НЕ поддерживает Neo4j-синтаксис
// (:A|B) и WHERE v:A — вместо них UNION / tags(), а подстрока — CONTAINS.
const EXAMPLES: { title: string; hint: string; query: string }[] = [
  {
    title: 'Несколько тегов',
    hint: 'через tags() — аналог (:A|B) из Neo4j',
    query: "MATCH (v)\nWHERE 'ТегA' IN tags(v) OR 'ТегB' IN tags(v)\nRETURN v LIMIT 100",
  },
  {
    title: 'Несколько тегов (UNION)',
    hint: 'если нужен строгий обход по каждому тегу',
    query: 'MATCH (v:ТегA) RETURN v LIMIT 50\nUNION\nMATCH (v:ТегB) RETURN v LIMIT 50',
  },
  {
    title: 'Поиск по подстроке',
    hint: 'CONTAINS по свойству — аналог contains из Neo4j',
    query: "MATCH (v:Тег)\nWHERE v.Тег.name CONTAINS 'текст'\nRETURN v LIMIT 100",
  },
]

export function EmptyState({ onRunExample }: Props) {
  const setQuery = useStore((s) => s.setQuery)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 420, padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center', animation: 'ng-fade .4s ease' }}>
        <svg width="132" height="92" viewBox="0 0 132 92" style={{ marginBottom: 20, opacity: 0.9 }}>
          <line x1="30" y1="46" x2="66" y2="22" stroke="var(--edge)" strokeWidth="1.5" />
          <line x1="30" y1="46" x2="66" y2="70" stroke="var(--edge)" strokeWidth="1.5" />
          <line x1="66" y1="22" x2="104" y2="34" stroke="var(--edge)" strokeWidth="1.5" />
          <line x1="66" y1="70" x2="104" y2="60" stroke="var(--edge)" strokeWidth="1.5" />
          <circle cx="30" cy="46" r="13" fill="var(--tag-component)" />
          <circle cx="66" cy="22" r="10" fill="var(--tag-module)" />
          <circle cx="66" cy="70" r="10" fill="var(--tag-endpoint)" />
          <circle cx="104" cy="34" r="8" fill="var(--tag-dto)" />
          <circle cx="104" cy="60" r="8" fill="var(--tag-external)" />
        </svg>
        <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 9 }}>История запросов пуста</div>
        <div style={{ fontSize: 13.5, color: 'var(--fg-2)', lineHeight: 1.55, marginBottom: 18 }}>
          Введите nGQL-запрос сверху и нажмите «Выполнить». Каждый запуск добавит сюда отдельную секцию с запросом и
          результатом — как в Neo4j.
        </div>
        <button
          onClick={onRunExample}
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            border: 'none',
            borderRadius: 8,
            padding: '9px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Выполнить пример
        </button>

        <div style={{ marginTop: 26, textAlign: 'left' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.7px', color: 'var(--fg-3)', marginBottom: 9, textAlign: 'center' }}>
            ШАБЛОНЫ nGQL · КЛИК ПОДСТАВИТ В РЕДАКТОР
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.title}
                onClick={() => setQuery(ex.query)}
                title="Подставить в редактор (замените Тег/текст на свои)"
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  width: '100%',
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap' }}>
                  {ex.title}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
