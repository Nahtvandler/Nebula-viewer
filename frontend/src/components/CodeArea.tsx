import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Highlight } from '../lib/highlight'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  height: number | string
  lineNumbers?: boolean
  autoFocus?: boolean
  background?: string
  paddingLeft?: number
  /** Список подсказок (ключевые слова nGQL, теги, рёбра, поля). */
  suggestions?: string[]
}

const mono = "'IBM Plex Mono', monospace"
const MAX_SUGGESTIONS = 8

// Слово перед кареткой (для фильтра подсказок).
function currentToken(value: string, caret: number): { word: string; start: number } {
  const before = value.slice(0, caret)
  const m = before.match(/[A-Za-z_][A-Za-z0-9_]*$/)
  if (!m) return { word: '', start: caret }
  return { word: m[0], start: caret - m[0].length }
}

// Каретка внутри строкового литерала? (нечётное число кавычек до неё) —
// тогда подсказки не показываем, чтобы не портить значения (в т.ч. кириллицу).
function insideString(value: string, caret: number): boolean {
  const before = value.slice(0, caret)
  const dq = (before.match(/"/g) || []).length
  const sq = (before.match(/'/g) || []).length
  return dq % 2 === 1 || sq % 2 === 1
}

export function CodeArea({
  value,
  onChange,
  onSubmit,
  height,
  lineNumbers,
  autoFocus,
  background = 'var(--panel-2)',
  paddingLeft = 14,
  suggestions,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [matches, setMatches] = useState<string[]>([])

  // Держим подсветку и колонку номеров в том же скролле, что и textarea,
  // иначе видимый (цветной) текст расходится с кареткой/выделением.
  const syncScroll = () => {
    const ta = taRef.current
    if (!ta) return
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop
      preRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
  }

  const refreshSuggestions = (val: string, caret: number) => {
    if (!suggestions || suggestions.length === 0) return
    // Внутри строкового литерала не подсказываем — там произвольные значения.
    if (insideString(val, caret)) {
      setOpen(false)
      return
    }
    const { word } = currentToken(val, caret)
    // Порог 2 символа — меньше визуального шума.
    if (word.length < 2) {
      setOpen(false)
      return
    }
    const lower = word.toLowerCase()
    const found = suggestions
      .filter((s) => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower)
      .slice(0, MAX_SUGGESTIONS)
    setMatches(found)
    setActive(0)
    setOpen(found.length > 0)
  }

  const accept = (suggestion: string) => {
    const el = taRef.current
    const caret = el ? el.selectionStart : value.length
    const { start } = currentToken(value, caret)
    const next = value.slice(0, start) + suggestion + value.slice(caret)
    onChange(next)
    setOpen(false)
    // Каретку — внутрь скобок для функций, иначе в конец вставки.
    const inside = suggestion.endsWith('()')
    const pos = start + suggestion.length - (inside ? 1 : 0)
    setTimeout(() => {
      if (el) {
        el.focus()
        el.selectionStart = el.selectionEnd = pos
      }
    }, 0)
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      setOpen(false)
      onSubmit()
      return
    }
    if (open && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => (a + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => (a - 1 + matches.length) % matches.length)
        return
      }
      // Принимаем ТОЛЬКО по Tab (и клику). Enter в многострочном редакторе
      // всегда должен переносить строку, а не «съедать» подсказку.
      if (e.key === 'Tab') {
        e.preventDefault()
        accept(matches[active])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
      // Любой Enter/пробел просто закрывает список и работает как обычно.
      if (e.key === 'Enter' || e.key === ' ') {
        setOpen(false)
      }
    }
  }

  const pad = lineNumbers ? 58 : paddingLeft
  const layer: CSSProperties = {
    margin: 0,
    position: 'absolute',
    inset: 0,
    padding: `12px 14px 12px ${pad}px`,
    fontFamily: mono,
    fontSize: 13,
    lineHeight: 1.62,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }

  const lines = value.split('\n').length

  return (
    <div style={{ position: 'relative', height }}>
      <div
        style={{
          position: 'relative',
          height: '100%',
          border: '1px solid var(--border)',
          borderRadius: 9,
          background,
          overflow: 'hidden',
        }}
      >
        {lineNumbers && (
          <div
            ref={gutterRef}
            className="mono"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 44,
              borderRight: '1px solid var(--border)',
              background: 'var(--panel)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 12,
              gap: 3,
              fontSize: 11,
              color: 'var(--fg-3)',
              userSelect: 'none',
              overflow: 'hidden',
            }}
          >
            {Array.from({ length: Math.max(lines, 1) }).map((_, i) => (
              <span key={i} style={i === 0 ? { color: 'var(--accent)' } : undefined}>
                {i === 0 ? '❯' : i + 1}
              </span>
            ))}
          </div>
        )}
        <pre ref={preRef} aria-hidden style={{ ...layer, color: 'var(--fg)', overflow: 'hidden', pointerEvents: 'none' }}>
          <Highlight code={value} />
        </pre>
        <textarea
          ref={taRef}
          spellCheck={false}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            refreshSuggestions(e.target.value, e.target.selectionStart)
            syncScroll()
          }}
          onScroll={syncScroll}
          onKeyDown={onKey}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          style={{
            ...layer,
            background: 'transparent',
            color: 'transparent',
            caretColor: 'var(--accent)',
            border: 'none',
            outline: 'none',
            resize: 'none',
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {open && matches.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: lineNumbers ? 44 : 0,
            zIndex: 70,
            minWidth: 220,
            maxHeight: 260,
            overflowY: 'auto',
            background: 'var(--panel)',
            border: '1px solid var(--border-2)',
            borderRadius: 9,
            padding: 4,
            boxShadow: '0 12px 36px rgba(0,0,0,.34)',
          }}
        >
          {matches.map((s, i) => (
            <button
              key={s}
              // mousedown, чтобы успеть до blur textarea
              onMouseDown={(e) => {
                e.preventDefault()
                accept(s)
              }}
              onMouseEnter={() => setActive(i)}
              className="mono"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: i === active ? 'var(--panel-2)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '7px 10px',
                fontSize: 12.5,
                color: 'var(--fg)',
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
          <div style={{ padding: '5px 10px 3px', fontSize: 10.5, color: 'var(--fg-3)' }}>
            Tab — вставить · Esc — скрыть
          </div>
        </div>
      )}
    </div>
  )
}
