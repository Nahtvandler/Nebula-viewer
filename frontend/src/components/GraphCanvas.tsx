import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import d3Force from 'cytoscape-d3-force'
import { buildStylesheet, forceLayout, readThemeColors, readVar } from '../lib/cytoStyle'
import { downloadCsv, downloadText, edgesCsv, graphJson, nodesCsv } from '../lib/exportData'
import { primaryTag, tagColorVar, tagRadius } from '../lib/tags'
import type { Frame, Selection } from '../types'

// Регистрируем физическую раскладку один раз.
let forceRegistered = false
if (!forceRegistered) {
  try {
    cytoscape.use(d3Force)
    forceRegistered = true
  } catch {
    /* уже зарегистрирована */
  }
}

type SizeMode = 'tag' | 'degree'

interface Props {
  frame: Frame
  theme: string
  focusTag: string | null
  onSelect: (sel: Selection) => void
  onExpand: (vid: string) => void
  onHide: (vid: string) => void
  onFocusTag: (tag: string) => void
  onContextMenu: (vid: string, pos: { x: number; y: number }) => void
}

function buildElements(frame: Frame): cytoscape.ElementDefinition[] {
  const hidden = new Set(frame.hidden)
  const visibleNodes = frame.nodes.filter((n) => !hidden.has(n.id))
  const visibleIds = new Set(visibleNodes.map((n) => n.id))
  const els: cytoscape.ElementDefinition[] = visibleNodes.map((n) => {
    const tag = primaryTag(n.tags)
    const base = tagRadius(tag) * 2
    return {
      group: 'nodes',
      data: {
        id: n.id,
        label: n.label,
        tag: tag ?? '',
        bg: readVar(tagColorVar(tag)),
        baseSize: base,
        size: base,
        // строка для поиска: подпись + vid в нижнем регистре
        search: `${n.label} ${n.id}`.toLowerCase(),
      },
    }
  })
  for (const e of frame.edges) {
    if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) continue
    els.push({
      group: 'edges',
      data: { id: e.id, source: e.source, target: e.target, label: e.type, tags: '' },
    })
  }
  return els
}

// Итоговый размер узла в зависимости от режима: по тегу или по числу связей.
function nodeSize(base: number, deg: number, mode: SizeMode): number {
  if (mode !== 'degree') return base
  return Math.max(base * 0.62, Math.min(base * 0.62 + deg * 7, 128))
}

export function GraphCanvas({
  frame,
  theme,
  focusTag,
  onSelect,
  onExpand,
  onHide,
  onFocusTag,
  onContextMenu,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const layoutRef = useRef<cytoscape.Layouts | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const zoomFlags = useRef({ edge: false, node: false })
  const [zoomPct, setZoomPct] = useState(100)
  const [sizeMode, setSizeMode] = useState<SizeMode>('tag')
  const [layoutMode, setLayoutMode] = useState<'force' | 'radial'>('force')
  const [search, setSearch] = useState('')
  const [hitCount, setHitCount] = useState<number | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const expanding = useMemo(() => new Set(frame.expanding ?? []), [frame.expanding])

  // Применить размеры узлов к текущему режиму (без перестройки элементов).
  const applySizes = (mode: SizeMode) => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        n.data('size', nodeSize(n.data('baseSize') || 48, n.degree(false), mode))
      })
    })
  }

  // Скрывать подписи на сильном отдалении, чтобы не захламлять картину.
  const applyZoomLabels = (z: number) => {
    const cy = cyRef.current
    if (!cy) return
    const hideEdge = z < 0.55
    const hideNode = z < 0.32
    if (hideEdge === zoomFlags.current.edge && hideNode === zoomFlags.current.node) return
    zoomFlags.current = { edge: hideEdge, node: hideNode }
    cy.batch(() => {
      cy.edges().toggleClass('nolabel', hideEdge)
      cy.nodes().toggleClass('nolabel', hideNode)
    })
  }

  // Разложить узлы по спирали Фибоначчи (золотой угол) — равномерный, без
  // перекрытий стартовый разброс. Это убирает «драку» на старте: расталкивать
  // почти нечего, симуляция лишь слегка ужимает связи.
  const spiralPlace = (nodes: cytoscape.NodeCollection) => {
    const GOLDEN = Math.PI * (3 - Math.sqrt(5))
    const spacing = 64
    nodes.forEach((n, i) => {
      const r = spacing * Math.sqrt(i + 0.5)
      const a = i * GOLDEN
      n.position({ x: r * Math.cos(a), y: r * Math.sin(a) })
      return undefined
    })
  }

  // Новые узлы (после expand) ставим рядом с их уже размещёнными соседями,
  // чтобы они «вырастали» из родителя, а не сваливались в центр и не
  // перетряхивали весь граф.
  const placeNewNodes = (cy: cytoscape.Core, newIds: Set<string>) => {
    newIds.forEach((id) => {
      const n = cy.getElementById(id)
      if (n.empty()) return
      const placed = n.neighborhood('node').filter((m) => !newIds.has(m.id()))
      if (placed.nonempty()) {
        const bb = placed.boundingBox()
        n.position({
          x: (bb.x1 + bb.x2) / 2 + (Math.random() - 0.5) * 70,
          y: (bb.y1 + bb.y2) / 2 + (Math.random() - 0.5) * 70,
        })
      } else {
        n.position({ x: (Math.random() - 0.5) * 120, y: (Math.random() - 0.5) * 120 })
      }
    })
  }

  // Снять закрепление узла: чистим fx/fy в d3-scratch и слегка «подогреваем»
  // симуляцию, чтобы освобождённый узел встал на место.
  const unpin = (node: cytoscape.NodeSingular) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = node.scratch('d3-force') as any
    if (sc) {
      delete sc.fx
      delete sc.fy
    }
    node.removeClass('pinned')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = (layoutRef.current as any)?.simulation
    if (sim) {
      sim.alphaTarget(0.3).restart()
      setTimeout(() => sim.alphaTarget(0), 600)
    }
  }

  // Перезапустить силовую раскладку (останавливаем предыдущую).
  // d3-force сам не вписывает граф в кадр — делаем это вручную, пока он оседает.
  // spiralAll=true — полностью разложить с нуля (первый рендер / сброс);
  // иначе сохраняем текущие позиции и лишь до-оседаем инкрементально.
  const runLayout = (spiralAll = false) => {
    const cy = cyRef.current
    if (!cy || cy.nodes().length === 0) return
    // Актуализируем степень узлов в data() — от неё зависит длина связей
    // (спицы к хабам длиннее вееров), поэтому считаем прямо перед раскладкой.
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        n.data('deg', n.degree(false))
      })
    })
    if (layoutRef.current) {
      try {
        layoutRef.current.stop()
      } catch {
        /* noop */
      }
    }

    // Иерархическая (радиальная) раскладка — для path-запросов: концентрические
    // кольца по BFS-глубине от System. Показывает уровни System→Module→…→Endpoint
    // чисто, без «клубка» силовой раскладки.
    if (layoutMode === 'radial') {
      const systems = cy.nodes('[tag = "System"]')
      const roots = systems.nonempty() ? systems : cy.nodes().max((n) => n.degree(false)).ele
      const l = cy.layout({
        name: 'breadthfirst',
        circle: true,
        spacingFactor: 1.2,
        animate: true,
        animationDuration: 520,
        padding: 44,
        fit: true,
        roots,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      layoutRef.current = l
      l.run()
      return
    }

    if (spiralAll) spiralPlace(cy.nodes().not('.pinned'))
    const l = cy.layout(forceLayout(cy.nodes().length, cy.edges().length))
    layoutRef.current = l
    l.run()
    // Граф теперь заметно расходится — вписываем на нескольких этапах оседания,
    // чтобы поймать почти финальное состояние «цветка».
    ;[400, 1000, 1900, 2900].forEach((t) =>
      setTimeout(() => {
        if (cyRef.current) cyRef.current.fit(undefined, 48)
      }, t),
    )
  }

  const tagByNode = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of frame.nodes) m.set(n.id, primaryTag(n.tags) ?? '')
    return m
  }, [frame.nodes])

  const counts = useMemo(() => {
    const hidden = new Set(frame.hidden)
    const nodes = frame.nodes.filter((n) => !hidden.has(n.id))
    const ids = new Set(nodes.map((n) => n.id))
    const edges = frame.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
    return { nodes: nodes.length, edges: edges.length }
  }, [frame.nodes, frame.edges, frame.hidden])

  // Легенда — теги, реально присутствующие в этом фрейме, с числом узлов.
  const legend = useMemo(() => {
    const hidden = new Set(frame.hidden)
    const m = new Map<string, number>()
    for (const n of frame.nodes) {
      if (hidden.has(n.id)) continue
      const t = primaryTag(n.tags) ?? '—'
      m.set(t, (m.get(t) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [frame.nodes, frame.hidden])

  // Инициализация cytoscape.
  useEffect(() => {
    if (!containerRef.current) return
    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(frame),
      style: buildStylesheet(readThemeColors()),
      minZoom: 0.2,
      maxZoom: 3,
      // Колесо НЕ зумит по умолчанию — иначе оно блокирует прокрутку ленты
      // фреймов. Зум — по Ctrl/⌘+колесо (см. обработчик ниже) и кнопками +/−.
      userZoomingEnabled: false,
    })
    cyRef.current = cy

    // Ctrl/⌘ + колесо → зум к курсору; обычное колесо отдаём странице (скролл).
    const container = containerRef.current
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const rect = container.getBoundingClientRect()
      const factor = Math.pow(1.0015, -e.deltaY)
      cy.zoom({
        level: cy.zoom() * factor,
        renderedPosition: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      })
    }
    container.addEventListener('wheel', onWheel, { passive: false })

    // Перерисовать и вписать граф при изменении размера контейнера
    // (полноэкранный режим, ресайз окна) — иначе canvas остаётся старого размера.
    let lastW = container.clientWidth
    let lastH = container.clientHeight
    const ro = new ResizeObserver(() => {
      const c = cyRef.current
      if (!c) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === lastW && h === lastH) return
      lastW = w
      lastH = h
      c.resize()
      c.fit(undefined, 48)
    })
    ro.observe(container)

    cy.on('tap', 'node', (evt) => {
      // Alt+клик — открепить закреплённый узел (Neo4j-стиль пиннинга).
      if (evt.originalEvent && (evt.originalEvent as MouseEvent).altKey) {
        unpin(evt.target)
        return
      }
      onSelect({ kind: 'node', id: evt.target.id() })
    })
    cy.on('tap', 'edge', (evt) => onSelect({ kind: 'edge', id: evt.target.id() }))
    cy.on('tap', (evt) => {
      if (evt.target === cy) onSelect(null)
    })
    cy.on('dbltap', 'node', (evt) => onExpand(evt.target.id()))
    // Закрепить узел там, где его отпустили (как в Neo4j Browser). Не используем
    // lock() — он запрещает повторное перетаскивание; fixedAfterDragging уже
    // проставил fx/fy, узел остаётся и закреплённым, и перетаскиваемым.
    cy.on('dragfree', 'node', (evt) => {
      evt.target.addClass('pinned')
    })
    cy.on('cxttap', 'node', (evt) => {
      const rp = evt.renderedPosition || { x: 0, y: 0 }
      onSelect({ kind: 'node', id: evt.target.id() })
      onContextMenu(evt.target.id(), { x: rp.x, y: rp.y })
    })
    cy.on('zoom', () => {
      setZoomPct(Math.round(cy.zoom() * 100))
      applyZoomLabels(cy.zoom())
    })
    // Подсветка узла и его связей при наведении — «оживляет» граф.
    cy.on('mouseover', 'node', (evt) => {
      evt.target.addClass('hl')
      evt.target.connectedEdges().addClass('hl')
    })
    cy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('hl')
      evt.target.connectedEdges().removeClass('hl')
    })

    runLayout(true)
    setTimeout(() => setZoomPct(Math.round(cy.zoom() * 100)), 400)

    return () => {
      container.removeEventListener('wheel', onWheel)
      ro.disconnect()
      if (layoutRef.current) {
        try {
          layoutRef.current.stop()
        } catch {
          /* noop */
        }
      }
      cy.destroy()
      cyRef.current = null
    }
    // Инициализируем один раз; последующие изменения — через отдельные эффекты.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Пересобрать стиль при смене темы.
  // ВАЖНО: эффекты React выполняются снизу вверх (дочерние раньше родительских),
  // поэтому этот эффект срабатывает ДО того, как App выставит data-theme на
  // <html>. Если прочитать CSS-токены сразу, получим цвета старой темы и
  // «запечём» их в cytoscape. Откладываем чтение на rAF — к этому моменту
  // data-theme уже проставлен, и цвета/фон подписей берутся из новой темы.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const raf = requestAnimationFrame(() => {
      if (!cyRef.current) return
      cy.batch(() => {
        cy.nodes().forEach((n) => {
          n.data('bg', readVar(tagColorVar(n.data('tag') || undefined)))
        })
      })
      cy.style(buildStylesheet(readThemeColors()))
    })
    return () => cancelAnimationFrame(raf)
  }, [theme])

  // Синхронизировать элементы при изменении данных фрейма.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const next = buildElements(frame)
    const nextIds = new Set(next.map((e) => e.data.id as string))
    const addedNodes = new Set<string>()
    let changed = false
    cy.batch(() => {
      cy.elements().forEach((el) => {
        if (!nextIds.has(el.id())) {
          el.remove()
          changed = true
        }
      })
      for (const def of next) {
        const id = def.data.id as string
        if (cy.getElementById(id).empty()) {
          cy.add(def)
          if (def.group === 'nodes') addedNodes.add(id)
          changed = true
        }
      }
    })
    if (changed) {
      applySizes(sizeMode)
      // Полностью новый граф (все узлы только что добавлены, напр. новый запрос
      // или rerun) — раскладываем с нуля по спирали. Иначе это инкрементальный
      // expand: ставим новичков рядом с соседями и мягко до-оседаем, не трогая
      // уже разложенную часть.
      const freshGraph = addedNodes.size > 0 && addedNodes.size >= cy.nodes().length
      if (freshGraph) {
        runLayout(true)
      } else {
        if (addedNodes.size) placeNewNodes(cy, addedNodes)
        runLayout(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.nodes, frame.edges, frame.hidden])

  // Индикатор «раскрывается…» на узлах, ждущих ответа expand.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        n.toggleClass('expanding', expanding.has(n.id()))
      })
    })
  }, [expanding, frame.layoutSeq])

  // Отразить выделение из стора в cytoscape.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.elements().unselect()
      if (frame.selection) {
        const el = cy.getElementById(frame.selection.id)
        if (!el.empty()) el.select()
      }
    })
  }, [frame.selection])

  // Затемнение по focusTag.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      if (!focusTag) {
        cy.elements().removeClass('dim')
        return
      }
      cy.nodes().forEach((n) => {
        n.toggleClass('dim', n.data('tag') !== focusTag)
      })
      cy.edges().forEach((e) => {
        const st = tagByNode.get(e.data('source')) === focusTag
        const tt = tagByNode.get(e.data('target')) === focusTag
        e.toggleClass('dim', !(st || tt))
      })
    })
  }, [focusTag, tagByNode, frame.layoutSeq])

  // Пересчитать размеры при смене режима.
  useEffect(() => {
    applySizes(sizeMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeMode])

  // Переиграть раскладку при переключении силовая ⇄ кольца.
  const didMountLayout = useRef(false)
  useEffect(() => {
    if (!didMountLayout.current) {
      didMountLayout.current = true
      return
    }
    runLayout(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode])

  // Поиск по подписи/VID — подсветить совпадения, приглушить остальное.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const term = search.trim().toLowerCase()
    cy.batch(() => {
      cy.elements().removeClass('search-hit search-miss')
      if (!term) return
      const hits = cy.nodes().filter((n) => (n.data('search') || '').includes(term))
      cy.nodes().difference(hits).addClass('search-miss')
      hits.addClass('search-hit')
      cy.edges().forEach((e) => {
        const on = hits.contains(e.source()) || hits.contains(e.target())
        e.toggleClass('search-miss', !on)
      })
    })
    if (!term) {
      setHitCount(null)
      return
    }
    const hits = cy.nodes().filter((n) => (n.data('search') || '').includes(term))
    setHitCount(hits.length)
    if (hits.length > 0) cy.animate({ fit: { eles: hits, padding: 90 } }, { duration: 320 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, frame.layoutSeq])

  const zoomBy = (factor: number) => {
    const cy = cyRef.current
    if (!cy) return
    const c = { x: cy.width() / 2, y: cy.height() / 2 }
    cy.zoom({ level: cy.zoom() * factor, renderedPosition: c })
  }
  const fit = () => cyRef.current?.fit(undefined, 42)
  const reset = () => {
    // Снимаем все закрепления (чистим fx/fy) и раскладываем с нуля по спирали.
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().forEach((n) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sc = n.scratch('d3-force') as any
      if (sc) {
        delete sc.fx
        delete sc.fy
      }
    })
    cy.nodes().removeClass('pinned')
    runLayout(true)
  }

  const exportPng = () => {
    const cy = cyRef.current
    if (!cy) return
    const uri = cy.png({ full: true, scale: 2, bg: readVar('--canvas') })
    const a = document.createElement('a')
    a.href = uri
    a.download = `nebula-graph-${frame.id}.png`
    a.click()
    setExportOpen(false)
  }
  const exportJson = () => {
    downloadText(`nebula-graph-${frame.id}.json`, graphJson(frame), 'application/json')
    setExportOpen(false)
  }
  const exportNodesCsv = () => {
    downloadCsv(`nebula-nodes-${frame.id}.csv`, nodesCsv(frame))
    setExportOpen(false)
  }
  const exportEdgesCsv = () => {
    downloadCsv(`nebula-edges-${frame.id}.csv`, edgesCsv(frame))
    setExportOpen(false)
  }

  // Горячие клавиши в пределах канваса (контейнер получает фокус по клику).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (search) setSearch('')
      else onSelect(null)
      return
    }
    // Не перехватываем, если пользователь печатает в поле поиска.
    if (e.target === searchRef.current) return
    const sel = frame.selection
    if (e.key === '/') {
      e.preventDefault()
      searchRef.current?.focus()
    } else if (e.key === 'f' || e.key === 'F') {
      fit()
    } else if ((e.key === 'e' || e.key === 'E') && sel?.kind === 'node') {
      onExpand(sel.id)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel?.kind === 'node') {
      onHide(sel.id)
    }
  }

  const overlayBtn = (label: string, onClick: () => void, title: string, borderBottom = false) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'block',
        width: 34,
        height: 34,
        background: 'transparent',
        border: 'none',
        borderBottom: borderBottom ? '1px solid var(--border)' : 'none',
        color: 'var(--fg-2)',
        cursor: 'pointer',
        fontSize: 15,
      }}
    >
      {label}
    </button>
  )

  const groupBox: React.CSSProperties = {
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 9,
    overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(0,0,0,.18)',
  }

  return (
    <div
      style={{ position: 'absolute', inset: 0, outline: 'none' }}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* счётчик узлов/рёбер */}
      <div
        className="mono"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 11px',
          fontSize: 11.5,
          color: 'var(--fg-2)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{counts.nodes}</span> узлов
        <span style={{ color: 'var(--border-2)' }}>·</span>
        <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{counts.edges}</span> рёбер
      </div>

      {/* поиск по графу */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '4px 6px 4px 10px',
          zIndex: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,.14)',
        }}
      >
        <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>⌕</span>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Найти узел…  (/)"
          style={{
            width: 168,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--fg)',
            fontSize: 12.5,
          }}
        />
        {hitCount != null && (
          <span
            className="mono"
            style={{ fontSize: 11, color: hitCount ? 'var(--accent)' : 'var(--fg-3)' }}
          >
            {hitCount}
          </span>
        )}
        {search && (
          <button
            onClick={() => setSearch('')}
            title="Очистить"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fg-3)',
              cursor: 'pointer',
              fontSize: 13,
              width: 22,
              height: 22,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* правый верхний тулбар: размер по степени + экспорт */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setLayoutMode((m) => (m === 'radial' ? 'force' : 'radial'))}
          title="Раскладка: силовая ⇄ кольца (иерархия для path-запросов)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: layoutMode === 'radial' ? 'var(--accent)' : 'var(--panel)',
            color: layoutMode === 'radial' ? 'var(--accent-fg)' : 'var(--fg-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,.14)',
          }}
        >
          <span style={{ fontSize: 12 }}>◎</span> {layoutMode === 'radial' ? 'Кольца' : 'Силовая'}
        </button>
        <button
          onClick={() => setSizeMode((m) => (m === 'degree' ? 'tag' : 'degree'))}
          title="Размер узла по числу связей"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: sizeMode === 'degree' ? 'var(--accent)' : 'var(--panel)',
            color: sizeMode === 'degree' ? 'var(--accent-fg)' : 'var(--fg-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,.14)',
          }}
        >
          <span style={{ fontSize: 12 }}>◔</span> по связям
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setExportOpen((v) => !v)}
            title="Экспорт"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--panel)',
              color: 'var(--fg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,.14)',
            }}
          >
            <span style={{ fontSize: 12 }}>⤓</span> Экспорт
          </button>
          {exportOpen && (
            <>
              <div
                onClick={() => setExportOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 20 }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 36,
                  right: 0,
                  zIndex: 21,
                  minWidth: 168,
                  background: 'var(--panel)',
                  border: '1px solid var(--border-2)',
                  borderRadius: 9,
                  padding: 5,
                  boxShadow: '0 12px 32px rgba(0,0,0,.3)',
                }}
              >
                {[
                  { icon: '🖼', label: 'PNG (изображение)', fn: exportPng },
                  { icon: '{ }', label: 'JSON (данные)', fn: exportJson },
                  { icon: '▦', label: 'CSV — узлы', fn: exportNodesCsv },
                  { icon: '↦', label: 'CSV — рёбра', fn: exportEdgesCsv },
                ].map((it) => (
                  <button
                    key={it.label}
                    onClick={it.fn}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 9px',
                      color: 'var(--fg)',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      textAlign: 'left',
                    }}
                  >
                    <span className="mono" style={{ width: 22, fontSize: 11, color: 'var(--fg-3)' }}>
                      {it.icon}
                    </span>
                    {it.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* зум-контролы */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          bottom: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 10,
        }}
      >
        <div style={groupBox}>
          {overlayBtn('+', () => zoomBy(1.2), 'Приблизить', true)}
          {overlayBtn('−', () => zoomBy(1 / 1.2), 'Отдалить')}
        </div>
        <div style={groupBox}>
          {overlayBtn('⤢', fit, 'Вписать (F)', true)}
          {overlayBtn('↺', reset, 'Сбросить раскладку и открепить')}
        </div>
        <div
          className="mono"
          title="Ctrl / ⌘ + колесо — зум · колесо — прокрутка ленты"
          style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--fg-3)', cursor: 'help' }}
        >
          {zoomPct}%
        </div>
      </div>

      {/* легенда — теги этого фрейма */}
      {legend.length > 0 && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 14,
            maxWidth: 200,
            maxHeight: 190,
            overflowY: 'auto',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            padding: '7px 6px',
            zIndex: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,.16)',
          }}
        >
          {legend.map(([tag, n]) => {
            const active = focusTag === tag
            return (
              <button
                key={tag}
                onClick={() => onFocusTag(tag)}
                title="Фильтр по тегу"
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--panel-2)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '4px 7px',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: active ? 'var(--panel-2)' : 'transparent',
                  opacity: focusTag && !active ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    flex: '0 0 auto',
                    background: `var(${tagColorVar(tag === '—' ? undefined : tag)})`,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    fontSize: 11.5,
                    color: 'var(--fg)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {tag}
                </span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                  {n}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
