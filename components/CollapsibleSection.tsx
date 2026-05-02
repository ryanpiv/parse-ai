import { useState, type ReactNode } from 'react'
import { pa } from '../lib/styles'
import { useRegisterCollapsible } from './CollapsibleGroup'

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
  useRegisterCollapsible(setOpen)

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
        <button type="button" onClick={() => setOpen(o => !o)} className={pa.collapsibleTrigger}>
          <span aria-hidden className={pa.collapsibleTriggerChev}>
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
