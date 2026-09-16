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

/** Recent solo/compare loads (localStorage) — click to load again. */
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
                <PageHeader title="History" subtitle="every fight you've loaded — click to load it again" />
                <Panel title="Recent loads">
                    {entries.length === 0 ? (
                        <p className={styles.mono}>
                            Nothing yet — load a fight on Analyze or from Reports and it will show up here.
                        </p>
                    ) : (
                        <>
                            <div className={styles.entryList}>
                                {entries.map((e) => (
                                    <button
                                        key={e.url}
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
                                        <span className={`${styles.dim} ${styles.entryWhen}`}>
                                            {fmtWhen(e.accessedAt)}
                                        </span>
                                    </button>
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
