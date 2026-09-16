import { useState, type CSSProperties, type ReactNode } from 'react'
import ui from '../../styles/ui.module.css'
import styles from './styles.module.css'
import { useRegisterCollapsible } from '../CollapsibleGroup'

export type CollapsibleSectionProps = {
    /** Shown next to the chevron (e.g. gold bar + label) */
    title: ReactNode
    /** Optional actions on the right (e.g. Download) */
    rightSlot?: ReactNode
    defaultOpen?: boolean
    children: ReactNode
    /** Extra margin below the whole block when collapsed */
    style?: CSSProperties
}

/**
 * Collapsible block with ▼/▶ — expanded by default for long Analyze sections.
 */
const CollapsibleSection = ({
    title,
    rightSlot,
    defaultOpen = true,
    children,
    style,
}: CollapsibleSectionProps) => {
    const [open, setOpen] = useState(defaultOpen)
    useRegisterCollapsible(setOpen)

    return (
        <div style={style}>
            <div className={open ? styles.headerOpen : styles.header}>
                <button type="button" onClick={() => setOpen((o) => !o)} className={ui.collapsibleTrigger}>
                    <span aria-hidden className={ui.collapsibleTriggerChev}>
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

export default CollapsibleSection
