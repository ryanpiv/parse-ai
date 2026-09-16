import { useEffect, useRef } from 'react'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import ui from '../../styles/ui.module.css'
import styles from './styles.module.css'

export type WclLoadStatusProps = {
    variant: 'nav' | 'viewbar'
}

/** Load progress / errors. `nav` is the Warcraft Logs panel; `viewbar` stays visible while scrolling. */
const WclLoadStatus = ({ variant }: WclLoadStatusProps) => {
    const fa = useFightAnalysis()
    const errRef = useRef<HTMLDivElement>(null)
    const isErr = fa.status?.type === 'err'
    const isOk = fa.status?.type === 'ok'

    useEffect(() => {
        if (variant !== 'nav' || !isErr) return
        errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [isErr, fa.status?.msg, variant])

    if (variant === 'viewbar') {
        if (isErr && fa.status) {
            return (
                <div className={`${ui.loadErr} ${styles.viewbarSpacing}`} role="alert">
                    <div className={ui.loadErrTitle}>Could not load this log</div>
                    <div>{fa.status.msg}</div>
                </div>
            )
        }
        if (fa.loading) {
            return (
                <div className={`${ui.alertInfo} ${styles.viewbarSpacing}`} role="status" aria-live="polite">
                    {fa.loadStep || fa.status?.msg || 'Loading…'}
                </div>
            )
        }
        return null
    }

    if (isErr && fa.status) {
        return (
            <div ref={errRef} className={ui.loadErr} role="alert">
                <div className={ui.loadErrTitle}>Could not load this log</div>
                <div>{fa.status.msg}</div>
            </div>
        )
    }

    if (!fa.status) return null

    return (
        <div
            role={fa.loading ? 'status' : undefined}
            aria-live={fa.loading ? 'polite' : undefined}
            className={isOk ? ui.alertOk : ui.alertInfo}
        >
            {fa.status.msg}
        </div>
    )
}

export default WclLoadStatus
