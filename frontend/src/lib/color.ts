// Детерминированная конвертация oklch(...) -> rgb(...), т.к. cytoscape.js не
// умеет парсить oklch. getComputedStyle для кастомного свойства возвращает
// СЫРОЙ "oklch(L C H)" — его и конвертируем в JS, без зависимости от браузера.

function parseL(token: string): number {
  return token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token)
}

function srgbGamma(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.min(1, Math.max(0, v))
}

/** Конвертировать CSS-цвет в форму, понятную cytoscape. oklch -> rgb(a); rgb/hex — как есть. */
export function oklchToCss(input: string): string {
  const s = (input || '').trim()
  const m = s.match(/^oklch\(([^)]+)\)$/i)
  if (!m) return s || '#888888' // уже rgb/hex/hsl или пусто

  const [coordsPart, alphaPart] = m[1].split('/')
  const coords = coordsPart.trim().split(/[\s,]+/).filter(Boolean)
  const L = parseL(coords[0] ?? '0')
  const C = parseFloat(coords[1] ?? '0')
  const H = parseFloat(coords[2] ?? '0')
  const alpha = alphaPart !== undefined ? parseFloat(alphaPart) : 1

  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  // oklab -> linear sRGB
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ * l_ * l_
  const mm = m_ * m_ * m_
  const ss = s_ * s_ * s_

  const rLin = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss
  const gLin = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss
  const bLin = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss

  const r = Math.round(srgbGamma(rLin) * 255)
  const g = Math.round(srgbGamma(gLin) * 255)
  const bl = Math.round(srgbGamma(bLin) * 255)

  if (!Number.isNaN(alpha) && alpha < 1) {
    return `rgba(${r}, ${g}, ${bl}, ${alpha})`
  }
  return `rgb(${r}, ${g}, ${bl})`
}
