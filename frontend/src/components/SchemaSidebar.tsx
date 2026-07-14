import { useSchema } from '../hooks'
import { tagColorVar } from '../lib/tags'
import { useStore } from '../store'

export function SchemaSidebar() {
  const collapsed = useStore((s) => s.leftCollapsed)
  const toggle = useStore((s) => s.toggleLeft)
  const focusTag = useStore((s) => s.focusTag)
  const setFocusTag = useStore((s) => s.setFocusTag)
  const space = useStore((s) => s.space)
  const { data } = useSchema(space)

  const tags = data?.tags ?? []
  const edgeTypes = data?.edge_types ?? []

  return (
    <aside
      style={{
        flex: '0 0 auto',
        width: collapsed ? 48 : 244,
        background: 'var(--panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width .18s ease',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 12px 12px 14px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {!collapsed && (
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.7px', color: 'var(--fg-3)' }}>
            СХЕМА ПРОСТРАНСТВА
          </span>
        )}
        <button
          onClick={toggle}
          title={collapsed ? 'Развернуть' : 'Свернуть'}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-3)',
            cursor: 'pointer',
            borderRadius: 6,
            padding: '3px 7px',
            fontSize: 13,
            lineHeight: 1,
          }}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 8px 20px' }}>
          <div style={{ padding: '0 6px 7px', fontSize: 10, fontWeight: 600, letterSpacing: '.7px', color: 'var(--fg-3)' }}>
            ТЕГИ · {tags.length}
          </div>
          {tags.map((t) => {
            const active = focusTag === t.name
            return (
              <button
                key={t.name}
                onClick={() => setFocusTag(t.name)}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--panel-2)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: 7,
                  cursor: 'pointer',
                  background: active ? 'var(--panel-2)' : 'transparent',
                }}
              >
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: `var(${tagColorVar(t.name)})`, flex: '0 0 auto', border: '1px solid var(--node-ring)' }} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.name}
                </span>
                {t.count != null && (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t.count}</span>
                )}
              </button>
            )
          })}

          <div style={{ padding: '16px 6px 7px', fontSize: 10, fontWeight: 600, letterSpacing: '.7px', color: 'var(--fg-3)' }}>
            ТИПЫ РЁБЕР · {edgeTypes.length}
          </div>
          {edgeTypes.map((e) => (
            <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px' }}>
              <span style={{ width: 16, height: 0, borderTop: '1.5px dashed var(--edge)', flex: '0 0 auto', position: 'relative' }}>
                <span style={{ position: 'absolute', right: -1, top: -3, color: 'var(--edge)', fontSize: 8, lineHeight: 1 }}>▶</span>
              </span>
              <span className="mono" style={{ flex: 1, fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {e.name}
              </span>
              {e.count != null && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{e.count}</span>
              )}
            </div>
          ))}

          {tags.length === 0 && (
            <div style={{ padding: '8px 8px', fontSize: 12, color: 'var(--fg-3)' }}>
              Схема недоступна — проверьте подключение к Nebula.
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
