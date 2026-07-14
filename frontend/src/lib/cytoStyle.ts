import type cytoscape from 'cytoscape'
import { oklchToCss } from './color'

export interface ThemeColors {
  edge: string
  edgeLabelBg: string
  fg: string
  fg2: string
  fg3: string
  accent: string
  accentFg: string
  border: string
  nodeRing: string
  canvas: string
}

const GLOBAL_VARS = {
  edge: '--edge',
  edgeLabelBg: '--edge-label-bg',
  fg: '--fg',
  fg2: '--fg-2',
  fg3: '--fg-3',
  accent: '--accent',
  accentFg: '--accent-fg',
  border: '--border',
  nodeRing: '--node-ring',
  canvas: '--canvas',
} as const

// cytoscape не понимает oklch(): его парсер цветов работает только с rgb/hex/hsl.
// getComputedStyle для кастомного свойства отдаёт СЫРОЙ "oklch(L C H)" активной
// темы — читаем его и детерминированно конвертируем в rgb (без зависимости от
// того, умеет ли браузер парсить oklch в конкретном контексте).
function rawVar(cssVar: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
}

/** Резолв одной CSS-переменной темы в rgb (для цвета узла по тегу). */
export function readVar(cssVar: string): string {
  return oklchToCss(rawVar(cssVar))
}

/** Считать все нужные токены темы в конкретные rgb-цвета из текущей темы. */
export function readThemeColors(): ThemeColors {
  const out = {} as Record<string, string>
  for (const [key, cssVar] of Object.entries(GLOBAL_VARS)) {
    out[key] = readVar(cssVar)
  }
  return out as unknown as ThemeColors
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildStylesheet(c: ThemeColors): any[] {
  return [
    {
      selector: 'node',
      style: {
        width: 'data(size)',
        height: 'data(size)',
        'background-color': 'data(bg)',
        'background-opacity': 0.95,
        // Никакой белой обводки — чистый залитый круг c мягким цветным гало.
        'border-width': 0,
        'underlay-color': 'data(bg)',
        'underlay-opacity': 0.14,
        'underlay-padding': 6,
        'underlay-shape': 'ellipse',
        label: 'data(label)',
        color: c.fg2,
        'font-family': "'IBM Plex Sans', sans-serif",
        'font-size': 11,
        'font-weight': 500,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 7,
        'text-max-width': '140',
        'text-wrap': 'ellipsis',
        'text-outline-color': c.canvas,
        'text-outline-width': '2',
        'transition-property':
          'width height background-opacity underlay-opacity underlay-padding',
        'transition-duration': '0.16s',
        'z-index': 2,
      },
    },
    {
      // Наведение — узел «оживает»: ярче и с более широким гало.
      selector: 'node.hl',
      style: {
        'background-opacity': 1,
        'underlay-opacity': 0.3,
        'underlay-padding': 11,
        'z-index': 6,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': c.accent,
        'underlay-color': c.accent,
        'underlay-opacity': 0.34,
        'underlay-padding': 9,
        color: c.fg,
        'font-weight': 600,
        'z-index': 10,
      },
    },
    {
      selector: 'node.dim',
      style: { opacity: 0.2, 'underlay-opacity': 0 },
    },
    {
      // Закреплённый (запиненный) узел — тонкое кольцо, как в Neo4j.
      selector: 'node.pinned',
      style: {
        'border-width': 2,
        'border-color': c.fg3,
        'border-opacity': 0.9,
        'border-style': 'dashed',
      },
    },
    {
      // Совпадение поиска — яркое акцентное гало.
      selector: 'node.search-hit',
      style: {
        'underlay-color': c.accent,
        'underlay-opacity': 0.4,
        'underlay-padding': 12,
        'z-index': 12,
      },
    },
    {
      // Не совпавшие при активном поиске — приглушены.
      selector: 'node.search-miss',
      style: { opacity: 0.18, 'underlay-opacity': 0 },
    },
    {
      // Подпись скрыта на сильном отдалении, чтобы не захламлять.
      selector: 'node.nolabel',
      style: { 'text-opacity': 0 },
    },
    {
      // Узел, для которого сейчас грузятся соседи (expand в процессе).
      selector: 'node.expanding',
      style: {
        'underlay-color': c.accent,
        'underlay-opacity': 0.4,
        'underlay-padding': 13,
        'border-width': 2,
        'border-color': c.accent,
        'z-index': 11,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.6,
        'line-color': c.edge,
        'target-arrow-color': c.edge,
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.95,
        'curve-style': 'bezier',
        // Разводим кратные рёбра между одной парой узлов веером.
        'control-point-step-size': 26,
        // Аккуратные петли (source === target).
        'loop-direction': '-45deg',
        'loop-sweep': '-30deg',
        label: 'data(label)',
        color: c.fg3,
        'font-family': "'IBM Plex Mono', monospace",
        'font-size': 10,
        'text-background-color': c.edgeLabelBg,
        'text-background-opacity': 1,
        'text-background-padding': '3',
        'text-background-shape': 'roundrectangle',
        'text-border-color': c.border,
        'text-border-width': 1,
        'text-border-opacity': 1,
        'transition-property': 'line-color target-arrow-color width',
        'transition-duration': '0.15s',
        'z-index': 1,
      },
    },
    {
      selector: 'edge.hl',
      style: {
        width: 2.4,
        'line-color': c.accent,
        'target-arrow-color': c.accent,
        color: c.accent,
        'text-border-color': c.accent,
        'z-index': 8,
      },
    },
    {
      selector: 'edge:selected',
      style: {
        width: 2.6,
        'line-color': c.accent,
        'target-arrow-color': c.accent,
        color: c.accent,
        'text-border-color': c.accent,
        'z-index': 9,
      },
    },
    {
      selector: 'edge.dim',
      style: { opacity: 0.1 },
    },
    {
      // Подпись ребра скрыта на отдалении.
      selector: 'edge.nolabel',
      style: { 'text-opacity': 0, 'text-background-opacity': 0, 'text-border-opacity': 0 },
    },
    {
      // Ребро вне области поиска — приглушено.
      selector: 'edge.search-miss',
      style: { opacity: 0.08 },
    },
  ]
}

// Силовая раскладка d3-force — как в Neo4j Browser:
//  - manyBody (заряд) отталкивает ВСЕ узлы, включая несвязанные → они
//    расходятся органичным облаком/кольцом, а не складываются в столбцы;
//  - collide даёт жёсткое непересечение (радиус = радиус узла + запас);
//  - link стягивает связанные узлы;
//  - infinite: симуляция затухает в покое (без вечного дрожания), но при
//    перетаскивании «разогревается» заново → соседи расступаются.
//
// Функции получают d3-узлы, на которые размазаны data() cy-узла (в т.ч. size).
//
// nodeCount тюнит поведение на больших графах: до порога симуляция «живая»
// (infinite) — как в Neo4j; выше порога она затухает и останавливается, чтобы
// не жечь CPU постоянной анимацией сотен узлов.
//
// Стартовые позиции узлов задаём заранее (спираль Фибоначчи в GraphCanvas),
// поэтому randomize: false — узлы не кидаются стопкой в маленький bbox.
//
// Ключ к Neo4j-«одуванчикам» (хабы разлетаются, листья тесным веером у своего
// хаба) — ГЛОБАЛЬНОЕ отталкивание + ДИФФЕРЕНЦИРОВАННАЯ длина связей:
//   - manyBodyDistanceMax НЕ задаём → кластеры отталкиваются на любой дистанции
//     и разлетаются, а не слипаются в центре; strength сильный;
//   - длина ребра растёт с МИНИМАЛЬНОЙ степенью его концов: спица центр→хаб
//     (min-степень высокая) длинная → хаб улетает далеко; веер хаб→лист
//     (лист имеет степень 1) короткий → листья держатся тугим кольцом.
//     Это поднимает «разнос хабов / радиус веера» с ~1.4 до ~2.1 (проверено
//     офлайн-симуляцией d3-force на hub-and-spoke из 105 узлов);
//   - xStrength/yStrength 0.05 (ниже дефолтных 0.1) → «цветок» остаётся в кадре,
//     но кластерам есть куда разойтись;
//   - manyBodyDistanceMin гасит пик отталкивания у почти совпавших узлов.
// deg проставляется в data() перед каждым запуском раскладки (GraphCanvas).
const LIVE_SIM_MAX = 350

export function forceLayout(nodeCount = 0, edgeCount = 0): cytoscape.LayoutOptions {
  const heavy = nodeCount > LIVE_SIM_MAX
  // Чем больше граф, тем сильнее нужен разгон заряда, чтобы кластеры разнесло.
  // Плюс поправка на плотность (рёбра/узлы): плотный меш нужно раздувать
  // сильнее, чтобы «клубок» дышал; у дерева (density≈1) множитель = 1, т.е.
  // выверенная раскладка «одуванчика» не меняется. (density-boost проверен
  // офлайн-симуляцией: +40% площади мешу, перекрытий не добавляет.)
  const density = edgeCount / Math.max(nodeCount, 1)
  const densityMult = 0.7 + 0.3 * Math.min(Math.max(density, 1), 3)
  const charge = -(1200 + Math.min(nodeCount, 400) * 3) * densityMult
  return {
    name: 'd3-force',
    animate: true,
    randomize: false,
    infinite: !heavy,
    // Перетащенный узел остаётся на месте (пиннинг, как в Neo4j Browser).
    // Адаптер сам проставляет fx/fy на событии free — узел при этом остаётся
    // перетаскиваемым (в отличие от lock()); открепляем чисткой fx/fy.
    fixedAfterDragging: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    linkId: (d: any) => d.id,
    linkDistance: (link: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      source: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target: any
    }) => {
      const sz = ((link.source.size || 48) + (link.target.size || 48)) / 2
      // Ограничиваем вклад степени, чтобы очень плотные узлы не «взрывали» граф.
      const md = Math.min(link.source.deg ?? 1, link.target.deg ?? 1, 12)
      return 20 + sz + md * 45
    },
    linkStrength: 0.7,
    manyBodyStrength: charge,
    manyBodyDistanceMin: 12,
    // manyBodyDistanceMax НАМЕРЕННО не задаём — отталкивание глобальное.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collideRadius: (node: any) => (node.size || 48) / 2 + 15,
    collideStrength: 0.9,
    collideIterations: 1,
    xStrength: 0.05,
    yStrength: 0.05,
    velocityDecay: 0.45,
    alphaDecay: 0.0228,
    alphaMin: 0.02,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}
