import type { ReactNode } from 'react'
import styles from './styles.module.css'

export type AccordionProps = {
    label: ReactNode
    open: boolean
    onToggle: () => void
    children: ReactNode
}

/** Minimal disclosure row: caret + label toggles the body. */
const Accordion = ({ label, open, onToggle, children }: AccordionProps) => {
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className={open ? `${styles.trigger} ${styles.triggerOpen}` : styles.trigger}
            >
                <span className={styles.caret}>{open ? '▾' : '▸'}</span>
                {label}
            </button>
            {open ? <div className={styles.body}>{children}</div> : null}
        </div>
    )
}

export default Accordion
