import styles from './styles.module.css'

export type OrDividerProps = {
    label?: string
}

/** Horizontal divider with a small centered word (e.g. "or") between two options. */
const OrDivider = ({ label = 'or' }: OrDividerProps) => {
    return (
        <div className={styles.divider}>
            <div className={styles.line} />
            <span className={styles.word}>{label}</span>
            <div className={styles.line} />
        </div>
    )
}

export default OrDivider
