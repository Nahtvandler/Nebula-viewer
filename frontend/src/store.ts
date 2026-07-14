import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { api, isQueryError } from './api/client'
import type { Frame, GraphEdge, GraphNode, Selection } from './types'

type ExpandDir = 'both' | 'out' | 'in'

export const DEFAULT_QUERY = 'MATCH (v)-[e]->(n)\nRETURN v, e, n LIMIT 100'

let frameSeq = 0

function mergeElements(
  frame: Frame,
  nodes: GraphNode[],
  edges: GraphEdge[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map(frame.nodes.map((n) => [n.id, n]))
  for (const n of nodes) nodeMap.set(n.id, n)
  const edgeMap = new Map(frame.edges.map((e) => [e.id, e]))
  for (const e of edges) edgeMap.set(e.id, e)
  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] }
}

interface State {
  theme: 'dark' | 'light'
  leftCollapsed: boolean
  focusTag: string | null
  query: string
  space: string
  frames: Frame[]

  setQuery: (q: string) => void
  setSpace: (s: string) => void
  toggleTheme: () => void
  toggleLeft: () => void
  setFocusTag: (t: string) => void

  runQuery: (query?: string) => void
  rerunFrame: (id: number) => void
  closeFrame: (id: number) => void
  clearHistory: () => void

  toggleCollapse: (id: number) => void
  startEdit: (id: number) => void
  cancelEdit: (id: number) => void
  setDraft: (id: number, v: string) => void
  execEdit: (id: number) => void

  select: (id: number, sel: Selection) => void
  expandNode: (id: number, vid: string, direction?: ExpandDir) => Promise<void>
  hideNode: (id: number, vid: string) => void
  collapseNode: (id: number, vid: string) => void
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
  const patchFrame = (id: number, patch: Partial<Frame> | ((f: Frame) => Partial<Frame>)) =>
    set((s) => ({
      frames: s.frames.map((f) =>
        f.id === id ? { ...f, ...(typeof patch === 'function' ? patch(f) : patch) } : f,
      ),
    }))

  // Выполнить nGQL и записать результат в существующий фрейм.
  const executeInto = async (id: number, query: string) => {
    patchFrame(id, { status: 'running', selection: null, error: undefined, ts: Date.now() })
    try {
      const res = await api.query(query, get().space || undefined)
      if (isQueryError(res)) {
        patchFrame(id, { status: 'error', error: res })
        return
      }
      patchFrame(id, (f) => ({
        status: 'graph',
        nodes: res.nodes,
        edges: res.edges,
        hidden: [],
        stats: res.stats,
        layoutSeq: f.layoutSeq + 1,
      }))
    } catch (e) {
      patchFrame(id, { status: 'error', error: { error: String(e) } })
    }
  }

  return {
    theme: 'dark',
    leftCollapsed: false,
    focusTag: null,
    query: DEFAULT_QUERY,
    space: '',
    frames: [],

    setQuery: (q) => set({ query: q }),
    setSpace: (s) => set({ space: s, focusTag: null }),
    toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
    setFocusTag: (t) => set((s) => ({ focusTag: s.focusTag === t ? null : t })),

    runQuery: (query) => {
      const q = (query ?? get().query).trim()
      if (!q) return
      const id = ++frameSeq
      const frame: Frame = {
        id,
        query: q,
        ts: Date.now(),
        status: 'running',
        collapsed: false,
        editing: false,
        draft: q,
        nodes: [],
        edges: [],
        hidden: [],
        selection: null,
        expanding: [],
        layoutSeq: 0,
      }
      set((s) => ({ frames: [frame, ...s.frames] }))
      void executeInto(id, q)
    },

    rerunFrame: (id) => {
      const f = get().frames.find((x) => x.id === id)
      if (f) void executeInto(id, f.query)
    },

    closeFrame: (id) => set((s) => ({ frames: s.frames.filter((f) => f.id !== id) })),
    clearHistory: () => set({ frames: [] }),

    toggleCollapse: (id) => patchFrame(id, (f) => ({ collapsed: !f.collapsed })),
    startEdit: (id) => patchFrame(id, (f) => ({ editing: !f.editing, draft: f.query, collapsed: false })),
    cancelEdit: (id) => patchFrame(id, (f) => ({ editing: false, draft: f.query })),
    setDraft: (id, v) => patchFrame(id, { draft: v }),
    execEdit: (id) => {
      const f = get().frames.find((x) => x.id === id)
      if (!f) return
      const q = (f.draft || '').trim()
      if (!q) return
      patchFrame(id, { query: q, editing: false })
      void executeInto(id, q)
    },

    select: (id, sel) => patchFrame(id, { selection: sel }),

    expandNode: async (id, vid, direction = 'both') => {
      // Помечаем узел «раскрывается…» — canvas показывает индикатор.
      patchFrame(id, (f) => ({
        expanding: f.expanding?.includes(vid) ? f.expanding : [...(f.expanding ?? []), vid],
      }))
      try {
        const res = await api.expand({ vid, space: get().space || undefined, direction, limit: 100 })
        if (isQueryError(res)) return
        patchFrame(id, (f) => {
          const merged = mergeElements(f, res.nodes, res.edges)
          return {
            nodes: merged.nodes,
            edges: merged.edges,
            hidden: f.hidden.filter((h) => !res.nodes.some((n) => n.id === h)),
            layoutSeq: f.layoutSeq + 1,
          }
        })
      } catch {
        /* молча — expand не должен ломать фрейм */
      } finally {
        patchFrame(id, (f) => ({ expanding: (f.expanding ?? []).filter((x) => x !== vid) }))
      }
    },

    hideNode: (id, vid) =>
      patchFrame(id, (f) => ({
        hidden: f.hidden.includes(vid) ? f.hidden : [...f.hidden, vid],
        selection:
          f.selection && f.selection.kind === 'node' && f.selection.id === vid
            ? null
            : f.selection,
      })),

    // Схлопнуть: спрятать соседей-«листья» (единственная видимая связь — с этим узлом).
    collapseNode: (id, vid) =>
      patchFrame(id, (f) => {
        const hidden = new Set(f.hidden)
        const tagOf = new Map(f.nodes.map((n) => [n.id, n.tags[0]]))
        const neighbors = new Set<string>()
        for (const e of f.edges) {
          if (e.source === vid) neighbors.add(e.target)
          else if (e.target === vid) neighbors.add(e.source)
        }
        for (const nb of neighbors) {
          if (hidden.has(nb)) continue
          const tag = tagOf.get(nb)
          if (tag === 'System' || tag === 'Module') continue
          const degree = f.edges.filter(
            (e) =>
              (e.source === nb || e.target === nb) &&
              !hidden.has(e.source === nb ? e.target : e.source),
          ).length
          if (degree <= 1) hidden.add(nb)
        }
        return { hidden: [...hidden] }
      }),
    }
  },
  {
    name: 'nebula-viewer',
    storage: createJSONStorage(() => localStorage),
    // История фреймов не сохраняется (объёмна и эфемерна) — только настройки UI.
    partialize: (s) => ({
      theme: s.theme,
      leftCollapsed: s.leftCollapsed,
      space: s.space,
      query: s.query,
    }),
  },
  ),
)
