import { useEffect, useRef } from 'react'
import { useFightAnalysis } from '../contexts/FightAnalysisContext'
import { pa, s } from '../lib/styles'

/** Load progress / errors. `nav` is the Warcraft Logs panel; `viewbar` stays visible while scrolling. */
export function WclLoadStatus(props: { variant: 'nav' | 'viewbar' }) {
    const fa = useFightAnalysis()
    const errRef = useRef<HTMLDivElement>(null)
    const isErr = fa.status?.type === 'err'
    const isOk = fa.status?.type === 'ok'

    useEffect(() => {
        if (props.variant !== 'nav' || !isErr) return
        errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [isErr, fa.status?.msg, props.variant])

    if (props.variant === 'viewbar') {
        if (isErr && fa.status) {
            return (
                <div className={pa.loadErr} role="alert" style={{ marginTop: 10 }}>
                    <div className={pa.loadErrTitle}>Could not load this log</div>
                    <div>{fa.status.msg}</div>
                </div>
            )
        }
        if (fa.loading) {
            return (
                <div style={{ ...s.alertInfo, marginTop: 10 }} role="status" aria-live="polite">
                    {fa.loadStep || fa.status?.msg || 'Loading…'}
                </div>
            )
        }
        return null
    }

    if (isErr && fa.status) {
        return (
            <div ref={errRef} className={pa.loadErr} role="alert">
                <div className={pa.loadErrTitle}>Could not load this log</div>
                <div>{fa.status.msg}</div>
            </div>
        )
    }

    if (!fa.status) return null

    return (
        <div
            role={fa.loading ? 'status' : undefined}
            aria-live={fa.loading ? 'polite' : undefined}
            style={isOk ? s.alertOk : s.alertInfo}
        >
            {fa.status.msg}
        </div>
    )
}
