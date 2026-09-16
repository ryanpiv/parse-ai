import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import { useFightAnalysis } from '../contexts/FightAnalysisContext'
import ui from '../styles/ui.module.css'
import styles from '../styles/pages/history.module.css'
import {
    clearHistory,
    readHistory,
    removeHistoryEntry,
    HISTORY_CHANGED_EVENT,
    type AnalysisHistoryEntry,
} from '../lib/analysisHistory'

function fmtWhen(ms: number): string {
    const diff = Date.now() - ms
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

interface IKindBadgeProps {
    kind: AnalysisHistoryEntry['kind']
}

const KindBadge = ({ kind }: IKindBadgeProps) => {
    const solo = kind === 'solo'
    return (
        <span className={`${styles.kindBadge} ${solo ? styles.kindBadgeSolo : styles.kindBadgeCompare}`}>
            {solo ? 'Solo' : 'Compare'}
        </span>
    )
}

/** Recent solo/compare loads (this browser's localStorage) — click to load again. */
const HistoryPage = () => {
    const fa = useFightAnalysis()
    const router = useRouter()
    const [entries, setEntries] = useState<AnalysisHistoryEntry[]>([])

    useEffect(() => {
        const refresh = () => setEntries(readHistory())
        refresh()
        window.addEventListener(HISTORY_CHANGED_EVENT, refresh)
        return () => window.removeEventListener(HISTORY_CHANGED_EVENT, refresh)
    }, [])

    function reload(entry: AnalysisHistoryEntry) {
        void fa.loadCompare(entry.url)
        void router.push('/')
    }

    return (
        <>
            <Head>
                <title>History · Parse Analyzer</title>
            </Head>
            <div className={ui.wrap}>
                <PageHeader
                    title="History"
                    subtitle="this device only — not saved to your WarcraftLogs account"
                />
                <Panel title="Recent loads">
                    <p className={`${styles.dim} ${styles.deviceNote}`}>
                        Loads stay in this browser. Signing in elsewhere will not bring them with you. Click a
                        row to load it again.
                    </p>
                    {entries.length === 0 ? (
                        <p className={styles.mono}>
                            Nothing on this device yet — load a fight on Analyze or from Reports.
                        </p>
                    ) : (
                        <>
                            <div className={styles.entryList} data-testid="HistoryPage">
                                {entries.map((e, i) => (
                                    <div
                                        key={e.url}
                                        className={styles.entryRow}
                                        data-testid={`HistoryPage-Row--${i}`}
                                    >
                                        <button
                                            type="button"
                                            disabled={fa.loading}
                                            onClick={() => reload(e)}
                                            title={e.url}
                                            className={styles.entryButton}
                                        >
                                            <KindBadge kind={e.kind} />
                                            <span className={styles.entryText}>
                                                <span className={styles.entryTitle}>
                                                    {e.name1}
                                                    {e.spec1 ? ` (${e.spec1})` : ''}
                                                    {e.kind === 'compare' && e.name2
                                                        ? ` vs ${e.name2}${e.spec2 ? ` (${e.spec2})` : ''}`
                                                        : ''}
                                                </span>
                                                <span className={`${styles.dim} ${styles.block}`}>{e.boss}</span>
                                            </span>
                                        </button>
                                        <div className={styles.entryEnd}>
                                            <button
                                                type="button"
                                                className={styles.removeBtn}
                                                data-testid={`HistoryPage-remove--${i}`}
                                                aria-label={`Remove ${e.name1} — ${e.boss} from history`}
                                                onClick={() => removeHistoryEntry(e.url)}
                                            >
                                                ×
                                            </button>
                                            <span className={`${styles.dim} ${styles.entryWhen}`}>
                                                {fmtWhen(e.accessedAt)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.clearRow}>
                                <button
                                    type="button"
                                    className={`${ui.btnGhost} ${ui.btnGhostSm}`}
                                    onClick={() => clearHistory()}
                                >
                                    Clear history
                                </button>
                            </div>
                        </>
                    )}
                </Panel>
            </div>
        </>
    )
}

export default HistoryPage
