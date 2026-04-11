/**
 * Dev / QA page: Raidbots-style single-build talent view (light chrome).
 * Open: /talent-preview?specId=64&preset=budget
 *
 * preset:
 *   none   — no ranks (mostly gray)
 *   budget — fill ranks in row order until class/spec/hero caps (default)
 *   max    — every node at max rank (stress test; totals may exceed caps)
 */
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { TalentTreeSection, computeLayout, type BlizzardNode } from '../components/TalentCompare/TalentTree'
import { SpellTooltipProvider } from '../components/TalentCompare/SpellTooltip'

type TreePayload = {
  nodes: BlizzardNode[]
  edges: { from: number; to: number }[]
  heroTypes: string[]
  className: string | null
  specName: string | null
}

function maxRankForNode(n: BlizzardNode): number {
  if (n.nodeType === 'CHOICE') return 1
  return n.entries[0]?.maxRanks ?? 1
}

/** Spend points in row-major order; only rank up a node when every parent in-section has at least 1 rank. */
function allocateTalentRanks(
  nodes: BlizzardNode[],
  edges: { from: number; to: number }[],
  budget: number
): Map<number, number> {
  const ids = new Set(nodes.map(n => n.nodeId))
  const parents = new Map<number, number[]>()
  for (const n of nodes) parents.set(n.nodeId, [])
  for (const e of edges) {
    if (ids.has(e.from) && ids.has(e.to)) parents.get(e.to)!.push(e.from)
  }

  const sorted = [...nodes].sort((a, b) => a.row - b.row || a.col - b.col || a.nodeId - b.nodeId)
  const rank = new Map<number, number>()
  let spent = 0

  let progress = true
  while (progress && spent < budget) {
    progress = false
    for (const n of sorted) {
      if (spent >= budget) break
      const ps = parents.get(n.nodeId) || []
      if (ps.length && ps.some(p => (rank.get(p) ?? 0) < 1)) continue

      const cur = rank.get(n.nodeId) ?? 0
      const cap = maxRankForNode(n)
      if (cur >= cap) continue

      const add = Math.min(cap - cur, budget - spent)
      if (add <= 0) continue
      rank.set(n.nodeId, cur + add)
      spent += add
      progress = true
    }
  }
  return rank
}

function sumRanks(nodes: BlizzardNode[]): number {
  return nodes.reduce((s, n) => s + (n.rank ?? 0), 0)
}

function applyRanks(nodes: BlizzardNode[], r: Map<number, number>): BlizzardNode[] {
  return nodes.map(n => ({
    ...n,
    rank: r.has(n.nodeId) ? r.get(n.nodeId)! : 0,
    state: (r.get(n.nodeId) ?? 0) > 0 ? 'p1' as const : 'neither' as const,
  }))
}

/**
 * Strip nodes whose display_col is a statistical outlier — e.g. a single node
 * at col 11 when every other node sits in cols 0-6. This happens when the
 * Blizzard API leaks cross-tree gate/link nodes into class_talent_nodes.
 */
function stripColOutliers(nodes: BlizzardNode[]): BlizzardNode[] {
  if (nodes.length < 5) return nodes
  const uniq = [...new Set(nodes.map(n => n.col))].sort((a, b) => a - b)
  if (uniq.length < 3) return nodes

  const secondLast = uniq[uniq.length - 2]
  const last = uniq[uniq.length - 1]
  const typicalStep = (secondLast - uniq[0]) / (uniq.length - 2)
  if (last - secondLast > typicalStep * 3) {
    return nodes.filter(n => n.col <= secondLast)
  }

  const first = uniq[0]
  const second = uniq[1]
  const typicalStepHi = (uniq[uniq.length - 1] - second) / (uniq.length - 2)
  if (second - first > typicalStepHi * 3) {
    return nodes.filter(n => n.col >= second)
  }

  return nodes
}

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

export default function TalentPreviewPage() {
  const router = useRouter()
  const specId = parseInt(String(router.query.specId || '64'), 10) || 64
  const preset = String(router.query.preset || 'budget')
  const classCap = parseInt(String(router.query.classCap || '34'), 10) || 34
  const specCap = parseInt(String(router.query.specCap || '34'), 10) || 34
  const heroCap = parseInt(String(router.query.heroCap || '13'), 10) || 13
  const nodePx = parseInt(String(router.query.nodePx || '33'), 10) || 33

  const [tree, setTree] = useState<TreePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copyOk, setCopyOk] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    setLoading(true)
    setError(null)
    fetch(`/api/blizzard-tree?specId=${specId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setTree(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [router.isReady, specId])

  const { classNodes, specNodes, heroBlocks, edges } = useMemo(() => {
    if (!tree) {
      return { classNodes: [] as BlizzardNode[], specNodes: [] as BlizzardNode[], heroBlocks: [] as { key: string; label: string; nodes: BlizzardNode[] }[], edges: [] as { from: number; to: number }[] }
    }
    const all = tree.nodes as BlizzardNode[]
    const edges = tree.edges
    const heroTypes: string[] = tree.heroTypes || []

    // Blizzard's spec_talent_nodes can include hero tree nodes — deduplicate
    const heroNodeIds = new Set(
      all.filter(n => n.type.startsWith('hero_')).map(n => n.nodeId)
    )
    const classRaw = stripColOutliers(all.filter(n => n.type === 'class' && !heroNodeIds.has(n.nodeId)))
    const specRaw = stripColOutliers(all.filter(n => n.type === 'spec' && !heroNodeIds.has(n.nodeId)))

    let classR = new Map<number, number>()
    let specR = new Map<number, number>()
    const heroRs: Record<string, Map<number, number>> = {}

    if (preset === 'none') {
      // leave empty
    } else if (preset === 'max') {
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
      classR = allocateTalentRanks(classRaw, edges, classCap)
      specR = allocateTalentRanks(specRaw, edges, specCap)
      const primaryHero = heroTypes[0]
      if (primaryHero) {
        const heroNodes = all.filter((n: BlizzardNode) => n.type === primaryHero)
        heroRs[primaryHero] = allocateTalentRanks(heroNodes, edges, heroCap)
      }
    }

    const heroBlocks = heroTypes.map(ht => ({
      key: ht,
      label: ht.replace(/^hero_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      nodes: applyRanks(
        all.filter((n: BlizzardNode) => n.type === ht),
        heroRs[ht] || new Map()
      ),
    }))

    return {
      classNodes: applyRanks(classRaw, classR),
      specNodes: applyRanks(specRaw, specR),
      heroBlocks,
      edges,
    }
  }, [tree, preset, classCap, specCap, heroCap])

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''

  const copyLink = () => {
    if (!pageUrl) return
    void navigator.clipboard.writeText(pageUrl).then(() => {
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 2000)
    })
  }

  const RAIDBOTS_STEP = 55
  const uniformWidth = useMemo(() => {
    if (!classNodes.length && !specNodes.length) return undefined
    const classW = classNodes.length ? computeLayout(classNodes, nodePx, RAIDBOTS_STEP, true).W : 0
    const specW = specNodes.length ? computeLayout(specNodes, nodePx, RAIDBOTS_STEP, true).W : 0
    const maxNatural = Math.max(classW, specW)
    const colMax = Math.max(COL_CLASS_W, COL_SPEC_W) - 10
    return Math.min(maxNatural, colMax)
  }, [classNodes, specNodes, nodePx])

  const classLabel = tree?.className || 'Class'
  const specLabel = tree?.specName || 'Spec'

  return (
    <SpellTooltipProvider>
      <Head>
        <title>Talent preview — parse-ai</title>
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
          <p style={{ fontSize: 12, color: '#556', marginBottom: 12, fontFamily: 'IBM Plex Mono, monospace' }}>
            /talent-preview &nbsp; specId={specId} &nbsp; preset={preset}
          </p>

          {loading && <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#667' }}>Loading tree…</p>}
          {error && <p style={{ color: '#e04040', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>{error}</p>}

          {!loading && !error && tree && (
            <>
              {/* Header row — fixed 1100px, labels centered over each column */}
              <div style={{ position: 'relative', width: CANVAS_W, height: 30, marginBottom: 4 }}>
                <HeaderSlot leftPx={COL_CLASS_CENTER} label={`${classLabel}: ${sumRanks(classNodes)} / ${classCap}`} />
                <HeaderSlot leftPx={COL_HERO_CENTER} label={heroBlocks[0] ? `${heroBlocks[0].label}: ${sumRanks(heroBlocks[0].nodes)} / ${heroCap}` : 'Hero'} />
                <HeaderSlot leftPx={COL_SPEC_CENTER} label={`${specLabel}: ${sumRanks(specNodes)} / ${specCap}`} />
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
                <div style={{ width: COL_HERO_W, display: 'flex', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {heroBlocks[0]?.nodes.length ? (
                    <TalentTreeSection
                      nodes={heroBlocks[0].nodes}
                      edges={edges}
                      name1=""
                      name2=""
                      renderMode="raidbots"
                      nodePx={nodePx}
                      maxWidth={COL_HERO_W - 10}
                    />
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
                <button
                  type="button"
                  onClick={copyLink}
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '10px 22px',
                    background: '#444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                >
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
