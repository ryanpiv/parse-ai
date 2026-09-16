/**
 * "Compare vs a similar top parse" entry on the Analyze page's Compare tab,
 * shown when the current load is a single-player report. One click resolves
 * the loaded fight + player from the report (encounter, difficulty,
 * class/spec), then the shared TopParseSection auto-runs: it finds a
 * world-ranked parse with a similar kill time and kicks off a cross-report
 * compare through the normal load pipeline.
 */
import { useMemo, useState } from 'react'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'
import { gql } from '../../../lib/wclClient'
import { useFightAnalysis } from '../../../contexts/FightAnalysisContext'
import { parseWclUrl, resolveReportFightQuery } from '../../../lib/wclReportUrl'
import { fetchFightPlayerRows, type FightPlayerRow } from '../../../lib/wclFightPlayers'
import {
    buildCrossReportCompareUrl,
    fetchReportFights,
    type WclFightSummary,
    type WclTopRank,
} from '../../../lib/wclReports'
import TopParseSection from '../../reports/TopParseSection'

interface IResolvedMeta {
    fight: WclFightSummary
    player: FightPlayerRow
}

const TopParseCompare = () => {
    const fa = useFightAnalysis()
    const [meta, setMeta] = useState<IResolvedMeta | null>(null)
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

    async function handleResolveFight() {
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
        } catch (e) {
            setError((e instanceof Error && e.message) || 'Could not look up this fight on WCL.')
        } finally {
            setLoading(false)
        }
    }

    function handleCompareVsRank(r: WclTopRank) {
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
                onPick={handleCompareVsRank}
            />
        )
    }

    return (
        <div className={styles.lookupBlock}>
            <button
                type="button"
                className={ui.btnGold}
                disabled={loading}
                onClick={() => void handleResolveFight()}
            >
                {loading ? 'Looking up this fight…' : `Compare ${playerName} vs a similar top parse`}
            </button>
            {error && <p className={styles.lookupError}>{error}</p>}
        </div>
    )
}

export default TopParseCompare
