/**
 * Full talent layout for compare **player 1** only (Raidbots-style: gold = taken, gray = not).
 * Ranks prefer saved WCL talent rows (same source as /compare), then the export string.
 * Optional ?preset=budget|max|none for synthetic fills (QA).
 *
 * Open: /talent-preview — uses remembered specId + player 1 string after you load a compare.
 * Or: /talent-preview?specId=64&preset=budget
 */
import Head from 'next/head'
import { useRouter, type NextRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { TalentTreeSection, type BlizzardNode } from '../components/TalentCompare/TalentTree'
import { SpellTooltipProvider } from '../components/TalentCompare/SpellTooltip'
import { uniformClassSpecTreeWidth } from '../components/TalentCompare/uniformClassSpecTreeWidth'
import { useBlizzardTalentTree } from '../components/TalentCompare'
import { useAppSession } from '../contexts/AppSessionContext'
import { allocateTalentRanks, maxRankForNode } from '../lib/talents/allocateSyntheticTalentRanks'
import { decodeTalentString, parseTalentStringHeader } from '../lib/talents/decodeTalentString'
import { apiNodesToTreeNodes } from '../lib/talents/apiNodesToTreeNodes'
import { heroTreeTitleLabel } from '../lib/talents/heroLabels'
import {
  parseP1TalentRowsJson,
  mergeDecodedNodesIntoSelectionMap,
  mergeP1RowsIntoSelectionMap,
} from '../lib/talents/p1TalentTreeSession'
import { partitionBlizzardTalentNodes } from '../lib/talents/partitionBlizzardTree'
import { applyRankMapAsRaidbotsP1, sumRanks } from '../lib/talents/raidbotsRankMap'
import { pa } from '../lib/styles'

const FONT = '"Avenir Next", Lato, "Helvetica Neue", Helvetica, sans-serif'
const BG = '#0e1015'
const TEXT = '#e8edf2'

const CANVAS_W = 1100
const COL_CLASS_W = 410
const COL_HERO_W  = 280
const COL_SPEC_W  = CANVAS_W - COL_CLASS_W - COL_HERO_W // 410
const COL_CLASS_CENTER = COL_CLASS_W / 2
const COL_HERO_CENTER  = COL_CLASS_W + COL_HERO_W / 2
const COL_SPEC_CENTER  = COL_CLASS_W + COL_HERO_W + COL_SPEC_W / 2

function presetModeFromQuery(q: NextRouter['query']): 'default' | 'none' | 'budget' | 'max' | 'session' {
  const raw = q.preset
  if (raw === undefined || raw === '') return 'default'
  const s = String(Array.isArray(raw) ? raw[0] : raw).toLowerCase()
  if (s === 'none' || s === 'budget' || s === 'max' || s === 'session') return s
  return 'budget'
}

export default function TalentPreviewPage() {
  const router = useRouter()
  const { hydrated, session } = useAppSession()
  const specFromQuery = router.query.specId ? parseInt(String(router.query.specId), 10) || 0 : 0
  const effectiveSpecId = specFromQuery || (hydrated ? session.specId ?? 0 : 0)
  const presetMode = presetModeFromQuery(router.query)
  const classCap = parseInt(String(router.query.classCap || '34'), 10) || 34
  const specCap = parseInt(String(router.query.specCap || '34'), 10) || 34
  const heroCap = parseInt(String(router.query.heroCap || '13'), 10) || 13
  const nodePx = parseInt(String(router.query.nodePx || '33'), 10) || 33

  const [copyOk, setCopyOk] = useState(false)

  const skipTreeFetch =
    !router.isReady || (!hydrated && !specFromQuery) || !effectiveSpecId

  const { tree, loading: treeLoading, error: treeFetchError } = useBlizzardTalentTree(
    effectiveSpecId,
    { skip: skipTreeFetch }
  )

  const loading = !router.isReady || (!hydrated && !specFromQuery) || treeLoading
  const noSpecMessage =
    router.isReady && hydrated && !specFromQuery && !effectiveSpecId
      ? 'No specialization id. Pass ?specId=… or load a fight on Analyze so we can remember your spec.'
      : null
  const error = noSpecMessage ?? treeFetchError

  const { classNodes, specNodes, heroBlocks, edges, usingSavedP1 } = useMemo(() => {
    if (!tree) {
      return {
        classNodes: [] as BlizzardNode[],
        specNodes: [] as BlizzardNode[],
        heroBlocks: [] as { key: string; label: string; nodes: BlizzardNode[] }[],
        edges: [] as { from: number; to: number }[],
        usingSavedP1: false,
      }
    }
    const all = tree.nodes as BlizzardNode[]
    const edges = tree.edges
    const heroTypes: string[] = tree.heroTypes || []
    const { classNodesStripped: classRaw, specNodesStripped: specRaw } =
      partitionBlizzardTalentNodes(all, heroTypes)

    const rankMapForNodes = (nodes: BlizzardNode[], sel: Map<number, number>) =>
      new Map(nodes.map(n => [n.nodeId, sel.get(n.nodeId) ?? 0]))

    let classR = new Map<number, number>()
    let specR = new Map<number, number>()
    const heroRs: Record<string, Map<number, number>> = {}

    const savedMatchesSpec =
      !!session.compareStr1 &&
      session.specId != null &&
      session.specId === effectiveSpecId
    /** Decode when session remembers spec OR export header matches this tree (specId is often null if talent fetch failed). */
    let exportHeaderMatchesTree = false
    const exportTrim = session.compareStr1?.trim()
    if (exportTrim && effectiveSpecId > 0) {
      try {
        exportHeaderMatchesTree = parseTalentStringHeader(exportTrim).specId === effectiveSpecId
      } catch {
        exportHeaderMatchesTree = false
      }
    }
    const useSavedExport =
      !!exportTrim &&
      (presetMode === 'session' ||
        (presetMode === 'default' && (savedMatchesSpec || exportHeaderMatchesTree)))

    let usingSavedP1 = false

    if (presetMode === 'none') {
      // leave empty
    } else if (presetMode === 'budget') {
      classR = allocateTalentRanks(classRaw, edges, classCap)
      specR = allocateTalentRanks(specRaw, edges, specCap)
      const primaryHero = heroTypes[0]
      if (primaryHero) {
        const heroNodes = all.filter((n: BlizzardNode) => n.type === primaryHero)
        heroRs[primaryHero] = allocateTalentRanks(heroNodes, edges, heroCap)
      }
    } else if (presetMode === 'max') {
      for (const n of all) {
        const mr = maxRankForNode(n)
        if (n.type === 'class') classR.set(n.nodeId, mr)
        else if (n.type === 'spec') specR.set(n.nodeId, mr)
        else if (n.type.startsWith('hero_')) {
          if (!heroRs[n.type]) heroRs[n.type] = new Map()
          heroRs[n.type]!.set(n.nodeId, mr)
        }
      }
    } else {
      // default | session — same nodeId→rank model as /compare (sel1): decode export, then overlay saved WCL rows.
      const sel1 = new Map<number, number>()
      let filledFromSaved = false
      if (useSavedExport && exportTrim) {
        try {
          const treeNodes = apiNodesToTreeNodes(
            tree.nodes as Array<{ nodeId: number; nodeType: string; entries: Array<{ maxRanks: number }> }>
          )
          const decoded = decodeTalentString(exportTrim, treeNodes)
          mergeDecodedNodesIntoSelectionMap(decoded.nodes, sel1)
          if (sel1.size > 0) {
            filledFromSaved = true
            usingSavedP1 = true
          }
        } catch {
          /* fall through to rows / budget */
        }
      }
      const p1Rows = parseP1TalentRowsJson(session.p1TalentTreeJson)
      if (p1Rows.length > 0) {
        mergeP1RowsIntoSelectionMap(p1Rows, sel1, all)
        filledFromSaved = true
        usingSavedP1 = true
      }
      if (!filledFromSaved) {
        classR = allocateTalentRanks(classRaw, edges, classCap)
        specR = allocateTalentRanks(specRaw, edges, specCap)
        const primaryHero = heroTypes[0]
        if (primaryHero) {
          const heroNodes = all.filter((n: BlizzardNode) => n.type === primaryHero)
          heroRs[primaryHero] = allocateTalentRanks(heroNodes, edges, heroCap)
        }
        const heroBlocks = heroTypes.map(ht => ({
          key: ht,
          label: heroTreeTitleLabel(ht),
          nodes: applyRankMapAsRaidbotsP1(
            all.filter((n: BlizzardNode) => n.type === ht),
            heroRs[ht] || new Map()
          ),
        }))
        return {
          classNodes: applyRankMapAsRaidbotsP1(classRaw, classR),
          specNodes: applyRankMapAsRaidbotsP1(specRaw, specR),
          heroBlocks,
          edges,
          usingSavedP1,
        }
      }

      const heroBlocks = heroTypes.map(ht => ({
        key: ht,
        label: heroTreeTitleLabel(ht),
        nodes: applyRankMapAsRaidbotsP1(
          all.filter((n: BlizzardNode) => n.type === ht),
          rankMapForNodes(all.filter((n: BlizzardNode) => n.type === ht), sel1)
        ),
      }))

      return {
        classNodes: applyRankMapAsRaidbotsP1(classRaw, rankMapForNodes(classRaw, sel1)),
        specNodes: applyRankMapAsRaidbotsP1(specRaw, rankMapForNodes(specRaw, sel1)),
        heroBlocks,
        edges,
        usingSavedP1,
      }
    }

    const heroBlocks = heroTypes.map(ht => ({
      key: ht,
      label: heroTreeTitleLabel(ht),
      nodes: applyRankMapAsRaidbotsP1(
        all.filter((n: BlizzardNode) => n.type === ht),
        heroRs[ht] || new Map()
      ),
    }))

    return {
      classNodes: applyRankMapAsRaidbotsP1(classRaw, classR),
      specNodes: applyRankMapAsRaidbotsP1(specRaw, specR),
      heroBlocks,
      edges,
      usingSavedP1,
    }
  }, [
    tree,
    presetMode,
    classCap,
    specCap,
    heroCap,
    session.compareStr1,
    session.p1TalentTreeJson,
    session.specId,
    effectiveSpecId,
  ])

  /**
   * Hero: same TalentTreeSection as class/spec — the hard part is *data*, not drawing.
   * WCL CombatantInfo usually lists class/spec node IDs; hero is often missing or uses other fields.
   * Export strings carry hero bits but must decode with the right spec/tree.
   * When we have ranks → show the subtree with the most points (your real hero tree).
   * When we have none → still render every API hero subtree as grey wireframes (like /compare), not a blank slot.
   */
  const heroView = useMemo(() => {
    if (!heroBlocks.length) return { mode: 'none' as const }
    let best = heroBlocks[0]
    let bestSum = sumRanks(best.nodes)
    for (let i = 1; i < heroBlocks.length; i++) {
      const s = sumRanks(heroBlocks[i].nodes)
      if (s > bestSum) {
        best = heroBlocks[i]
        bestSum = s
      }
    }
    if (bestSum > 0) return { mode: 'single' as const, block: best, hasRanks: true }
    return { mode: 'wireframeAll' as const, blocks: heroBlocks, hasRanks: false }
  }, [heroBlocks])

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''

  const copyLink = () => {
    if (!pageUrl) return
    void navigator.clipboard.writeText(pageUrl).then(() => {
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 2000)
    })
  }

  const RAIDBOTS_STEP = 55
  const uniformWidth = useMemo(
    () =>
      uniformClassSpecTreeWidth(
        classNodes,
        specNodes,
        nodePx,
        RAIDBOTS_STEP,
        Math.max(COL_CLASS_W, COL_SPEC_W) - 10
      ),
    [classNodes, specNodes, nodePx]
  )

  const classLabel = tree?.className || 'Class'
  const specLabel = tree?.specName || 'Spec'
  const p1Name = session.compareName1?.trim() || 'Player 1'

  const classHdr = usingSavedP1
    ? `${classLabel} · ${sumRanks(classNodes)}`
    : `${classLabel}: ${sumRanks(classNodes)} / ${classCap}`
  const specHdr = usingSavedP1
    ? `${specLabel} · ${sumRanks(specNodes)}`
    : `${specLabel}: ${sumRanks(specNodes)} / ${specCap}`
  const heroHdr =
    heroView.mode === 'single'
      ? usingSavedP1
        ? `${heroView.block.label} · ${sumRanks(heroView.block.nodes)}`
        : `${heroView.block.label}: ${sumRanks(heroView.block.nodes)} / ${heroCap}`
      : heroView.mode === 'wireframeAll'
        ? heroView.blocks.length > 1
          ? 'Hero trees · 0'
          : `${heroView.blocks[0].label} · 0`
        : 'Hero'

  return (
    <SpellTooltipProvider>
      <Head>
        <title>
          {usingSavedP1 ? `${p1Name} — talents — parse-ai` : `Talent preview — parse-ai`}
        </title>
      </Head>
      <div
        style={{
          minHeight: '100vh',
          background: BG,
          color: TEXT,
          padding: '24px 20px 48px',
          fontFamily: FONT,
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <h1
            style={{
              margin: '0 0 6px',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            {usingSavedP1 ? `${p1Name} — full talents` : 'Talent preview'}
          </h1>
          <p style={{ fontSize: 13, color: '#8899aa', margin: '0 0 16px', lineHeight: 1.5 }}>
            {usingSavedP1
              ? 'Compare player 1 only — uses WCL node rows when available (same as /compare), otherwise the saved export string.'
              : 'Synthetic or demo fill. Load a fight on Analyze or run Compare to save player 1 data, then open this page again — or set ?preset=budget.'}
          </p>
          <p style={{ fontSize: 11, color: '#556', marginBottom: 14, fontFamily: 'IBM Plex Mono, monospace' }}>
            specId={effectiveSpecId || '—'} · preset={presetMode}
            {hydrated && session.p1TalentTreeJson ? ' · session has WCL rows' : ''}
            {hydrated && session.compareStr1 ? ' · session has export string' : ''}
          </p>

          {loading && <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#667' }}>Loading tree…</p>}
          {error && <p style={{ color: '#e04040', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>{error}</p>}

          {!loading && !error && tree && (
            <>
              {/* Header row — fixed 1100px, labels centered over each column */}
              <div style={{ position: 'relative', width: CANVAS_W, height: 30, marginBottom: 4 }}>
                <HeaderSlot leftPx={COL_CLASS_CENTER} label={classHdr} />
                <HeaderSlot leftPx={COL_HERO_CENTER} label={heroHdr} />
                <HeaderSlot leftPx={COL_SPEC_CENTER} label={specHdr} />
              </div>

              {/* Tree columns — fixed widths matching Raidbots proportions */}
              <div style={{ display: 'flex', width: CANVAS_W, alignItems: 'flex-start' }}>
                <div style={{ width: COL_CLASS_W, display: 'flex', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {classNodes.length > 0 && (
                    <TalentTreeSection
                      nodes={classNodes}
                      edges={edges}
                      name1=""
                      name2=""
                      renderMode="raidbots"
                      nodePx={nodePx}
                      forceWidth={uniformWidth}
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
                      edges={edges}
                      name1=""
                      name2=""
                      renderMode="raidbots"
                      nodePx={nodePx}
                      maxWidth={COL_HERO_W - 10}
                    />
                  ) : heroView.mode === 'wireframeAll' ? (
                    <div style={{ width: '100%', padding: '0 4px' }}>
                      {heroView.blocks.map(hb => (
                        <div key={hb.key} style={{ marginBottom: 14 }}>
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: '#6a7580',
                              marginBottom: 6,
                              textAlign: 'center',
                            }}
                          >
                            {hb.label}
                          </div>
                          {hb.nodes.length > 0 ? (
                            <TalentTreeSection
                              nodes={hb.nodes}
                              edges={edges}
                              name1=""
                              name2=""
                              renderMode="raidbots"
                              nodePx={nodePx}
                              maxWidth={COL_HERO_W - 10}
                            />
                          ) : null}
                        </div>
                      ))}
                      <p
                        style={{
                          fontSize: 10,
                          color: '#5a6570',
                          lineHeight: 1.45,
                          margin: '8px 0 0',
                          textAlign: 'center',
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}
                      >
                        No hero ranks in saved data. WCL often omits hero node IDs; re-run Analyze or ensure the
                        export string matches this spec.
                      </p>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#888' }}>No hero tree</span>
                  )}
                </div>
                <div style={{ width: COL_SPEC_W, display: 'flex', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {specNodes.length > 0 && (
                    <TalentTreeSection
                      nodes={specNodes}
                      edges={edges}
                      name1=""
                      name2=""
                      renderMode="raidbots"
                      nodePx={nodePx}
                      forceWidth={uniformWidth}
                      forceGrid
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28, width: CANVAS_W }}>
                <button type="button" onClick={copyLink} className={pa.btnGold}>
                  {copyOk ? 'Copied' : 'Copy to clipboard'}
                </button>
              </div>
            </>
          )}
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
      <p
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          opacity: 0.88,
        }}
      >
        {label}
      </p>
    </div>
  )
}
