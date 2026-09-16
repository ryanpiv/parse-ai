/**
 * Raidbots-style full tree for a single build (gold = taken, gray = not) — same
 * three-column layout as /talent-preview. Ranks come from WCL-style rows
 * ({ nodeID, rank }) with an optional export string decode filling any gaps
 * (WCL often omits hero node IDs; the export string carries them).
 */
import { useMemo } from 'react'
import { TalentTreeSection, type BlizzardNode } from './TalentTree'
import { SpellTooltipProvider } from './SpellTooltip'
import { uniformClassSpecTreeWidth } from './uniformClassSpecTreeWidth'
import { useBlizzardTalentTree } from './useBlizzardTalentTree'
import { decodeTalentString } from '../../lib/talents/decodeTalentString'
import { apiNodesToTreeNodes } from '../../lib/talents/apiNodesToTreeNodes'
import { heroTreeTitleLabel } from '../../lib/talents/heroLabels'
import {
    mergeDecodedNodesIntoSelectionMap,
    mergeP1RowsIntoSelectionMap,
    type P1TalentRow,
} from '../../lib/talents/p1TalentTreeSession'
import { partitionBlizzardTalentNodes } from '../../lib/talents/partitionBlizzardTree'
import { applyRankMapAsRaidbotsP1, sumRanks } from '../../lib/talents/raidbotsRankMap'

const CANVAS_W = 1100
const COL_CLASS_W = 410
const COL_HERO_W = 280
const COL_SPEC_W = CANVAS_W - COL_CLASS_W - COL_HERO_W
const COL_CLASS_CENTER = COL_CLASS_W / 2
const COL_HERO_CENTER = COL_CLASS_W + COL_HERO_W / 2
const COL_SPEC_CENTER = COL_CLASS_W + COL_HERO_W + COL_SPEC_W / 2
const NODE_PX = 33
const RAIDBOTS_STEP = 55

interface Props {
    specId: number
    /** WCL-style rows for the build (nodeID/rank; spellId fallback supported). */
    rows: P1TalentRow[]
    /** Optional export string — decoded ranks fill nodes the rows miss (hero trees). */
    exportString?: string
}

export function FullTalentTree({ specId, rows, exportString }: Props) {
    const { tree, loading, error } = useBlizzardTalentTree(specId, { skip: !specId })

    const view = useMemo(() => {
        if (!tree) return null
        const all = tree.nodes as BlizzardNode[]
        const edges = tree.edges
        const heroTypes: string[] = tree.heroTypes || []
        const { classNodesStripped, specNodesStripped } = partitionBlizzardTalentNodes(all, heroTypes)

        const sel = new Map<number, number>()
        const ex = exportString?.trim()
        if (ex) {
            try {
                const treeNodes = apiNodesToTreeNodes(
                    tree.nodes as Array<{
                        nodeId: number
                        nodeType: string
                        entries: Array<{ maxRanks: number }>
                    }>,
                )
                const decoded = decodeTalentString(ex, treeNodes)
                mergeDecodedNodesIntoSelectionMap(decoded.nodes, sel)
            } catch {
                /* rows below still apply */
            }
        }
        mergeP1RowsIntoSelectionMap(rows, sel, all)

        const rankFor = (nodes: BlizzardNode[]) =>
            new Map(nodes.map((n) => [n.nodeId, sel.get(n.nodeId) ?? 0]))

        const classNodes = applyRankMapAsRaidbotsP1(classNodesStripped, rankFor(classNodesStripped))
        const specNodes = applyRankMapAsRaidbotsP1(specNodesStripped, rankFor(specNodesStripped))
        const heroBlocks = heroTypes.map((ht) => {
            const nodes = all.filter((n) => n.type === ht)
            return {
                key: ht,
                label: heroTreeTitleLabel(ht),
                nodes: applyRankMapAsRaidbotsP1(nodes, rankFor(nodes)),
            }
        })

        return { classNodes, specNodes, heroBlocks, edges }
    }, [tree, rows, exportString])

    const heroView = useMemo(() => {
        const blocks = view?.heroBlocks ?? []
        if (!blocks.length) return { mode: 'none' as const }
        let best = blocks[0]
        let bestSum = sumRanks(best.nodes)
        for (let i = 1; i < blocks.length; i++) {
            const s = sumRanks(blocks[i].nodes)
            if (s > bestSum) {
                best = blocks[i]
                bestSum = s
            }
        }
        if (bestSum > 0) return { mode: 'single' as const, block: best }
        return { mode: 'wireframeAll' as const, blocks }
    }, [view?.heroBlocks])

    const treeWidths = useMemo(
        () =>
            uniformClassSpecTreeWidth(
                view?.classNodes ?? [],
                view?.specNodes ?? [],
                NODE_PX,
                RAIDBOTS_STEP,
                Math.max(COL_CLASS_W, COL_SPEC_W) - 10,
            ),
        [view?.classNodes, view?.specNodes],
    )

    if (loading) {
        return (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--dim)' }}>Loading tree…</p>
        )
    }
    if (error) {
        return <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--red)' }}>{error}</p>
    }
    if (!tree || !view) return null

    const classHdr = `${tree.className || 'Class'} · ${sumRanks(view.classNodes)}`
    const specHdr = `${tree.specName || 'Spec'} · ${sumRanks(view.specNodes)}`
    const heroHdr =
        heroView.mode === 'single'
            ? `${heroView.block.label} · ${sumRanks(heroView.block.nodes)}`
            : heroView.mode === 'wireframeAll'
              ? heroView.blocks.length > 1
                  ? 'Hero trees · 0'
                  : `${heroView.blocks[0].label} · 0`
              : 'Hero'

    return (
        <SpellTooltipProvider>
            <div style={{ overflowX: 'auto' }}>
                <div style={{ position: 'relative', width: CANVAS_W, height: 30, marginBottom: 4 }}>
                    <HeaderSlot leftPx={COL_CLASS_CENTER} label={classHdr} />
                    <HeaderSlot leftPx={COL_HERO_CENTER} label={heroHdr} />
                    <HeaderSlot leftPx={COL_SPEC_CENTER} label={specHdr} />
                </div>

                <div style={{ display: 'flex', width: CANVAS_W, alignItems: 'flex-start' }}>
                    <div
                        style={{
                            width: COL_CLASS_W,
                            display: 'flex',
                            justifyContent: 'center',
                            flexShrink: 0,
                            overflow: 'hidden',
                        }}
                    >
                        {view.classNodes.length > 0 && (
                            <TalentTreeSection
                                nodes={view.classNodes}
                                edges={view.edges}
                                name1=""
                                name2=""
                                renderMode="raidbots"
                                nodePx={NODE_PX}
                                forceWidth={treeWidths.classWidth}
                                forceGrid
                            />
                        )}
                    </div>
                    <div
                        style={{
                            width: COL_HERO_W,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flexShrink: 0,
                            overflowX: 'hidden',
                            overflowY: 'auto',
                            maxHeight: 560,
                        }}
                    >
                        {heroView.mode === 'single' && heroView.block.nodes.length > 0 ? (
                            <TalentTreeSection
                                nodes={heroView.block.nodes}
                                edges={view.edges}
                                name1=""
                                name2=""
                                renderMode="raidbots"
                                nodePx={NODE_PX}
                                maxWidth={COL_HERO_W - 10}
                            />
                        ) : heroView.mode === 'wireframeAll' ? (
                            <div style={{ width: '100%', padding: '0 4px' }}>
                                {heroView.blocks.map((hb) => (
                                    <div key={hb.key} style={{ marginBottom: 14 }}>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 600,
                                                letterSpacing: '0.06em',
                                                textTransform: 'uppercase',
                                                color: 'var(--dim)',
                                                marginBottom: 6,
                                                textAlign: 'center',
                                            }}
                                        >
                                            {hb.label}
                                        </div>
                                        {hb.nodes.length > 0 ? (
                                            <TalentTreeSection
                                                nodes={hb.nodes}
                                                edges={view.edges}
                                                name1=""
                                                name2=""
                                                renderMode="raidbots"
                                                nodePx={NODE_PX}
                                                maxWidth={COL_HERO_W - 10}
                                            />
                                        ) : null}
                                    </div>
                                ))}
                                <p
                                    style={{
                                        fontSize: 10,
                                        color: 'var(--dim)',
                                        lineHeight: 1.45,
                                        margin: '8px 0 0',
                                        textAlign: 'center',
                                        fontFamily: 'var(--font-ui)',
                                    }}
                                >
                                    No hero ranks in this data. WCL often omits hero node IDs; export strings
                                    include them.
                                </p>
                            </div>
                        ) : (
                            <span style={{ fontSize: 12, color: 'var(--dim)' }}>No hero tree</span>
                        )}
                    </div>
                    <div
                        style={{
                            width: COL_SPEC_W,
                            display: 'flex',
                            justifyContent: 'center',
                            flexShrink: 0,
                            overflow: 'hidden',
                        }}
                    >
                        {view.specNodes.length > 0 && (
                            <TalentTreeSection
                                nodes={view.specNodes}
                                edges={view.edges}
                                name1=""
                                name2=""
                                renderMode="raidbots"
                                nodePx={NODE_PX}
                                forceWidth={treeWidths.specWidth}
                                forceGrid
                            />
                        )}
                    </div>
                </div>
            </div>
        </SpellTooltipProvider>
    )
}

function HeaderSlot({ leftPx, label }: { leftPx: number; label: string }) {
    return (
        <div
            style={{
                position: 'absolute',
                left: leftPx,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
            }}
        >
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, opacity: 0.88 }}>{label}</p>
        </div>
    )
}
