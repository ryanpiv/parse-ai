import { useState, type ReactNode } from 'react'

type Props = {
  /** Shown next to the chevron (e.g. gold bar + label) */
  title: ReactNode
  /** Optional actions on the right (e.g. Download) */
  rightSlot?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  /** Extra margin below the whole block when collapsed */
  style?: React.CSSProperties
}

/**
 * Collapsible block with ▼/▶ — expanded by default for long Analyze sections.
 */
export function CollapsibleSection({
  title,
  rightSlot,
  defaultOpen = true,
  children,
  style,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={style}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: open ? 12 : 6,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            fontFamily: 'Rajdhani,sans-serif',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 0,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 10,
              color: 'var(--dim)',
              width: 14,
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            {open ? '▼' : '▶'}
          </span>
          {title}
        </button>
        {rightSlot}
      </div>
      {open ? children : null}
    </div>
  )
}
