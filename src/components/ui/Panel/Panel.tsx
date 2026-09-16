import type { CSSProperties, ReactNode } from 'react'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'

export type PanelProps = {
    title?: ReactNode
    actions?: ReactNode
    children: ReactNode
    style?: CSSProperties
}

/** Standard content panel with optional title row and right-aligned actions. */
const Panel = ({ title, actions, children, style }: PanelProps) => {
    return (
        <div className={ui.panel} style={style}>
            {title ? (
                <div className={`${ui.ptitle}${actions ? ` ${styles.titleWithActions}` : ''}`}>
                    <span className={styles.titleText}>
                        <span className={ui.ptitleBar} />
                        {title}
                    </span>
                    {actions}
                </div>
            ) : null}
            {children}
        </div>
    )
}

export default Panel
