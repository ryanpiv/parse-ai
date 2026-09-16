/**
 * "Compare vs a similar top parse" entry on the Analyze page's Compare tab,
 * shown when the current load is a single-player report. One click resolves
 * the loaded fight + player from the report (encounter, difficulty,
 * class/spec), then the shared TopParseSection auto-runs: it finds a
 * world-ranked parse with a similar kill time and kicks off a cross-report
 * compare through the normal load pipeline.
 */
import { useMemo, useState } from 'react'
import { pa } from '../../lib/styles'
import { gql } from '../../lib/wclClient'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { parseWclUrl, resolveReportFightQuery } from '../../lib/wclReportUrl'
import { fetchFightPlayerRows, type FightPlayerRow } from '../../lib/wclFightPlayers'
import {
    buildCrossReportCompareUrl,
    fetchReportFights,
    type WclFightSummary,
    type WclTopRank,
} from '../../lib/wclReports'
import TopParseSection from '../reports/TopParseSection'

interface ResolvedMeta {
    fight: WclFightSummary
    player: FightPlayerRow
}

export function TopParseCompare() {
    const fa = useFightAnalysis()
    const [meta, setMeta] = useState<ResolvedMeta | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const parsed = useMemo(() => {
        try {
            const p = parseWclUrl(fa.compareUrl)
            return p.kind === 'report' ? p : null
        } catch {
            return null
        }
    }, [fa.compareUrl])

    const playerName = fa.talentDiff?.name1 || 'player 1'

    if (!parsed || fa.authStatus !== 'ok') return null

    async function resolve() {
        if (!parsed) return
        setLoading(true)
        setError(null)
        try {
            const { fights } = await fetchReportFights(gql, parsed.code)
            const fightId = resolveReportFightQuery(fights, parsed.fightQuery)
            const fight = fights.find((f) => f.id === fightId)
            if (!fight) throw new Error('Loaded fight is not a boss pull — rankings need a boss encounter.')
            const rows = await fetchFightPlayerRows(gql, parsed.code, fightId, {
                startTime: fight.startTime,
                endTime: fight.endTime,
            })
            const pid = fa.soloRosterSelectedPlayerId
            const player =
                (pid != null ? rows.find((r) => r.id === pid) : undefined) ??
                rows.find((r) => r.name.toLowerCase() === playerName.toLowerCase())
            if (!player) throw new Error('Could not find the loaded player in the fight roster.')
            setMeta({ fight, player })
        } catch (e: any) {
            setError(e?.message || 'Could not look up this fight on WCL.')
        } finally {
            setLoading(false)
        }
    }

    function compareVsRank(r: WclTopRank) {
        if (!parsed || !meta) return
        const url = buildCrossReportCompareUrl(
            parsed.code,
            meta.fight.id,
            meta.player.id,
            r.reportCode,
            r.fightID,
            r.name,
        )
        void fa.loadCompare(url)
    }

    if (meta) {
        return (
            <TopParseSection
                playerName={meta.player.name}
                className={meta.player.className}
                specName={meta.player.specLabel}
                role={meta.player.role}
                encounterID={meta.fight.encounterID}
                difficulty={meta.fight.difficulty}
                fightDurationMs={meta.fight.endTime - meta.fight.startTime}
                reportCode={parsed.code}
                fightId={meta.fight.id}
                autoStart
                disabled={fa.loading}
                onPick={compareVsRank}
            />
        )
    }

    return (
        <div style={{ margin: '16px 0 20px' }}>
            <button type="button" className={pa.btnGold} disabled={loading} onClick={() => void resolve()}>
                {loading ? 'Looking up this fight…' : `Compare ${playerName} vs a similar top parse`}
            </button>
            {error && (
                <p
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: 12.5,
                        color: 'var(--red, #e06c75)',
                        marginTop: 8,
                    }}
                >
                    {error}
                </p>
            )}
        </div>
    )
}
