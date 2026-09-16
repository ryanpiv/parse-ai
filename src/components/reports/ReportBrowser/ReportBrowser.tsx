/**
 * In-app WCL report browser: pick a source (my uploads / a guild), page through
 * reports, drill into boss pulls, then click 1–2 players to hand off to the
 * Analyze load pipeline (1 = solo, 2 = compare; first pick is player 1).
 * All queries run with the signed-in user's token, so private logs they can
 * see on WCL are visible here too.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'
import { gql } from '../../../lib/wclClient'
import { useFightAnalysis } from '../../../contexts/FightAnalysisContext'
import { fetchFightPlayerRows, type FightPlayerRow } from '../../../lib/wclFightPlayers'
import { wowClassColor, wowClassDisplayName } from '../../../lib/wowClassColors'
import {
    buildCompareUrl,
    buildCrossReportCompareUrl,
    buildSoloUrl,
    difficultyLabel,
    fetchCurrentUser,
    fetchReportFights,
    fetchReportPage,
    wclReportLink,
    type WclCurrentUser,
    type WclFightSummary,
    type WclReportPage,
    type WclReportSummary,
    type WclTopRank,
} from '../../../lib/wclReports'
import TopParseSection from '../TopParseSection'

type Source = { kind: 'mine' } | { kind: 'guild'; id: number; label: string }

/**
 * Drill-down position survives route changes (module scope, per tab-session) so
 * "Analyze {name}" → Analyze → back to Reports lands where the user left off.
 */
const remembered: {
    source: Source
    page: number
    report: WclReportSummary | null
    fight: WclFightSummary | null
} = { source: { kind: 'mine' }, page: 1, report: null, fight: null }

/** Last character the user analyzed/compared — auto-picked when seen in a roster. */
const LAST_PLAYER_KEY = 'parse-analyzer-last-player'

function readLastPlayer(): string {
    try {
        return localStorage.getItem(LAST_PLAYER_KEY) || ''
    } catch {
        return ''
    }
}

function writeLastPlayer(name: string): void {
    try {
        localStorage.setItem(LAST_PLAYER_KEY, name)
    } catch {
        /* private mode */
    }
}

function fmtDate(ms: number): string {
    if (!ms) return ''
    return new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

function fmtDuration(startMs: number, endMs: number): string {
    const total = Math.max(0, Math.round((endMs - startMs) / 1000))
    const m = Math.floor(total / 60)
    const ss = String(total % 60).padStart(2, '0')
    return `${m}:${ss}`
}

interface IBackRowProps {
    onBack: () => void
    backLabel: string
    right?: ReactNode
}

const BackRow = ({ onBack, backLabel, right }: IBackRowProps) => {
    return (
        <div className={styles.backRow}>
            <button type="button" className={`${ui.btnGhost} ${ui.btnGhostSm}`} onClick={onBack}>
                ← {backLabel}
            </button>
            {right}
        </div>
    )
}

interface IKillBadgeProps {
    fight: WclFightSummary
}

const KillBadge = ({ fight }: IKillBadgeProps) => {
    if (fight.kill) {
        return <span className={`${styles.badge} ${styles.badgeKill}`}>Kill</span>
    }
    const pct = fight.fightPercentage != null ? ` ${Math.round(fight.fightPercentage)}%` : ''
    return <span className={`${styles.badge} ${styles.badgeWipe}`}>Wipe{pct}</span>
}

const ReportBrowser = () => {
    const fa = useFightAnalysis()
    const router = useRouter()

    const [me, setMe] = useState<WclCurrentUser | null>(null)
    const [meError, setMeError] = useState<string | null>(null)
    const [source, setSource] = useState<Source>(remembered.source)
    const [page, setPage] = useState(remembered.page)
    const [reportPage, setReportPage] = useState<WclReportPage | null>(null)
    const [listError, setListError] = useState<string | null>(null)
    const [listLoading, setListLoading] = useState(false)

    const [report, setReport] = useState<WclReportSummary | null>(remembered.report)
    const [fights, setFights] = useState<WclFightSummary[] | null>(null)
    const [fightsError, setFightsError] = useState<string | null>(null)

    const [fight, setFight] = useState<WclFightSummary | null>(remembered.fight)
    const [players, setPlayers] = useState<FightPlayerRow[] | null>(null)
    const [playersError, setPlayersError] = useState<string | null>(null)
    const [picked, setPicked] = useState<FightPlayerRow[]>([])
    const [autoPickedName, setAutoPickedName] = useState<string | null>(null)

    const signedIn = fa.authStatus === 'ok'
    const rankTarget = picked.length === 1 ? picked[0] : null

    // Keep the module-level snapshot in sync so leaving for Analyze and coming
    // back restores the same drill-down position.
    useEffect(() => {
        remembered.source = source
        remembered.page = page
        remembered.report = report
        remembered.fight = fight
    }, [source, page, report, fight])

    useEffect(() => {
        if (!signedIn) return
        fetchCurrentUser(gql)
            .then((u) => {
                setMe(u)
                if (!u) setMeError('Could not read your WCL account.')
            })
            .catch((e) => setMeError(e?.message || 'Could not read your WCL account.'))
    }, [signedIn])

    useEffect(() => {
        if (!signedIn || !me) return
        let stale = false
        setListLoading(true)
        setListError(null)
        const opts = source.kind === 'mine' ? { userID: me.id, page } : { guildID: source.id, page }
        fetchReportPage(gql, opts)
            .then((p) => {
                if (!stale) setReportPage(p)
            })
            .catch((e) => {
                if (!stale) setListError(e?.message || 'Could not load reports.')
            })
            .finally(() => {
                if (!stale) setListLoading(false)
            })
        return () => {
            stale = true
        }
    }, [signedIn, me, source, page])

    // Fetching is effect-driven (not click-driven) so a restored drill-down
    // position refills its data after navigating away and back.
    useEffect(() => {
        if (!signedIn || !report) return
        let stale = false
        setFights(null)
        setFightsError(null)
        fetchReportFights(gql, report.code)
            .then(({ fights: fs }) => {
                if (!stale) setFights(fs)
            })
            .catch((e) => {
                if (!stale) setFightsError(e?.message || 'Could not load fights.')
            })
        return () => {
            stale = true
        }
    }, [signedIn, report])

    useEffect(() => {
        if (!signedIn || !report || !fight) return
        let stale = false
        setPlayers(null)
        setPlayersError(null)
        setPicked([])
        setAutoPickedName(null)
        fetchFightPlayerRows(gql, report.code, fight.id, {
            startTime: fight.startTime,
            endTime: fight.endTime,
        })
            .then((rows) => {
                if (stale) return
                setPlayers(rows)
                if (!rows.length) {
                    setPlayersError('No player roster found for this pull.')
                    return
                }
                // Same character as last time? Pre-select them as player 1.
                const last = readLastPlayer().toLowerCase()
                const match = last ? rows.find((p) => p.name.toLowerCase() === last) : undefined
                if (match) {
                    setPicked([match])
                    setAutoPickedName(match.name)
                }
            })
            .catch((e) => {
                if (!stale) setPlayersError(e?.message || 'Could not load players.')
            })
        return () => {
            stale = true
        }
    }, [signedIn, report, fight])

    const openReport = useCallback((r: WclReportSummary) => {
        setReport(r)
        setFight(null)
    }, [])

    const openFight = useCallback((f: WclFightSummary) => {
        setFight(f)
    }, [])

    const resetToReports = useCallback(() => {
        setFight(null)
        setReport(null)
        setPicked([])
        setAutoPickedName(null)
    }, [])

    function togglePick(p: FightPlayerRow) {
        setAutoPickedName(null)
        setPicked((prev) => {
            const without = prev.filter((x) => x.id !== p.id)
            if (without.length !== prev.length) return without
            // Keep at most two: the first pick stays player 1, a third pick replaces the second.
            return prev.length < 2 ? [...prev, p] : [prev[0], p]
        })
    }

    function analyze() {
        if (!report || !fight || picked.length === 0) return
        writeLastPlayer(picked[0].name)
        const url =
            picked.length === 1
                ? buildSoloUrl(report.code, fight.id, picked[0].id)
                : buildCompareUrl(report.code, fight.id, picked[0].id, picked[1].id)
        void fa.loadCompare(url)
        void router.push('/')
    }

    function compareVsRank(r: WclTopRank) {
        if (!report || !fight || !rankTarget) return
        writeLastPlayer(rankTarget.name)
        const url = buildCrossReportCompareUrl(
            report.code,
            fight.id,
            rankTarget.id,
            r.reportCode,
            r.fightID,
            r.name,
        )
        void fa.loadCompare(url)
        void router.push('/')
    }

    if (fa.authStatus === 'checking') return <p className={styles.mono}>Checking WarcraftLogs sign-in…</p>
    if (!signedIn) return null // page shows WclKeyPrompt

    if (meError) return <p className={`${styles.mono} ${styles.errorText}`}>{meError}</p>
    if (!me) return <p className={styles.mono}>Loading your WCL account…</p>

    /* ------------------------------ player grid ------------------------------ */
    if (report && fight) {
        const byRole: Array<{ label: string; role: FightPlayerRow['role'] }> = [
            { label: 'Tanks', role: 'tank' },
            { label: 'Healers', role: 'healer' },
            { label: 'DPS', role: 'dps' },
        ]
        const pickIndex = (id: number) => picked.findIndex((p) => p.id === id)
        return (
            <>
                <BackRow
                    onBack={() => setFight(null)}
                    backLabel="All pulls"
                    right={
                        <div className={styles.backActions}>
                            <button
                                type="button"
                                className={`${ui.btnGhost} ${ui.btnGhostSm}`}
                                onClick={resetToReports}
                            >
                                ⟲ All reports
                            </button>
                            <a
                                className={`${ui.btnGhost} ${ui.btnGhostSm}`}
                                href={wclReportLink(report.code, fight.id)}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Open on WCL ↗
                            </a>
                        </div>
                    }
                />
                <div className={styles.fightHeader}>
                    <span className={styles.goldTitle}>{fight.name}</span>
                    <span className={styles.badge}>{difficultyLabel(fight.difficulty) || '—'}</span>
                    <KillBadge fight={fight} />
                    <span className={styles.dim}>{fmtDuration(fight.startTime, fight.endTime)}</span>
                </div>

                <p className={`${styles.mono} ${styles.pickIntro}`}>
                    Pick <strong className={styles.strongText}>one player</strong> to analyze solo, or{' '}
                    <strong className={styles.strongText}>two</strong> to compare — your first pick is player
                    1.
                </p>

                {playersError && <p className={`${styles.mono} ${styles.errorText}`}>{playersError}</p>}
                {!players && !playersError && <p className={styles.mono}>Loading roster…</p>}

                {players &&
                    byRole.map(({ label, role }) => {
                        const rows = players.filter((p) => p.role === role)
                        if (!rows.length) return null
                        return (
                            <div key={role} className={styles.roleSection}>
                                <div className={`${ui.label} ${styles.roleLabel}`}>
                                    {label} <span className={styles.countDim}>· {rows.length}</span>
                                </div>
                                <div className={styles.playerGrid}>
                                    {rows.map((p) => {
                                        const idx = pickIndex(p.id)
                                        const selected = idx >= 0
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => togglePick(p)}
                                                className={`${styles.rowBtn} ${styles.playerCard}${
                                                    selected ? ` ${styles.playerCardSelected}` : ''
                                                }`}
                                            >
                                                {p.iconUrl ? (
                                                    <img
                                                        src={p.iconUrl}
                                                        alt=""
                                                        width={26}
                                                        height={26}
                                                        className={styles.playerIcon}
                                                    />
                                                ) : null}
                                                <span className={styles.cellText}>
                                                    <span
                                                        className={styles.rowTitle}
                                                        style={{ color: wowClassColor(p.className) }}
                                                    >
                                                        {p.name}
                                                    </span>
                                                    <span className={`${styles.dim} ${styles.block}`}>
                                                        {p.specLabel && p.specLabel !== p.className
                                                            ? `${p.specLabel} ${wowClassDisplayName(p.className)}`
                                                            : wowClassDisplayName(p.className)}
                                                    </span>
                                                </span>
                                                {selected && (
                                                    <span className={`${styles.badge} ${styles.pickBadge}`}>
                                                        {idx === 0 ? 'P1' : 'P2'}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                {players && (
                    <div className={styles.actionsRow}>
                        <button
                            type="button"
                            className={ui.btnGold}
                            disabled={picked.length === 0 || fa.loading}
                            onClick={analyze}
                        >
                            {picked.length === 2
                                ? `Compare ${picked[0].name} vs ${picked[1].name}`
                                : picked.length === 1
                                  ? `Analyze ${picked[0].name}`
                                  : 'Select a player'}
                        </button>
                        {picked.length > 0 && (
                            <button
                                type="button"
                                className={`${ui.btnGhost} ${ui.btnGhostSm}`}
                                onClick={() => {
                                    setPicked([])
                                    setAutoPickedName(null)
                                }}
                            >
                                Clear
                            </button>
                        )}
                        {autoPickedName && picked.some((p) => p.name === autoPickedName) && (
                            <span className={styles.dim}>
                                Auto-picked {autoPickedName} — your last character. Click their card to
                                unselect.
                            </span>
                        )}
                        {picked.length === 2 && (
                            <span className={styles.dim}>
                                Anything fancier (filters, phases) — craft the URL on WCL and paste it on
                                Analyze.
                            </span>
                        )}
                    </div>
                )}

                {rankTarget && (
                    <TopParseSection
                        playerName={rankTarget.name}
                        className={rankTarget.className}
                        specName={rankTarget.specLabel}
                        role={rankTarget.role}
                        encounterID={fight.encounterID}
                        difficulty={fight.difficulty}
                        fightDurationMs={fight.endTime - fight.startTime}
                        reportCode={report.code}
                        fightId={fight.id}
                        disabled={fa.loading}
                        onPick={compareVsRank}
                    />
                )}
            </>
        )
    }

    /* ------------------------------ fight list ------------------------------ */
    if (report) {
        return (
            <>
                <BackRow
                    onBack={() => setReport(null)}
                    backLabel="All reports"
                    right={
                        <a
                            className={`${ui.btnGhost} ${ui.btnGhostSm}`}
                            href={wclReportLink(report.code)}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open on WCL ↗
                        </a>
                    }
                />
                <div className={styles.reportHeading}>
                    <span className={styles.goldTitle}>{report.title}</span>{' '}
                    <span className={styles.dim}>
                        {report.zoneName ? `${report.zoneName} · ` : ''}
                        {fmtDate(report.startTime)}
                    </span>
                </div>

                {fightsError && <p className={`${styles.mono} ${styles.errorText}`}>{fightsError}</p>}
                {!fights && !fightsError && <p className={styles.mono}>Loading pulls…</p>}
                {fights && fights.length === 0 && (
                    <p className={styles.mono}>No boss pulls in this report.</p>
                )}

                {fights && fights.length > 0 && (
                    <div className={styles.rowList}>
                        {fights.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                className={styles.rowBtn}
                                onClick={() => openFight(f)}
                            >
                                <span className={styles.fightName}>{f.name}</span>
                                <span className={styles.badge}>{difficultyLabel(f.difficulty) || '—'}</span>
                                <KillBadge fight={f} />
                                <span className={`${styles.dim} ${styles.pushRight}`}>
                                    {fmtDuration(f.startTime, f.endTime)}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </>
        )
    }

    /* ------------------------------ report list ------------------------------ */
    const sources: Source[] = [
        { kind: 'mine' },
        ...me.guilds.map((g) => ({
            kind: 'guild' as const,
            id: g.id,
            label: g.serverName ? `${g.name} — ${g.serverName}` : g.name,
        })),
    ]
    const sourceKey = (src: Source) => (src.kind === 'mine' ? 'mine' : `guild-${src.id}`)
    const activeKey = sourceKey(source)

    return (
        <>
            <div className={styles.sourceTabs}>
                {sources.map((src) => {
                    const key = sourceKey(src)
                    const active = key === activeKey
                    return (
                        <button
                            key={key}
                            type="button"
                            className={`${ui.rosterPick}${active ? ` ${ui.rosterPickActive}` : ''}`}
                            onClick={() => {
                                setSource(src)
                                setPage(1)
                            }}
                        >
                            {src.kind === 'mine' ? 'My uploads' : src.label}
                        </button>
                    )
                })}
            </div>

            {listError && <p className={`${styles.mono} ${styles.errorText}`}>{listError}</p>}
            {listLoading && !reportPage && <p className={styles.mono}>Loading reports…</p>}
            {reportPage && reportPage.reports.length === 0 && (
                <p className={styles.mono}>
                    {source.kind === 'mine'
                        ? 'No uploads on your account. If your guild logs raids, try a guild tab above.'
                        : 'No reports found for this guild.'}
                </p>
            )}

            {reportPage && reportPage.reports.length > 0 && (
                <div className={`${styles.rowList}${listLoading ? ` ${styles.listLoading}` : ''}`}>
                    {reportPage.reports.map((r) => (
                        <button
                            key={r.code}
                            type="button"
                            className={styles.rowBtn}
                            onClick={() => openReport(r)}
                        >
                            <span className={styles.cellText}>
                                <span className={styles.rowTitle}>{r.title}</span>
                                <span className={styles.dim}>
                                    {r.zoneName ? `${r.zoneName} · ` : ''}
                                    {fmtDate(r.startTime)}
                                    {r.ownerName ? ` · by ${r.ownerName}` : ''}
                                </span>
                            </span>
                            <span className={`${styles.dim} ${styles.pushRight} ${styles.noShrink}`}>→</span>
                        </button>
                    ))}
                </div>
            )}

            {reportPage && (reportPage.hasMore || page > 1) && (
                <div className={styles.pagerRow}>
                    <button
                        type="button"
                        className={`${ui.btnGhost} ${ui.btnGhostSm}`}
                        disabled={page <= 1 || listLoading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        ← Newer
                    </button>
                    <span className={styles.dim}>page {reportPage.page}</span>
                    <button
                        type="button"
                        className={`${ui.btnGhost} ${ui.btnGhostSm}`}
                        disabled={!reportPage.hasMore || listLoading}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Older →
                    </button>
                </div>
            )}
        </>
    )
}

export default ReportBrowser
