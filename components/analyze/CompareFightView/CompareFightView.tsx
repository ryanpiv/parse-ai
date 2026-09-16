import { useMemo, useState, type MutableRefObject } from 'react'
import Link from 'next/link'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'
import { useFightAnalysis, type FightSpellRow } from '../../../contexts/FightAnalysisContext'
import { wowheadReferenceAvailableForSpec } from '../../../lib/knowledge/embeddedWowhead'
import { icyVeinsReferenceAvailableForSpec } from '../../../lib/knowledge/embeddedIcyVeins'
import { TalentCompare } from '../../TalentCompare'
import SpellUsageChart from '../../Charts/SpellUsageChart'
import CastTimelineChart from '../../Charts/CastTimelineChart'
import MetricTimelineChart, { hasMetricSeriesData } from '../../Charts/MetricTimelineChart'
import ProcEfficiencyChart from '../../Charts/ProcEfficiencyChart'
import CooldownTimelineChart from '../../Charts/CooldownTimelineChart'
import ChartCard from '../../Charts/ChartCard'
import SpellTimeline, { type SpellTimelineGroup } from '../../Charts/SpellTimeline'
import AIChat from '../../AIChat'
import CopyBtn from '../../AIChat/CopyBtn'
import CollapsibleSection from '../../CollapsibleSection'
import { CollapsibleGroupProvider, type CollapsibleBridgeApi } from '../../CollapsibleGroup'
import AnalyzeEmptyState from '../AnalyzeEmptyState'
import ClaudeKeyPrompt from '../ClaudeKeyPrompt'
import { useClaudeKeyPresent } from '../../../lib/claudeKeyBus'
import {
    PRESET_QUESTIONS_COMPARE,
    resolvePresetPrompt,
    PRESET_COMPARE_ROTATION_WOWHEAD,
    PRESET_COMPARE_ROTATION_ICY,
    PRESET_COMPARE_ROTATION_BOTH,
    COMPARE_TOP_QUICK_ITEMS,
    ROTATION_GUIDE_CLUSTER_LABEL,
    ROTATION_GUIDE_CLUSTER_LABEL_COLOR,
} from '../../../lib/prompts/chatPresets'

export type CompareFightViewProps = {
    collapsibleBridgeRef?: MutableRefObject<CollapsibleBridgeApi | null>
}

const CompareFightView = ({ collapsibleBridgeRef }: CompareFightViewProps) => {
    const fa = useFightAnalysis()
    const {
        p1data,
        p2data,
        spellRows,
        talentDiff,
        messagesCompare,
        inputCompare,
        setInputCompare,
        aiLoading,
        aiLiveStatus,
        startInitialCompareAnalysis,
        bossName,
        fightKill1,
        fightKill2,
        sendCompareQuestion,
        downloadDataCompare,
    } = fa

    const [trimToShortestFight, setTrimToShortestFight] = useState(false)
    const hasClaudeKey = useClaudeKeyPresent()

    const dur1Fmt = p1data
        ? `${Math.floor(p1data.dur / 60)}:${String(Math.round(p1data.dur % 60)).padStart(2, '0')}`
        : ''
    const dur2Fmt = p2data
        ? `${Math.floor(p2data.dur / 60)}:${String(Math.round(p2data.dur % 60)).padStart(2, '0')}`
        : ''

    const spellTimelineGroups: SpellTimelineGroup[] = useMemo(() => {
        if (!p1data || !p2data) return []
        const ids = new Set<number>()
        for (const seg of p1data.castTimeline || []) ids.add(seg.spellId)
        for (const seg of p2data.castTimeline || []) ids.add(seg.spellId)
        const resolveName = (spellId: number) =>
            p1data.spellMap[String(spellId)]?.name ||
            p2data.spellMap[String(spellId)]?.name ||
            p1data.nameMap[spellId] ||
            `Spell ${spellId}`

        return [...ids]
            .map((spellId) => ({
                spellId,
                name: resolveName(spellId),
                segments1: (p1data.castTimeline || []).filter((s) => s.spellId === spellId),
                segments2: (p2data.castTimeline || []).filter((s) => s.spellId === spellId),
            }))
            .sort((a, b) => {
                const na = a.segments1.length + a.segments2.length
                const nb = b.segments1.length + b.segments2.length
                return nb - na
            })
            .slice(0, 22)
    }, [p1data, p2data])

    const compareWindowSec = useMemo(() => {
        if (!p1data || !p2data) return null
        return trimToShortestFight ? Math.min(p1data.dur, p2data.dur) : Math.max(p1data.dur, p2data.dur)
    }, [trimToShortestFight, p1data, p2data])

    const effectiveSpellRows = useMemo(() => {
        if (!p1data || !p2data || !trimToShortestFight) return spellRows
        const windowSec = Math.min(p1data.dur, p2data.dur)
        if (!Number.isFinite(windowSec) || windowSec <= 0) return spellRows
        const eps = 0.01
        return spellRows
            .map((row) => {
                const ts1 = (row.ts1 || []).filter((t) => Number.isFinite(t) && t <= windowSec + eps)
                const ts2 = (row.ts2 || []).filter((t) => Number.isFinite(t) && t <= windowSec + eps)
                const count1 = ts1.length
                const count2 = ts2.length
                const ppm1 = count1 > 0 ? Number(((count1 / windowSec) * 60).toFixed(2)) : 0
                const ppm2 = count2 > 0 ? Number(((count2 / windowSec) * 60).toFixed(2)) : 0
                return {
                    ...row,
                    ts1,
                    ts2,
                    count1,
                    count2,
                    ppm1,
                    ppm2,
                    first1: ts1.length ? Number(ts1[0].toFixed(1)) : null,
                    first2: ts2.length ? Number(ts2[0].toFixed(1)) : null,
                } satisfies FightSpellRow
            })
            .filter((row) => row.count1 > 0 || row.count2 > 0)
    }, [spellRows, trimToShortestFight, p1data, p2data])

    if (!p1data || !p2data) {
        return <AnalyzeEmptyState mode="compare" />
    }

    return (
        <CollapsibleGroupProvider bridgeRef={collapsibleBridgeRef}>
            <>
                <div className={ui.panel}>
                    <label className={styles.trimLabel}>
                        <input
                            type="checkbox"
                            checked={trimToShortestFight}
                            onChange={(e) => setTrimToShortestFight(e.target.checked)}
                            className={styles.trimCheckbox}
                        />
                        <span>
                            <strong className={styles.strongText}>
                                Trim to shorter fight (all cast-based views)
                            </strong>
                            {' — '}
                            when enabled, compare charts/tables use only the shared window from pull start to
                            the shorter fight length. Default is off (no trim).
                        </span>
                    </label>
                    <CollapsibleSection
                        title={
                            <>
                                <div className={ui.ptitleBar} />
                                {bossName}
                            </>
                        }
                        rightSlot={
                            <button type="button" className={ui.btnGhost} onClick={downloadDataCompare}>
                                Download Data
                            </button>
                        }
                    >
                        <div className={styles.playerCardGrid}>
                            {[
                                {
                                    data: p1data,
                                    dur: dur1Fmt,
                                    color: 'var(--gold2)',
                                    label: 'you',
                                    isKill: fightKill1,
                                },
                                {
                                    data: p2data,
                                    dur: dur2Fmt,
                                    color: 'var(--blue)',
                                    label: 'comparison',
                                    isKill: fightKill2,
                                },
                            ].map((p, i) => (
                                <div
                                    key={i}
                                    className={`${styles.playerCard}${p.isKill ? '' : ` ${styles.playerCardWipe}`}`}
                                >
                                    <div className={styles.playerCardName} style={{ color: p.color }}>
                                        {p.data.name} — {p.label}
                                        {!p.isKill && <span className={styles.wipeTag}>WIPE</span>}
                                    </div>
                                    <div className={styles.playerCardDps} style={{ color: p.color }}>
                                        {p.data.dps?.toLocaleString() || '?'}{' '}
                                        <span className={styles.dpsUnit}>dps</span>
                                    </div>
                                    <div className={styles.playerCardMeta}>
                                        {p.dur} · {p.data.downtime.cpm}/min · {p.data.downtime.pct}% downtime
                                        · {p.data.spec}
                                    </div>
                                    <div className={styles.playerCardBuffs}>
                                        {(() => {
                                            const topBuffs = Object.entries(p.data.uptimes || {})
                                                .map(([id, pct]) => ({
                                                    name: p.data.nameMap?.[Number(id)] || `Buff ${id}`,
                                                    pct: pct as number,
                                                }))
                                                .filter((b) => b.pct > 0 && !b.name.startsWith('Buff '))
                                                .sort((a, b) => b.pct - a.pct)
                                                .slice(0, 3)
                                            return topBuffs.length > 0 ? (
                                                <div className={styles.buffLine}>
                                                    {topBuffs.map((b, bi) => (
                                                        <span key={bi}>
                                                            {bi > 0 && ' · '}
                                                            {b.name}:{' '}
                                                            <span style={{ color: p.color }}>{b.pct}%</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.tableCaption}>Spell breakdown — total casts</div>
                        <div className={styles.tableScroll}>
                            <table className={styles.spellTable}>
                                <thead>
                                    <tr>
                                        {['Spell', p1data.name, p2data.name, 'Diff', 'First cast'].map(
                                            (h, i) => (
                                                <th
                                                    key={i}
                                                    className={`${styles.th}${i > 0 ? ` ${styles.thRight}` : ''}${i === 1 ? ` ${styles.thP1}` : ''}${i === 2 ? ` ${styles.thP2}` : ''}`}
                                                >
                                                    {h}
                                                </th>
                                            ),
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {effectiveSpellRows
                                        .filter((r) => r.count1 > 0 || r.count2 > 0)
                                        .map((r, i) => {
                                            const rawDelta = r.count1 - r.count2
                                            const pct =
                                                r.count2 > 0
                                                    ? Math.round((rawDelta / r.count2) * 100)
                                                    : r.count1 > 0
                                                      ? null
                                                      : 0
                                            const pctStr =
                                                pct === null ? '—' : (pct >= 0 ? '+' : '') + pct + '%'
                                            const rawStr = (rawDelta >= 0 ? '+' : '') + rawDelta
                                            const diffCell = `${pctStr} / [${rawStr}]`
                                            const dc =
                                                r.count2 > 0
                                                    ? pct! > 5
                                                        ? 'var(--green)'
                                                        : pct! < -5
                                                          ? 'var(--red)'
                                                          : 'var(--dim)'
                                                    : rawDelta > 5
                                                      ? 'var(--green)'
                                                      : rawDelta < -5
                                                        ? 'var(--red)'
                                                        : 'var(--dim)'
                                            const ft =
                                                r.first1 !== null &&
                                                r.first2 !== null &&
                                                Math.abs(r.first1 - r.first2) > 1.5
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
                                                    <td className={`${styles.td} ${styles.tdP1}`}>
                                                        {r.count1}
                                                    </td>
                                                    <td className={`${styles.td} ${styles.tdP2}`}>
                                                        {r.count2}
                                                    </td>
                                                    <td
                                                        className={`${styles.td} ${styles.tdDiff}`}
                                                        style={{ color: dc }}
                                                    >
                                                        {diffCell}
                                                    </td>
                                                    <td className={`${styles.td} ${styles.tdFirst}`}>
                                                        {ft && (
                                                            <>
                                                                <span className={styles.firstCastP1}>
                                                                    {r.first1}s
                                                                </span>{' '}
                                                                vs{' '}
                                                                <span className={styles.firstCastP2}>
                                                                    {r.first2}s
                                                                </span>
                                                            </>
                                                        )}
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
                        {(hasMetricSeriesData(p1data) || hasMetricSeriesData(p2data)) && (
                            <div className={styles.metricChartBlock}>
                                <ChartCard title="Output over time" height={300}>
                                    <MetricTimelineChart
                                        p1data={p1data}
                                        p2data={p2data}
                                        compareWindowSec={compareWindowSec ?? undefined}
                                    />
                                </ChartCard>
                            </div>
                        )}
                        <div className={styles.chartGridTwo}>
                            <ChartCard title="Spell usage — casts/min" height={240}>
                                <SpellUsageChart
                                    spellRows={effectiveSpellRows}
                                    name1={p1data.name}
                                    name2={p2data.name}
                                />
                            </ChartCard>
                            <ChartCard title="Cast rate over time (30s windows)" height={240}>
                                <CastTimelineChart
                                    p1data={p1data}
                                    p2data={p2data}
                                    compareWindowSec={compareWindowSec ?? undefined}
                                />
                            </ChartCard>
                        </div>
                    </CollapsibleSection>
                    <CollapsibleSection
                        title={
                            <>
                                <div className={ui.ptitleBar} />
                                Buff uptime & major cooldowns
                            </>
                        }
                    >
                        <div className={styles.chartGridTwo}>
                            <ChartCard title="Buff uptime %" height={200}>
                                <ProcEfficiencyChart p1data={p1data} p2data={p2data} />
                            </ChartCard>
                            <ChartCard
                                title="Major cooldowns (Blizzard CD length + usage vs partner)"
                                height={220}
                            >
                                <CooldownTimelineChart
                                    p1data={p1data}
                                    p2data={p2data}
                                    spellRows={effectiveSpellRows}
                                    compareWindowSec={compareWindowSec ?? undefined}
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
                                compareWindowSec={compareWindowSec ?? undefined}
                            />
                        </div>
                    </CollapsibleSection>
                </div>

                {talentDiff && (
                    <div className={ui.panel}>
                        <CollapsibleSection
                            title={
                                <>
                                    <div className={ui.ptitleBar} />
                                    Talent comparison
                                </>
                            }
                            rightSlot={
                                talentDiff.t1?.talentString && talentDiff.t2?.talentString ? (
                                    <Link
                                        href={`/compare?b1=${encodeURIComponent(talentDiff.t1.talentString)}&b2=${encodeURIComponent(talentDiff.t2.talentString)}&n1=${encodeURIComponent(talentDiff.name1)}&n2=${encodeURIComponent(talentDiff.name2)}`}
                                        className={`${ui.btnGhost} ${ui.btnGhostSm} ${ui.btnGhostLink}`}
                                        title="Open these two builds on the Talent compare tab"
                                    >
                                        Open in Talent compare
                                    </Link>
                                ) : talentDiff.specId &&
                                  (talentDiff.t1?.talentTree?.length ?? 0) > 0 &&
                                  (talentDiff.t2?.talentTree?.length ?? 0) > 0 ? (
                                    // No export strings in this log — the compare tab rebuilds both builds
                                    // from this fight's talent rows (in-memory Analyze snapshot).
                                    <Link
                                        href="/compare"
                                        className={`${ui.btnGhost} ${ui.btnGhostSm} ${ui.btnGhostLink}`}
                                        title="Open these two builds on the Talent compare tab"
                                    >
                                        Open in Talent compare
                                    </Link>
                                ) : undefined
                            }
                        >
                            {talentDiff.error && !talentDiff.t1 && !talentDiff.t2 ? (
                                <div className={styles.talentError}>
                                    Could not load talent data: {talentDiff.error}
                                </div>
                            ) : (
                                <TalentCompare
                                    p1Talents={talentDiff.t1}
                                    p2Talents={talentDiff.t2}
                                    name1={talentDiff.name1}
                                    name2={talentDiff.name2}
                                    specId={talentDiff.specId}
                                />
                            )}
                        </CollapsibleSection>
                    </div>
                )}

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
                            messagesCompare.length > 0 ? (
                                <CopyBtn
                                    text={messagesCompare
                                        .map((m) => `${m.role === 'user' ? 'You' : 'Claude'}:\n${m.content}`)
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
                                messages={messagesCompare}
                                input={inputCompare}
                                onInputChange={setInputCompare}
                                onSend={sendCompareQuestion}
                                aiLoading={aiLoading}
                                aiLiveStatus={aiLiveStatus}
                                inputPlaceholder="Ask about your pull vs the other player — cooldowns, rotation gaps, anything"
                                quickQuestions={
                                    <>
                                        {COMPARE_TOP_QUICK_ITEMS.map((item, idx) => {
                                            const disabled = aiLoading || !talentDiff
                                            return (
                                                <button
                                                    key={`${item.kind}-${idx}`}
                                                    type="button"
                                                    onClick={() => {
                                                        if (disabled) return
                                                        if (item.kind === 'initial')
                                                            startInitialCompareAnalysis()
                                                        else sendCompareQuestion(item.prompt)
                                                    }}
                                                    disabled={disabled}
                                                    title={
                                                        talentDiff
                                                            ? item.title
                                                            : 'Available once talent data has loaded'
                                                    }
                                                    className={ui.quickTile}
                                                >
                                                    {item.label}
                                                </button>
                                            )
                                        })}
                                        {(() => {
                                            const whOk = wowheadReferenceAvailableForSpec(talentDiff?.specId)
                                            const icyOk = icyVeinsReferenceAvailableForSpec(
                                                talentDiff?.specId,
                                            )
                                            const bothOk = whOk && icyOk
                                            return (
                                                <div className={styles.guideCluster}>
                                                    <div
                                                        className={styles.guideClusterLabel}
                                                        style={{ color: ROTATION_GUIDE_CLUSTER_LABEL_COLOR }}
                                                    >
                                                        {ROTATION_GUIDE_CLUSTER_LABEL}
                                                    </div>
                                                    <div className={styles.guideChipRow}>
                                                        <button
                                                            type="button"
                                                            disabled={aiLoading || !whOk}
                                                            title={
                                                                whOk
                                                                    ? 'Include Wowhead scraped rotation/talent text. Asks Claude to compare both players’ logs to that guide.'
                                                                    : 'Wowhead scraped bundle is not available for this spec yet.'
                                                            }
                                                            className={ui.guideChip}
                                                            onClick={() =>
                                                                sendCompareQuestion(
                                                                    PRESET_COMPARE_ROTATION_WOWHEAD,
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
                                                                    ? 'Include Icy Veins scraped rotation text. Asks Claude to compare both players’ logs to that guide.'
                                                                    : 'Icy Veins scraped bundle is not available for this spec yet.'
                                                            }
                                                            className={ui.guideChip}
                                                            onClick={() =>
                                                                sendCompareQuestion(
                                                                    PRESET_COMPARE_ROTATION_ICY,
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
                                                                    ? 'Include Wowhead and Icy Veins excerpts. Compares both players to both guides.'
                                                                    : 'Both requires Wowhead and Icy Veins data for this spec (e.g. Frost Mage).'
                                                            }
                                                            className={ui.guideChip}
                                                            onClick={() =>
                                                                sendCompareQuestion(
                                                                    PRESET_COMPARE_ROTATION_BOTH,
                                                                )
                                                            }
                                                        >
                                                            Both
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                        {PRESET_QUESTIONS_COMPARE.map((p, i) => {
                                            const { label, prompt } = resolvePresetPrompt(p)
                                            return (
                                                <button
                                                    key={`${i}-${label}`}
                                                    type="button"
                                                    onClick={() => sendCompareQuestion(prompt)}
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
    )
}

export default CompareFightView
