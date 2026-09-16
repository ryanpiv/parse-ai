import { useEffect, useMemo, useRef, useState } from 'react'
import { partitionBlizzardTalentNodes } from '../../lib/talents/partitionBlizzardTree'
import TalentTreeSection, { type BlizzardNode, type DiffState } from './TalentTree'
import { SpellTooltipProvider, useSpellTooltip } from './SpellTooltip'
import { uniformClassSpecTreeWidth } from './uniformClassSpecTreeWidth'
import { useBlizzardTalentTree } from './useBlizzardTalentTree'
import styles from './styles.module.css'

interface IWclTalent {
    id: number
    nodeID: number
    rank: number
}
interface ITalentData {
    name: string
    talentTree?: IWclTalent[]
    talents?: unknown[]
}

export type TalentCompareProps = {
    p1Talents: ITalentData | null
    p2Talents: ITalentData | null
    name1: string
    name2: string
    specId?: number
}

// Match FullTalentTree's raidbots sizing so the Compare and Single tree views render at the same scale.
const NODE_PX = 33
const STEP = 55
const MAX_TREE_W = 400
const HERO_TREE_W = 270
// Fixed chrome inside the scroll container: its own padding + per-section padding + flex gaps.
const CONTAINER_PAD = 40
const SECTION_PADS = 48
const SECTION_GAPS = 48
// TalentTreeSection renders LAYOUT_PAD (12px/side) *around* its forced width, so each of the
// three trees can exceed its nominal cap by up to 24px.
const TREE_LAYOUT_PADS = 72
// Headroom for scrollbars appearing after the measurement (classic reflow feedback loop).
const MEASURE_SLACK = 16

/**
 * Tree widths sized to the measured container so all three trees fit on one
 * row without horizontal scrolling on desktop. Clamps keep icons readable on
 * narrow windows (where the container falls back to scrolling).
 */
function fitTreeWidths(availW: number | null): { maxTree: number; heroW: number } {
    if (!availW) return { maxTree: MAX_TREE_W, heroW: HERO_TREE_W }
    const budget = availW - CONTAINER_PAD - SECTION_PADS - SECTION_GAPS - TREE_LAYOUT_PADS - MEASURE_SLACK
    const heroW = Math.min(HERO_TREE_W, Math.max(190, Math.round(budget * 0.24)))
    const maxTree = Math.min(MAX_TREE_W, Math.max(280, Math.floor((budget - heroW) / 2)))
    return { maxTree, heroW }
}

const TalentDiffLink = ({
    spellId,
    name,
    color,
}: {
    spellId: number
    name: string
    color: 'gold' | 'blue'
}) => {
    const { show, hide } = useSpellTooltip()
    const c = color === 'gold' ? { text: 'rgba(201,162,39,1)' } : { text: 'rgba(90,173,240,1)' }
    return (
        <a
            href={`https://www.wowhead.com/spell=${spellId}`}
            target="_blank"
            rel="noreferrer"
            className={styles.diffLink}
            style={{ color: c.text }}
            onMouseEnter={(e) => show(spellId, e.currentTarget.getBoundingClientRect(), name)}
            onMouseLeave={() => hide()}
        >
            {name}
        </a>
    )
}

const CircleSep = () => {
    return (
        <span aria-hidden className={styles.circleSepWrap}>
            <span className={styles.circleSepDot} />
        </span>
    )
}

/** "{name} only: N" followed by the differing talents on one wrapping row. */
const OnlyList = ({
    name,
    nodes,
    color,
}: {
    name: string
    nodes: BlizzardNode[]
    color: 'gold' | 'blue'
}) => {
    const headColor = color === 'gold' ? 'rgba(201,162,39,0.95)' : 'rgba(90,173,240,0.95)'
    return (
        <div className={styles.onlyList}>
            <span className={styles.onlyListHead} style={{ color: headColor }}>
                {name} only: <strong>{nodes.length}</strong>
            </span>
            {nodes.map((n) => (
                <span key={n.nodeId} className={styles.onlyListItem}>
                    <CircleSep />
                    {n.entries[0]?.spellId ? (
                        <TalentDiffLink
                            spellId={n.entries[0].spellId}
                            name={n.entries[0].name || `Node ${n.nodeId}`}
                            color={color}
                        />
                    ) : (
                        <span
                            className={styles.onlyListFallback}
                            style={{
                                color: color === 'gold' ? 'rgba(201,162,39,0.7)' : 'rgba(90,173,240,0.7)',
                            }}
                        >
                            {n.entries[0]?.name || `Node ${n.nodeId}`}
                        </span>
                    )}
                </span>
            ))}
        </div>
    )
}

function annotateDiff(
    nodes: BlizzardNode[],
    sel1: Map<number, number>,
    sel2: Map<number, number>,
): BlizzardNode[] {
    return nodes.map((n) => {
        const in1 = sel1.has(n.nodeId)
        const in2 = sel2.has(n.nodeId)
        const state: DiffState = in1 && in2 ? 'both' : in1 ? 'p1' : in2 ? 'p2' : 'neither'
        const rank = sel1.get(n.nodeId) ?? sel2.get(n.nodeId) ?? 0
        return { ...n, state, rank }
    })
}

const TalentCompare = ({ p1Talents, p2Talents, name1, name2, specId }: TalentCompareProps) => {
    const {
        tree: treeData,
        loading,
        error,
    } = useBlizzardTalentTree(specId ?? 0, {
        skip: !specId,
    })

    const scrollerRef = useRef<HTMLDivElement>(null)
    const [availW, setAvailW] = useState<number | null>(null)
    useEffect(() => {
        const el = scrollerRef.current
        if (!el) return
        const measure = () => setAvailW(el.clientWidth)
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [treeData, loading, error])

    // Build WCL selection maps: nodeId → rank (empty maps when both players missing — hooks below still run)
    const sel1 = new Map<number, number>()
    const sel2 = new Map<number, number>()
    ;(p1Talents?.talentTree || []).forEach((t: IWclTalent) => sel1.set(t.nodeID, t.rank))
    ;(p2Talents?.talentTree || []).forEach((t: IWclTalent) => sel2.set(t.nodeID, t.rank))

    const allNodes: BlizzardNode[] = treeData?.nodes || []
    const edges = treeData?.edges || []
    const allHeroTypes: string[] = treeData?.heroTypes || []
    const {
        classNodesStripped: classNodesBase,
        specNodesStripped: specNodesBase,
        heroNodesByType: heroNodesByTypeBase,
    } = partitionBlizzardTalentNodes(allNodes, allHeroTypes)

    const classNodes = annotateDiff(classNodesBase, sel1, sel2)
    const specNodes = annotateDiff(specNodesBase, sel1, sel2)
    const heroNodesByType: Record<string, BlizzardNode[]> = {}
    allHeroTypes.forEach((t) => {
        heroNodesByType[t] = annotateDiff(heroNodesByTypeBase[t], sel1, sel2)
    })
    const heroTypes = allHeroTypes.filter((t) => heroNodesByType[t].some((n) => n.state !== 'neither'))

    // Widths depend only on the tree layout + available space (not selections).
    const { maxTree, heroW } = fitTreeWidths(availW)
    const treeWidths = useMemo(
        () => uniformClassSpecTreeWidth(classNodes, specNodes, NODE_PX, STEP, maxTree),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [treeData, maxTree],
    )

    // Exclude subtree-selection meta-nodes (empty-entry CHOICE) from summary chips/counts.
    const allAnnotated = annotateDiff(
        allNodes.filter((n) => !(n.nodeType === 'CHOICE' && (!n.entries || n.entries.length === 0))),
        sel1,
        sel2,
    )
    const p1Only = allAnnotated.filter((n) => n.state === 'p1')
    const p2Only = allAnnotated.filter((n) => n.state === 'p2')
    const both = allAnnotated.filter((n) => n.state === 'both')

    if (!p1Talents && !p2Talents) {
        return <div className={styles.emptyNote}>Talent data not available.</div>
    }

    return (
        <SpellTooltipProvider>
            <div>
                {/* Diff summary — each player's unique talents, one per line */}
                <div className={styles.diffSummary}>
                    <div className={styles.sharedLine}>
                        Shared: <span className={styles.sharedCount}>{both.length}</span>
                    </div>
                    <OnlyList name={name1} nodes={p1Only} color="gold" />
                    <OnlyList name={name2} nodes={p2Only} color="blue" />
                </div>

                {loading && <div className={styles.treeLoading}>Loading talent tree...</div>}
                {error && <div className={styles.treeError}>Error: {error}</div>}

                {!loading && !error && treeData && (
                    <div ref={scrollerRef} className={styles.treeScroller}>
                        <div className={styles.treeRow}>
                            {classNodes.length > 0 && (
                                <div className={styles.treeCell}>
                                    <TalentTreeSection
                                        nodes={classNodes}
                                        edges={edges}
                                        name1={name1}
                                        name2={name2}
                                        nodePx={NODE_PX}
                                        stepPx={STEP}
                                        forceWidth={treeWidths.classWidth}
                                        forceGrid
                                    />
                                </div>
                            )}

                            {heroTypes.map((ht) => (
                                <div key={ht} className={styles.treeCell}>
                                    <TalentTreeSection
                                        nodes={heroNodesByType[ht] || []}
                                        edges={edges}
                                        name1={name1}
                                        name2={name2}
                                        nodePx={NODE_PX}
                                        stepPx={STEP}
                                        maxWidth={heroW}
                                    />
                                </div>
                            ))}

                            {specNodes.length > 0 && (
                                <div className={styles.treeCell}>
                                    <TalentTreeSection
                                        nodes={specNodes}
                                        edges={edges}
                                        name1={name1}
                                        name2={name2}
                                        nodePx={NODE_PX}
                                        stepPx={STEP}
                                        forceWidth={treeWidths.specWidth}
                                        forceGrid
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Legend */}
                {!loading && treeData && (
                    <div className={styles.legend}>
                        {[
                            {
                                bg: 'rgba(255,255,255,0.07)',
                                border: 'rgba(175,186,202,0.85)',
                                w: 1,
                                label: 'both',
                            },
                            { bg: 'rgba(201,162,39,0.42)', border: '#f0d060', w: 3, label: `${name1} only` },
                            { bg: 'rgba(90,173,240,0.38)', border: '#9fd6ff', w: 3, label: `${name2} only` },
                            {
                                bg: 'rgba(8,10,14,0.82)',
                                border: 'rgba(38,44,54,0.65)',
                                w: 1,
                                label: 'neither',
                                dim: true,
                            },
                        ].map((l) => (
                            <span
                                key={l.label}
                                className={styles.legendItem}
                                style={{ opacity: l.dim ? 0.5 : 1 }}
                            >
                                <span
                                    className={styles.legendSwatch}
                                    style={{
                                        background: l.bg,
                                        border: `${l.w}px solid ${l.border}`,
                                    }}
                                />
                                {l.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </SpellTooltipProvider>
    )
}

export default TalentCompare
