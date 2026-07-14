import { Fragment, type ReactNode } from 'react'

// Токенайзер nGQL для подсветки — портирован из мокапа.
interface Token {
  t: string
  c: string | null
}

// Последняя группа (.) — catch-all: ловит ЛЮБОЙ символ, который не подошёл под
// остальные (кавычки без пары, кириллица, спецсимволы). Без неё такие символы
// молча выпадали из подсветки и визуально "исчезали" в редакторе.
const RE =
  /("[^"]*")|('[^']*')|(\d+(?:\.\d+)?)|(:[A-Za-z_][A-Za-z0-9_]*)|(\b[A-Z][A-Z0-9_]{2,}\b)|([{}()[\]<>|=,.\-:])|(\s+)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g

export function tokenize(str: string): Token[] {
  const out: Token[] = []
  let m: RegExpExecArray | null
  RE.lastIndex = 0
  while ((m = RE.exec(str)) !== null) {
    if (m[1] || m[2]) out.push({ t: m[1] || m[2], c: 'var(--syn-str)' })
    else if (m[3]) out.push({ t: m[3], c: 'var(--syn-num)' })
    else if (m[4]) out.push({ t: m[4], c: 'var(--syn-type)' })
    else if (m[5]) out.push({ t: m[5], c: 'var(--syn-kw)' })
    else if (m[6]) out.push({ t: m[6], c: null })
    else if (m[7]) out.push({ t: m[7], c: null })
    else if (m[8]) out.push({ t: m[8], c: 'var(--syn-var)' })
    else out.push({ t: m[9], c: null })
  }
  return out
}

export function Highlight({ code }: { code: string }): ReactNode {
  return (
    <Fragment>
      {tokenize(code).map((tk, i) =>
        tk.c ? (
          <span key={i} style={{ color: tk.c }}>
            {tk.t}
          </span>
        ) : (
          <Fragment key={i}>{tk.t}</Fragment>
        ),
      )}
    </Fragment>
  )
}
