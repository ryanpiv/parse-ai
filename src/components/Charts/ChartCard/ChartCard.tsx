import type { ReactNode } from 'react'
import styles from './styles.module.css'

export type ChartCardProps = {
    title: string
    height?: number
    children?: ReactNode
}

const ChartCard = ({ title, height = 220, children }: ChartCardProps) => {
    return (
        <div className={styles.card}>
            <div className={styles.title}>{title}</div>
            <div className={styles.plot} style={{ height }}>
                {children}
            </div>
        </div>
    )
}

export default ChartCard
