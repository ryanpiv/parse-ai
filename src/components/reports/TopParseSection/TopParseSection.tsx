/**
 * Prominent "Compare vs a similar top parse" block, shared by the Reports
 * player grid and the Analyze Compare empty state. One click fetches WCL world
 * rankings for the encounter (same class/spec/difficulty, hps for healers),
 * picks the highest-ranked parse with a kill time close to the player's pull
 * (pickSimilarRank), and hands it straight to the parent to load a
 * cross-report compare — no list to wade through. Players who want the full
 * search knobs (fight length / raid size / ilvl) get a link to WCL's own
 * compare modal for this exact pull.
 */
import { useEffect, useRef, useState } from 'react'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'
import { gql } from '../../../lib/wclClient'
import { wowClassColor, wowClassDisplayName } from '../../../lib/wowClassColors'
import {
    difficultyLabel,
    fetchEncounterTopRanks,
    pickSimilarRank,
    wclCompareSearchLink,
    type WclTopRank,
} from '../../../lib/wclReports'

export type TopParseSectionProps = {
    /** Player 1 of the resulting compare. */
    playerName: string
    className: string
    specName: string
    role: 'dps' | 'healer' | 'tank'
    encounterID: number
    difficulty: number | null
    /** This pull's length — similarity is matched on kill time. */
    fightDurationMs: number
    /** For the "more options" link to WCL's compare-search modal. */
    reportCode: string
    fightId: number
    /** Start the search immediately instead of waiting for the button. */
    autoStart?: boolean
    disabled?: boolean
    onPick: (rank: WclTopRank) => void
}

const fmtAmount = (n: number): string => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `${Math.round(n / 1e3)}k`
    return String(Math.round(n))
}

const fmtDuration = (ms: number): string => {
    const total = Math.max(0, Math.round(ms / 1000))
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const TopParseSection = ({
    playerName,
    className,
    specName,
    role,
    encounterID,
    difficulty,
    fightDurationMs,
    reportCode,
    fightId,
    autoStart,
    disabled,
    onPick,
}: TopParseSectionProps) => {
    const [searching, setSearching] = useState(false)
    const [chosen, setChosen] = useState<WclTopRank | null>(null)
    const [error, setError] = useState<string | null>(null)
    const startedRef = useRef(false)

    const metric = role === 'healer' ? 'hps' : 'dps'
    const diffLabel = difficultyLabel(difficulty)
    const searchHref = wclCompareSearchLink(reportCode, fightId)

    const findAndCompare = async () => {
        setSearching(true)
        setError(null)
        try {
            const ranks = await fetchEncounterTopRanks(gql, {
                encounterID,
                className,
                specName,
                difficulty,
                metric,
            })
            const pick = pickSimilarRank(ranks, fightDurationMs)
            if (!pick) {
                setError('No ranked parses found for this spec + difficulty.')
                return
            }
            setChosen(pick)
            onPick(pick)
        } catch (e: any) {
            setError(e?.message || 'Could not load rankings.')
        } finally {
            setSearching(false)
        }
    }

    useEffect(() => {
        if (autoStart && !startedRef.current) {
            startedRef.current = true
            void findAndCompare()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart])

    return (
        <div className={styles.box}>
            <div className={`${ui.label} ${styles.heading}`}>Compare vs a similar top parse</div>
            <p className={`${styles.body} ${styles.intro}`}>
                Finds a world-ranked {specName} {wowClassDisplayName(className)}
                {diffLabel ? ` (${diffLabel})` : ''} with a kill time close to this pull (
                {fmtDuration(fightDurationMs)}) and loads it side by side with{' '}
                <strong className={styles.playerName}>{playerName}</strong> as player 1.
            </p>

            {!chosen && (
                <button
                    type="button"
                    className={ui.btnGold}
                    disabled={disabled || searching}
                    onClick={() => void findAndCompare()}
                >
                    {searching ? 'Finding a similar parse…' : `Compare ${playerName} vs a similar top parse`}
                </button>
            )}

            {chosen && (
                <p className={styles.body}>
                    Comparing vs{' '}
                    <strong style={{ color: wowClassColor(className) }}>
                        #{chosen.rank} {chosen.name}
                    </strong>{' '}
                    — {chosen.serverName}
                    {chosen.guildName ? ` · ${chosen.guildName}` : ''} · {fmtAmount(chosen.amount)} {metric} ·{' '}
                    {fmtDuration(chosen.durationMs)} kill…
                </p>
            )}

            {error && <p className={`${styles.body} ${styles.error}`}>{error}</p>}

            <p className={styles.moreOptions}>
                Want to pick yourself?{' '}
                <a href={searchHref} target="_blank" rel="noreferrer">
                    Open WCL&apos;s compare search for this pull ↗
                </a>{' '}
                (fight length, raid size, item level filters) — then paste the compare URL on Analyze.
            </p>
        </div>
    )
}

export default TopParseSection
