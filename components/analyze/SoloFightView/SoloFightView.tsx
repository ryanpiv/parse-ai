import { useMemo, type MutableRefObject } from 'react'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'
import { useFightAnalysis } from '../../../contexts/FightAnalysisContext'
import { simcAplAvailableForSpec } from '../../../lib/knowledge/embeddedSimc'
import { wowheadReferenceAvailableForSpec } from '../../../lib/knowledge/embeddedWowhead'
import { icyVeinsReferenceAvailableForSpec } from '../../../lib/knowledge/embeddedIcyVeins'
import SpellUsageChart from '../../Charts/SpellUsageChart'
import CastTimelineChart from '../../Charts/CastTimelineChart'
import MetricTimelineChart, { hasMetricSeriesData } from '../../Charts/MetricTimelineChart'
import ProcEfficiencyChart from '../../Charts/ProcEfficiencyChart'
import CooldownTimelineChart from '../../Charts/CooldownTimelineChart'
import ChartCard from '../../Charts/ChartCard'
import CritRateChart, { hasCritRateChartData } from '../../Charts/CritRateChart'
import SpellTimeline, { type SpellTimelineGroup } from '../../Charts/SpellTimeline'
import AIChat from '../../AIChat'
import CopyBtn from '../../AIChat/CopyBtn'
import CollapsibleSection from '../../CollapsibleSection'
import { CollapsibleGroupProvider, type CollapsibleBridgeApi } from '../../CollapsibleGroup'
import AnalyzeEmptyState from '../AnalyzeEmptyState'
import ClaudeKeyPrompt from '../ClaudeKeyPrompt'
import { useClaudeKeyPresent } from '../../../lib/claudeKeyBus'
import { buildInitialSoloUserPrompt } from '../../../lib/buildContext/initialComparePrompt'
import {
    PRESET_QUESTIONS_SOLO,
    SOLO_INITIAL_QUICK_LABEL,
    resolvePresetPrompt,
    PRESET_SOLO_ROTATION_WOWHEAD,
    PRESET_SOLO_ROTATION_ICY,
    PRESET_SOLO_ROTATION_BOTH,
    ROTATION_GUIDE_CLUSTER_LABEL,
    ROTATION_GUIDE_CLUSTER_LABEL_COLOR,
} from '../../../lib/prompts/chatPresets'

export type SoloFightViewProps = {
    collapsibleBridgeRef?: MutableRefObject<CollapsibleBridgeApi | null>
}

const SoloFightView = ({ collapsibleBridgeRef }: SoloFightViewProps) => {
    const fa = useFightAnalysis()
    const {
        p1data,
        p2data,
        spellRows,
        talentDiff,
        messagesAnalyze,
        inputAnalyze,
        setInputAnalyze,
        aiLoading,
        aiLiveStatus,
        simcCompareEnabled,
        setSimcCompareEnabled,
        bossName,
        fightKill1,
        sendAnalyzeQuestion,
    } = fa

    const hasClaudeKey = useClaudeKeyPresent()

    const dur1Fmt = p1data
        ? `${Math.floor(p1data.dur / 60)}:${String(Math.round(p1data.dur % 60)).padStart(2, '0')}`
        : ''

    const spellTimelineGroups: SpellTimelineGroup[] = useMemo(() => {
        if (!p1data) return []
        const ids = new Set<number>()
        for (const seg of p1data.castTimeline || []) ids.add(seg.spellId)
        const resolveName = (spellId: number) =>
            p1data.spellMap[String(spellId)]?.name || p1data.nameMap[spellId] || `Spell ${spellId}`

        return [...ids]
            .map((spellId) => ({
                spellId,
                name: resolveName(spellId),
                segments1: (p1data.castTimeline || []).filter((s) => s.spellId === spellId),
                segments2: [],
            }))
            .sort((a, b) => b.segments1.length - a.segments1.length)
            .slice(0, 22)
    }, [p1data])

    const soloSpellRows = useMemo(
        () => spellRows.filter((r) => r.count1 > 0).sort((a, b) => b.count1 - a.count1),
        [spellRows],
    )

    return (
        <>
            {!p1data && <AnalyzeEmptyState mode="solo" />}

            {p1data && p2data && (
                <CollapsibleGroupProvider bridgeRef={collapsibleBridgeRef}>
                    <>
                        <div className={ui.panel}>
                            <CollapsibleSection
                                title={
                                    <>
                                        <div className={ui.ptitleBar} />
                                        {bossName} — {p1data.name}
                                    </>
                                }
                            >
                                <div
                                    className={`${styles.summaryCard}${fightKill1 ? '' : ` ${styles.summaryCardWipe}`}`}
                                >
                                    <div className={styles.summaryLead}>
                                        <div className={styles.playerName}>
                                            {p1data.name}
                                            {!fightKill1 && <span className={styles.wipeTag}>WIPE</span>}
                                        </div>
                                        <div className={styles.dpsValue}>
                                            {p1data.dps?.toLocaleString() || '?'}{' '}
                                            <span className={styles.dpsUnit}>dps</span>
                                        </div>
                                        <div className={styles.specLine}>{p1data.spec}</div>
                                    </div>
                                    {[
                                        { label: 'Duration', value: dur1Fmt },
                                        { label: 'Casts / min', value: `${p1data.downtime.cpm}` },
                                        { label: 'Downtime', value: `${p1data.downtime.pct}%` },
                                        {
                                            label: 'Damage taken',
                                            value:
                                                p1data.takenTotal != null &&
                                                Number.isFinite(p1data.takenTotal)
                                                    ? Math.round(p1data.takenTotal).toLocaleString()
                                                    : '—',
                                        },
                                    ].map(({ label, value }) => (
                                        <div key={label} className={styles.summaryStat}>
                                            <div className={styles.summaryStatLabel}>{label}</div>
                                            <div className={styles.summaryStatValue}>{value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.tableCaption}>Spell breakdown — total casts</div>
                                <div className={styles.tableScroll}>
                                    <table className={styles.spellTable}>
                                        <thead>
                                            <tr>
                                                {[
                                                    'Spell',
                                                    'Casts',
                                                    'Casts/min',
                                                    'Crit %',
                                                    'Avg gap (s)',
                                                    'First cast',
                                                ].map((h, i) => (
                                                    <th
                                                        key={h}
                                                        className={`${styles.th}${i > 0 ? ` ${styles.thRight}` : ''}${i === 1 ? ` ${styles.thCasts}` : ''}`}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {soloSpellRows.map((r, i) => {
                                                const crit = p1data.critRates?.[r.id]
                                                const gap = p1data.spacing?.[Number(r.id)]?.avgGap
                                                return (
                                                    <tr key={i} className={styles.spellRow}>
                                                        <td className={`${styles.td} ${styles.tdSpell}`}>
                                                            <a
                                                                href={`https://www.wowhead.com/spell=${r.id}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                data-wh-spell={r.id}
                                                                data-wh-name={r.name}
                                                                className={styles.spellLink}
                                                            >
                                                                {r.name}
                                                            </a>
                                                        </td>
                                                        <td className={`${styles.td} ${styles.tdCasts}`}>
                                                            {r.count1}
                                                        </td>
                                                        <td className={`${styles.td} ${styles.tdCpm}`}>
                                                            {r.ppm1 > 0 ? r.ppm1.toFixed(2) : '—'}
                                                        </td>
                                                        <td className={`${styles.td} ${styles.tdNum}`}>
                                                            {crit != null ? `${crit}%` : '—'}
                                                        </td>
                                                        <td className={`${styles.td} ${styles.tdNum}`}>
                                                            {gap != null && Number.isFinite(gap)
                                                                ? gap.toFixed(1)
                                                                : '—'}
                                                        </td>
                                                        <td className={`${styles.td} ${styles.tdNum}`}>
                                                            {r.first1 != null ? `${r.first1}s` : '—'}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CollapsibleSection>
                        </div>

                        <div className={ui.panel}>
                            <CollapsibleSection
                                title={
                                    <>
                                        <div className={ui.ptitleBar} />
                                        Spell usage & cast rate
                                    </>
                                }
                            >
                                <div className={styles.chartStack}>
                                    {hasMetricSeriesData(p1data) && (
                                        <ChartCard title="Output over time" height={280}>
                                            <MetricTimelineChart p1data={p1data} p2data={p2data} solo />
                                        </ChartCard>
                                    )}
                                    <ChartCard title="Spell usage — casts/min" height={260}>
                                        <SpellUsageChart
                                            spellRows={spellRows}
                                            name1={p1data.name}
                                            name2={p2data.name}
                                            solo
                                        />
                                    </ChartCard>
                                    {hasCritRateChartData(p1data) && (
                                        <ChartCard title="Crit % — top spells by cast count" height={220}>
                                            <CritRateChart p1data={p1data} />
                                        </ChartCard>
                                    )}
                                    <ChartCard title="Cast rate over time (30s windows)" height={240}>
                                        <CastTimelineChart p1data={p1data} p2data={p2data} solo />
                                    </ChartCard>
                                </div>
                            </CollapsibleSection>
                            <CollapsibleSection
                                title={
                                    <>
                                        <div className={ui.ptitleBar} />
                                        Buff uptime & cooldowns
                                    </>
                                }
                            >
                                <div className={styles.chartGridTwo}>
                                    <ChartCard title="Buff uptime %" height={200}>
                                        <ProcEfficiencyChart p1data={p1data} p2data={p2data} solo />
                                    </ChartCard>
                                    <ChartCard title="Major cooldowns (total casts)" height={220}>
                                        <CooldownTimelineChart
                                            p1data={p1data}
                                            p2data={p2data}
                                            spellRows={spellRows}
                                            solo
                                        />
                                    </ChartCard>
                                </div>
                            </CollapsibleSection>
                            <CollapsibleSection
                                title={
                                    <>
                                        <div className={ui.ptitleBar} />
                                        Spell cast timeline
                                    </>
                                }
                            >
                                <div className={styles.timelineCard}>
                                    <SpellTimeline
                                        groups={spellTimelineGroups}
                                        name1={p1data.name}
                                        name2={p2data.name}
                                        dur1={p1data.dur}
                                        dur2={p2data.dur}
                                        solo
                                    />
                                </div>
                            </CollapsibleSection>
                        </div>

                        <div className={ui.panel}>
                            <CollapsibleSection
                                key={hasClaudeKey ? 'claude-ready' : 'claude-locked'}
                                defaultOpen={hasClaudeKey}
                                title={
                                    <>
                                        <div className={ui.ptitleBar} />
                                        Ask Claude
                                    </>
                                }
                                rightSlot={
                                    messagesAnalyze.length > 0 ? (
                                        <CopyBtn
                                            text={messagesAnalyze
                                                .map(
                                                    (m) =>
                                                        `${m.role === 'user' ? 'You' : 'Claude'}:\n${m.content}`,
                                                )
                                                .join('\n\n---\n\n')}
                                            label="Copy All"
                                        />
                                    ) : undefined
                                }
                            >
                                {!hasClaudeKey ? (
                                    <ClaudeKeyPrompt />
                                ) : (
                                    <AIChat
                                        messages={messagesAnalyze}
                                        input={inputAnalyze}
                                        onInputChange={setInputAnalyze}
                                        onSend={sendAnalyzeQuestion}
                                        aiLoading={aiLoading}
                                        aiLiveStatus={aiLiveStatus}
                                        inputPlaceholder="Ask about your rotation, cooldowns, procs…"
                                        quickQuestions={
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!p1data) return
                                                        sendAnalyzeQuestion(
                                                            buildInitialSoloUserPrompt({
                                                                playerName: talentDiff?.name1 ?? p1data.name,
                                                                spec: p1data.spec,
                                                                isKill: fightKill1,
                                                                simcGrounded:
                                                                    simcCompareEnabled &&
                                                                    simcAplAvailableForSpec(
                                                                        talentDiff?.specId,
                                                                    ),
                                                            }),
                                                        )
                                                    }}
                                                    disabled={aiLoading}
                                                    title="Sends the full default solo prompt (Part 1 + Part 2, wipe note). Adds SimulationCraft APL to context only when “Compare to SimulationCraft APL” is on (gold border) for a supported spec — shorthand label only."
                                                    className={ui.quickTile}
                                                >
                                                    {SOLO_INITIAL_QUICK_LABEL}
                                                </button>
                                                {(() => {
                                                    const simcForSpec = simcAplAvailableForSpec(
                                                        talentDiff?.specId,
                                                    )
                                                    const simcOn = simcCompareEnabled && simcForSpec
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (simcForSpec)
                                                                    setSimcCompareEnabled(!simcCompareEnabled)
                                                            }}
                                                            disabled={aiLoading}
                                                            title={
                                                                simcForSpec
                                                                    ? 'Click to include SimulationCraft’s default APL in Claude’s system context (gold border = on). Does not send a message. Use “Ask: log casts vs SimC + Wowhead” to request a cast-by-cast comparison.'
                                                                    : 'SimulationCraft APL context is only wired for Mage and Death Knight (all three specs each).'
                                                            }
                                                            className={
                                                                ui.quickTile +
                                                                (simcOn ? ` ${ui.quickTileActive}` : '') +
                                                                (!simcForSpec
                                                                    ? ` ${ui.quickTileUnavailable}`
                                                                    : '')
                                                            }
                                                        >
                                                            {simcForSpec
                                                                ? 'Compare to SimulationCraft APL'
                                                                : 'Compare to SimulationCraft APL (unavailable)'}
                                                        </button>
                                                    )
                                                })()}
                                                {(() => {
                                                    const whOk = wowheadReferenceAvailableForSpec(
                                                        talentDiff?.specId,
                                                    )
                                                    const icyOk = icyVeinsReferenceAvailableForSpec(
                                                        talentDiff?.specId,
                                                    )
                                                    const bothOk = whOk && icyOk
                                                    return (
                                                        <div className={styles.guideCluster}>
                                                            <div
                                                                className={styles.guideClusterLabel}
                                                                style={{
                                                                    color: ROTATION_GUIDE_CLUSTER_LABEL_COLOR,
                                                                }}
                                                            >
                                                                {ROTATION_GUIDE_CLUSTER_LABEL}
                                                            </div>
                                                            <div className={styles.guideChipRow}>
                                                                <button
                                                                    type="button"
                                                                    disabled={aiLoading || !whOk}
                                                                    title={
                                                                        whOk
                                                                            ? 'Include Wowhead scraped rotation/talent text. Asks Claude to compare your log to that guide.'
                                                                            : 'Wowhead scraped bundle is not available for this spec yet.'
                                                                    }
                                                                    className={ui.guideChip}
                                                                    onClick={() =>
                                                                        sendAnalyzeQuestion(
                                                                            PRESET_SOLO_ROTATION_WOWHEAD,
                                                                        )
                                                                    }
                                                                >
                                                                    Wowhead
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={aiLoading || !icyOk}
                                                                    title={
                                                                        icyOk
                                                                            ? 'Include Icy Veins scraped rotation text. Asks Claude to compare your log to that guide.'
                                                                            : 'Icy Veins scraped bundle is not available for this spec yet.'
                                                                    }
                                                                    className={ui.guideChip}
                                                                    onClick={() =>
                                                                        sendAnalyzeQuestion(
                                                                            PRESET_SOLO_ROTATION_ICY,
                                                                        )
                                                                    }
                                                                >
                                                                    Icy Veins
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={aiLoading || !bothOk}
                                                                    title={
                                                                        bothOk
                                                                            ? 'Include Wowhead and Icy Veins excerpts. Compares your pull to both guides.'
                                                                            : 'Both requires Wowhead and Icy Veins data for this spec (e.g. Frost Mage).'
                                                                    }
                                                                    className={ui.guideChip}
                                                                    onClick={() =>
                                                                        sendAnalyzeQuestion(
                                                                            PRESET_SOLO_ROTATION_BOTH,
                                                                        )
                                                                    }
                                                                >
                                                                    Both
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                                {PRESET_QUESTIONS_SOLO.map((p, i) => {
                                                    const { label, prompt } = resolvePresetPrompt(p)
                                                    return (
                                                        <button
                                                            key={`${i}-${label}`}
                                                            type="button"
                                                            onClick={() => sendAnalyzeQuestion(prompt)}
                                                            disabled={aiLoading}
                                                            className={ui.quickTile}
                                                        >
                                                            {label}
                                                        </button>
                                                    )
                                                })}
                                            </>
                                        }
                                    />
                                )}
                            </CollapsibleSection>
                        </div>
                    </>
                </CollapsibleGroupProvider>
            )}
        </>
    )
}

export default SoloFightView
