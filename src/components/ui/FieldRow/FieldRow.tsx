import type { CSSProperties, ReactNode } from 'react'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'

export type FieldRowProps = {
    label: ReactNode
    action?: ReactNode
    children: ReactNode
    style?: CSSProperties
}

/** Labeled control with an optional trailing action button column. */
const FieldRow = ({ label, action, children, style }: FieldRowProps) => {
    return (
        <div className={action ? styles.rowWithAction : styles.row} style={style}>
            <div className={ui.field}>
                <label className={ui.label}>{label}</label>
                {children}
            </div>
            {action ? <div className={styles.actionColumn}>{action}</div> : null}
        </div>
    )
}

export default FieldRow
