import { useStore } from '../store'
import { EmptyState } from './EmptyState'
import { Frame } from './Frame'

export function FrameStream() {
  const frames = useStore((s) => s.frames)
  const runQuery = useStore((s) => s.runQuery)

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'var(--bg)',
        padding: '16px 18px 40px',
      }}
    >
      {frames.length === 0 ? (
        <EmptyState onRunExample={() => runQuery()} />
      ) : (
        frames.map((f) => <Frame key={f.id} frame={f} />)
      )}
    </div>
  )
}
