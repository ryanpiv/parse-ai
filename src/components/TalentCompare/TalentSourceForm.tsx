import { useEffect, useRef, useState } from 'react'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { useAppSession } from '../../contexts/AppSessionContext'
import { gql } from '../../lib/wclClient'
import { parseTalentStringHeader } from '../../lib/talents/decodeTalentString'
import { talentDataToP1RowsJson } from '../../lib/talents/p1TalentTreeSession'
import {
    confirmTalentPlayer,
    loadTalentsFromWclUrl,
    type TalentLoadPick,
} from '../../lib/talents/loadTalentsFromWclUrl'
import Accordion from '../ui/Accordion'
import FieldRow from '../ui/FieldRow'
import OrDivider from '../ui/OrDivider'
import Panel from '../ui/Panel'
import type { FightPlayerRow } from '../../lib/wclFightPlayers'
import ui from '../../styles/ui.module.css'
import styles from './styles.module.css'

const TalentSourceForm = () => {
    const fa = useFightAnalysis()
    const { hydrated, session, patchSession } = useAppSession()
    const [stringDraft, setStringDraft] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [ok, setOk] = useState<string | null>(null)
    const [pick, setPick] = useState<TalentLoadPick | null>(null)
    const prefilledRef = useRef(false)
    /** WCL URL accordion — opened automatically (once) when a logs link is present. */
    const [wclOpen, setWclOpen] = useState(false)
    const wclOpenedOnceRef = useRef(false)

    // Prefill the export-string box with the saved player-1 string (from parse AI or a prior load).
    useEffect(() => {
        if (!hydrated || prefilledRef.current) return
        prefilledRef.current = true
        if (session.compareStr1?.trim()) setStringDraft(session.compareStr1)
    }, [hydrated, session.compareStr1])

    function applyLoaded(name: string, specId: number, talentString: string, talentTree: unknown[]) {
        let sid = specId
        if (!sid && talentString) {
            try {
                sid = parseTalentStringHeader(talentString).specId
            } catch {
                /* keep 0 */
            }
        }
        patchSession({
            compareStr1: talentString,
            specId: sid || null,
            p1TalentTreeJson: talentDataToP1RowsJson(talentTree),
            compareName1: name,
        })
        if (talentString) setStringDraft(talentString)
        setOk(`${name}${sid ? ` · spec ${sid}` : ''} loaded`)
        setPick(null)
    }

    async function applyString() {
        setError(null)
        setOk(null)
        const trimmed = stringDraft.trim()
        if (!trimmed) {
            setError('Paste a talent export string, or load a report from the Warcraft Logs URL above.')
            return
        }
        try {
            const header = parseTalentStringHeader(trimmed)
            patchSession({
                compareStr1: trimmed,
                specId: header.specId,
                p1TalentTreeJson: '',
                compareName1: 'Export',
            })
            setOk(`Export string applied · spec ${header.specId}`)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Invalid talent string.')
        }
    }

    async function loadFromUrl() {
        setError(null)
        setOk(null)
        const url = fa.compareUrl.trim()
        if (!url) {
            setError(
                'Paste a Warcraft Logs report or compare URL in the Warcraft Logs box above, then Load talents.',
            )
            return
        }
        setBusy(true)
        try {
            const result = await loadTalentsFromWclUrl(url, gql)
            if (result.kind === 'pick-player') {
                setPick(result)
                setOk(null)
                return
            }
            applyLoaded(result.name, result.specId, result.talentString, result.talentTree)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load talents from that URL.')
        } finally {
            setBusy(false)
        }
    }

    // Open the WCL accordion once when a logs link is present. Loading only happens on click.
    useEffect(() => {
        if (!hydrated || wclOpenedOnceRef.current || !fa.compareUrl.trim()) return
        wclOpenedOnceRef.current = true
        setWclOpen(true)
    }, [hydrated, fa.compareUrl])

    async function pickPlayer(p: FightPlayerRow) {
        if (!pick) return
        setBusy(true)
        setError(null)
        try {
            const result = await confirmTalentPlayer(gql, pick, p.id, p.name)
            applyLoaded(result.name, result.specId, result.talentString, result.talentTree)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load that character.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Panel title="Load talents — a WCL URL or an export string" style={{ marginBottom: 16 }}>
            <p className={`${ui.note} ${styles.formNote}`}>
                Load from a Warcraft Logs URL (single report with <code>?fight=</code>, or a compare URL —
                player 1), or paste an export string (<code>/etl</code>, Wowhead, Raidbots).
            </p>
            <div className={styles.accordionBlock}>
                <Accordion
                    label="Load from Warcraft Logs"
                    open={wclOpen}
                    onToggle={() => setWclOpen((o) => !o)}
                >
                    <FieldRow
                        label="Warcraft Logs URL"
                        action={
                            <button
                                type="button"
                                className={ui.btnGold}
                                disabled={busy || !fa.compareUrl.trim()}
                                onClick={() => void loadFromUrl()}
                            >
                                {busy ? 'Loading…' : 'Load talents'}
                            </button>
                        }
                    >
                        <input
                            className={ui.input}
                            value={fa.compareUrl}
                            onChange={(e) => fa.setCompareUrl(e.target.value)}
                            placeholder="https://www.warcraftlogs.com/reports/… or …/compare/…"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && fa.compareUrl.trim() && !busy) void loadFromUrl()
                            }}
                        />
                    </FieldRow>
                </Accordion>
            </div>
            {wclOpen && <OrDivider label="or paste an export string" />}
            <FieldRow
                label="Talent export string"
                action={
                    <button
                        type="button"
                        className={ui.btnGold}
                        disabled={busy}
                        onClick={() => void applyString()}
                    >
                        Apply string
                    </button>
                }
                style={{ marginBottom: 12 }}
            >
                <textarea
                    className={`${ui.input} ${styles.exportTextarea}`}
                    rows={2}
                    value={stringDraft}
                    onChange={(e) => setStringDraft(e.target.value)}
                    placeholder="Paste talent export string…"
                />
            </FieldRow>
            {pick && pick.players.length > 0 && (
                <div className={styles.pickSection}>
                    <div className={`${ui.label} ${styles.pickLabel}`}>Select character</div>
                    <div className={styles.pickRow}>
                        {pick.players.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                disabled={busy}
                                onClick={() => void pickPlayer(p)}
                                className={ui.rosterPick}
                                title={`${p.role} · ${p.className}`}
                            >
                                {p.iconUrl ? (
                                    <img
                                        src={p.iconUrl}
                                        alt=""
                                        width={24}
                                        height={24}
                                        className={styles.pickIcon}
                                    />
                                ) : (
                                    <span className={styles.pickIconPlaceholder} />
                                )}
                                <span>
                                    <span className={styles.pickName}>{p.name}</span>
                                    <span className={styles.pickSpec}>{p.specLabel}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {error && <div className={ui.alertErr}>{error}</div>}
            {ok && <div className={ui.alertOk}>{ok}</div>}
        </Panel>
    )
}

export default TalentSourceForm
