/**
 * TalentTree — renders a talent grid section with SVG connection lines.
 * Icons fetched server-side via /api/tooltip (avoids CORS, proper headers).
 * Diff states: p1/p2 = thick multi-ring outlines; both = thin neutral border; neither = dimmed.
 */
import { useEffect, useState, useCallback } from 'react'
import { useSpellTooltip } from './SpellTooltip'

export type DiffState = 'p1' | 'p2' | 'both' | 'neither'

/** diff = compare two players (gold/blue). raidbots = single build, gold active / gray inactive. */
export type TalentTreeRenderMode = 'diff' | 'raidbots'

export interface BlizzardNode {
  nodeId: number
  row: number
  col: number
  rawX: number | null
  rawY: number | null
  type: string
  nodeType: string
  entries: { rank: number; spellId: number; talentId: number; name: string; description: string; maxRanks: number }[]
  unlocks: number[]
  // set during diff
  state?: DiffState
  rank?: number
}

interface Props {
  nodes: BlizzardNode[]
  edges: { from: number; to: number }[]
  name1: string
  name2: string
  renderMode?: TalentTreeRenderMode
  /** Icon box size in px (Raidbots uses ~33). */
  nodePx?: number
  /** Center-to-center distance between adjacent nodes (px). Raidbots ≈ 55. */
  stepPx?: number
  /** If set, CSS-scale the tree to fit within this width (px). */
  maxWidth?: number
  /** Force the tree to exactly this width (CSS scale up or down). */
  forceWidth?: number
  /** Skip raw_position_x/y and use the grid (display_row/col) layout. */
  forceGrid?: boolean
}

const DEFAULT_NODE = 36
const DEFAULT_STEP = 42   // 36 + 6
const RAIDBOTS_STEP = 55  // 33 + 22  (matches Raidbots spacing)
/** Space around the node grid so diff outlines / hover scale are not clipped. */
const LAYOUT_PAD = 12

// Module-level icon cache: "s:id" / "t:id" → slug or '' (failed)
const iconCache: Record<string, string> = {}

async function fetchIconSlug(id: number, type: 'spell' | 'talent'): Promise<string> {
  const k = type === 'spell' ? `s:${id}` : `t:${id}`
  if (iconCache[k] !== undefined) return iconCache[k]
  try {
    const q = type === 'spell' ? `/api/tooltip?id=${id}` : `/api/tooltip?id=${id}&type=talent`
    const r = await fetch(q)
    if (!r.ok) throw new Error(String(r.status))
    const d = await r.json()
    const slug: string = d.icon || ''
    iconCache[k] = slug
    return slug
  } catch {
    iconCache[k] = ''
    return ''
  }
}

function useEntryIcon(spellId: number, talentId = 0): string | null {
  const [icon, setIcon] = useState<string | null>(() => {
    if (spellId > 0 && iconCache[`s:${spellId}`] !== undefined) return iconCache[`s:${spellId}`] ? `https://wow.zamimg.com/images/wow/icons/medium/${iconCache[`s:${spellId}`]}.jpg` : null
    if (spellId <= 0 && talentId > 0 && iconCache[`t:${talentId}`] !== undefined)
      return iconCache[`t:${talentId}`] ? `https://wow.zamimg.com/images/wow/icons/medium/${iconCache[`t:${talentId}`]}.jpg` : null
    return null
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (spellId > 0) {
        const slug = await fetchIconSlug(spellId, 'spell')
        if (!cancelled && slug) {
          setIcon(`https://wow.zamimg.com/images/wow/icons/medium/${slug}.jpg`)
          return
        }
      }
      if (talentId > 0) {
        const slug = await fetchIconSlug(talentId, 'talent')
        if (!cancelled && slug) {
          setIcon(`https://wow.zamimg.com/images/wow/icons/medium/${slug}.jpg`)
          return
        }
      }
      if (!cancelled) setIcon(null)
    })()
    return () => {
      cancelled = true
    }
  }, [spellId, talentId])

  return icon
}

/** Picks the rank-matching or first entry with spell/talent ids (multi-rank nodes vary by API row). */
function primaryEntryForSingleNode(node: BlizzardNode): BlizzardNode['entries'][number] | undefined {
  const entries = node.entries
  if (!entries.length) return undefined
  const rank = node.rank ?? 0
  const maxR = entries[0]?.maxRanks ?? 1
  const hasKey = (e: (typeof entries)[number]) => e.spellId > 0 || e.talentId > 0
  if (rank <= 0 || maxR <= 1) {
    return entries.find(hasKey) ?? entries[0]
  }
  const byRank = entries.find(e => e.rank === rank && hasKey(e))
  if (byRank) return byRank
  const idx = Math.min(Math.max(0, rank - 1), entries.length - 1)
  const atIdx = entries[idx]
  if (atIdx && hasKey(atIdx)) return atIdx
  return entries.find(hasKey) ?? entries[0]
}

function NodeIcon({ node, size, renderMode }: { node: BlizzardNode; size: number; renderMode: TalentTreeRenderMode }) {
  const state = node.state ?? 'neither'
  const isChoice = node.nodeType === 'CHOICE'
  const rank = node.rank ?? 0
  const active = rank > 0

  /** Diff mode: stacked 0-blur rings (no glow) so edges stay sharp and are not clipped */
  const diffStyle: Record<DiffState, { bg: string; border: string; opacity: number; borderWidth: number; boxShadow: string }> = {
    both: {
      bg: 'rgba(255,255,255,0.07)',
      border: 'rgba(175,186,202,0.85)',
      opacity: 1,
      borderWidth: 1,
      boxShadow: '0 0 0 1px rgba(100,110,128,0.35)',
    },
    p1: {
      bg: 'rgba(201,162,39,0.36)',
      border: '#fff0a0',
      opacity: 1,
      borderWidth: 2,
      boxShadow: '0 0 0 1px #120a00, 0 0 0 3px #c89400, 0 0 0 5px #fff6c8',
    },
    p2: {
      bg: 'rgba(65,145,225,0.38)',
      border: '#d0efff',
      opacity: 1,
      borderWidth: 2,
      boxShadow: '0 0 0 1px #040c18, 0 0 0 3px #2088d8, 0 0 0 5px #b8e4ff',
    },
    neither: {
      bg: 'rgba(8,10,14,0.82)',
      border: 'rgba(42,48,58,0.9)',
      opacity: 0.36,
      borderWidth: 1,
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.55)',
    },
  }

  const raidbotsActive = {
    bg: 'rgb(255, 209, 0)',
    border: 'rgb(255, 209, 0)',
    glow: 'none',
    opacity: 1 as number,
  }
  const raidbotsInactive = {
    bg: '#333',
    border: '#555',
    glow: 'none',
    opacity: 0.7,
  }

  const s = renderMode === 'raidbots'
    ? (active ? raidbotsActive : raidbotsInactive)
    : diffStyle[state]

  // For CHOICE nodes: octagon shape via clip-path; for regular: square with small radius
  const clipPath = isChoice
    ? 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
    : undefined
  const borderRadius = isChoice ? 0 : 4

  const containerStyle: React.CSSProperties = renderMode === 'raidbots'
    ? {
        width: size, height: size,
        borderRadius,
        clipPath,
        border: `2px solid ${(s as typeof raidbotsActive).border}`,
        background: (s as typeof raidbotsActive).bg,
        opacity: (s as typeof raidbotsActive).opacity,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'help', position: 'relative', overflow: 'hidden', flexShrink: 0,
        boxShadow: (s as typeof raidbotsActive).glow !== 'none' ? `0 0 7px ${(s as typeof raidbotsActive).glow}, inset 0 0 0 1px ${(s as typeof raidbotsActive).glow}` : 'none',
        transition: 'transform .1s',
      }
    : {
        width: size, height: size,
        borderRadius,
        clipPath,
        border: `${(s as (typeof diffStyle)['p1']).borderWidth}px solid ${(s as (typeof diffStyle)['p1']).border}`,
        background: (s as (typeof diffStyle)['p1']).bg,
        opacity: (s as (typeof diffStyle)['p1']).opacity,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'help', position: 'relative', overflow: 'visible', flexShrink: 0,
        boxShadow: (s as (typeof diffStyle)['p1']).boxShadow,
        transition: 'transform .1s',
      }

  if (isChoice) {
    return <ChoiceNodeIcon node={node} size={size} containerStyle={containerStyle} s={s} renderMode={renderMode} active={active} />
  }

  return <SingleNodeIcon node={node} size={size} containerStyle={containerStyle} s={s} borderRadius={borderRadius} renderMode={renderMode} active={active} />
}

function SingleNodeIcon({ node, size, containerStyle, s, borderRadius, renderMode, active }: {
  node: BlizzardNode; size: number
  containerStyle: React.CSSProperties
  s: { bg: string; border: string; opacity: number }
  borderRadius: number
  renderMode: TalentTreeRenderMode
  active: boolean
}) {
  const entry = primaryEntryForSingleNode(node)
  const iconUrl = useEntryIcon(entry?.spellId ?? 0, entry?.talentId ?? 0)
  const name = entry?.name || `Node ${node.nodeId}`
  const maxR = entry?.maxRanks ?? 1
  const cur = node.rank ?? 0
  const imgFilter = renderMode === 'raidbots' && !active ? 'grayscale(1) brightness(0.92)' : undefined
  const inner = Math.max(2, size - 4)
  const { show, hide } = useSpellTooltip()

  const onEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    if (renderMode === 'raidbots') {
      el.style.transform = 'scale(1.25)'
      el.style.zIndex = '20'
      el.style.outline = ''
      el.style.outlineOffset = ''
    } else {
      el.style.transform = ''
      el.style.zIndex = '30'
      el.style.outline = '2px solid rgba(232,205,112,0.55)'
      el.style.outlineOffset = '2px'
    }
    const sid = entry?.spellId ?? 0
    const tid = entry?.talentId ?? 0
    if (sid > 0 || tid > 0) {
      const desc = (entry?.description || '').trim()
      show(sid, el.getBoundingClientRect(), name, {
        description: desc || undefined,
        talentId: tid > 0 ? tid : undefined,
      })
    }
  }, [entry?.spellId, entry?.talentId, entry?.description, name, renderMode, show])

  const onLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    el.style.transform = 'scale(1)'
    el.style.zIndex = '1'
    el.style.outline = 'none'
    el.style.outlineOffset = ''
    hide()
  }, [hide])

  return (
    <div
      title={
        !entry?.spellId && !entry?.talentId
          ? `${name}${maxR > 1 || renderMode === 'raidbots' ? ` (${cur}/${maxR})` : ''}`
          : undefined
      }
      data-wh-spell={entry?.spellId || undefined}
      style={containerStyle}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {iconUrl
        ? <img src={iconUrl} alt={name} style={{ width: inner, height: inner, objectFit: 'cover', borderRadius: Math.max(0, borderRadius - 1), display: 'block', filter: imgFilter }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : <span style={{ fontSize: 7, fontFamily: 'IBM Plex Mono,monospace', color: s.border, textAlign: 'center', padding: 1, fontWeight: 600, lineHeight: 1 }}>
            {name.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase()}
          </span>
      }
      {(renderMode === 'raidbots' || (node.rank && node.rank > 0 && entry && entry.maxRanks > 1)) && (
        <span style={{ position: 'absolute', right: -4, bottom: -4, background: 'rgb(0,0,0)', color: '#fff', fontSize: 10.85, fontFamily: 'Tahoma, sans-serif', paddingLeft: 2, paddingRight: 2, pointerEvents: 'none', lineHeight: 1.2 }}>
          {renderMode === 'raidbots' ? `${cur}/${maxR}` : `${node.rank}/${entry!.maxRanks}`}
        </span>
      )}
    </div>
  )
}

function ChoiceNodeIcon({ node, size, containerStyle, s, renderMode, active }: {
  node: BlizzardNode; size: number
  containerStyle: React.CSSProperties
  s: { bg: string; border: string; opacity: number }
  renderMode: TalentTreeRenderMode
  active: boolean
}) {
  const e0 = node.entries[0]
  const e1 = node.entries[1]
  const icon0 = useEntryIcon(e0?.spellId ?? 0, e0?.talentId ?? 0)
  const icon1 = useEntryIcon(e1?.spellId ?? 0, e1?.talentId ?? 0)
  const name0 = e0?.name || 'Choice A'
  const name1 = e1?.name || 'Choice B'
  const maxR = e0?.maxRanks ?? 2
  const cur = node.rank ?? 0
  const imgFilter = renderMode === 'raidbots' && !active ? 'grayscale(1) brightness(0.92)' : undefined
  const { show, hide } = useSpellTooltip()

  const selectedSpellId = node.rank ? (node.rank === 1 ? e0?.spellId : e1?.spellId) : e0?.spellId
  const selectedTalentId = node.rank ? (node.rank === 1 ? e0?.talentId : e1?.talentId) : e0?.talentId
  const sid = selectedSpellId ?? 0
  const tid = selectedTalentId ?? 0
  const fallbackTitle = node.rank
    ? `${node.rank === 1 ? name0 : name1}`
    : `${name0} / ${name1}`

  const onEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    if (renderMode === 'raidbots') {
      el.style.transform = 'scale(1.25)'
      el.style.zIndex = '20'
      el.style.outline = ''
      el.style.outlineOffset = ''
    } else {
      el.style.transform = ''
      el.style.zIndex = '30'
      el.style.outline = '2px solid rgba(232,205,112,0.55)'
      el.style.outlineOffset = '2px'
    }
    if (sid > 0 || tid > 0) {
      const metaEntry = node.rank === 2 ? e1 : e0
      const desc = (metaEntry?.description || '').trim()
      show(sid, el.getBoundingClientRect(), fallbackTitle, {
        description: desc || undefined,
        talentId: tid > 0 ? tid : undefined,
      })
    }
  }, [sid, tid, fallbackTitle, renderMode, show, node.rank, e0?.description, e1?.description])

  const onLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    el.style.transform = 'scale(1)'
    el.style.zIndex = '1'
    el.style.outline = 'none'
    el.style.outlineOffset = ''
    hide()
  }, [hide])

  return (
    <div
      title={sid <= 0 && tid <= 0 ? fallbackTitle : undefined}
      style={containerStyle}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Split display: left half = choice 0, right half = choice 1 */}
      <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
        <div style={{ width: '50%', height: '100%', overflow: 'hidden', position: 'relative' }}>
          {icon0
            ? <img src={icon0} alt={name0} style={{ width: size, height: '100%', objectFit: 'cover', objectPosition: 'left center', display: 'block', filter: imgFilter }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <span style={{ fontSize: 6, fontFamily: 'IBM Plex Mono,monospace', color: s.border, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 600 }}>
                {name0.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
          }
        </div>
        <div style={{ width: '50%', height: '100%', overflow: 'hidden', position: 'relative', borderLeft: `1px solid ${s.border}` }}>
          {icon1
            ? <img src={icon1} alt={name1} style={{ width: size, height: '100%', objectFit: 'cover', objectPosition: 'right center', display: 'block', marginLeft: '-50%', filter: imgFilter }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <span style={{ fontSize: 6, fontFamily: 'IBM Plex Mono,monospace', color: s.border, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 600 }}>
                {name1.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
          }
        </div>
      </div>
      {renderMode === 'raidbots' && (
        <span style={{ position: 'absolute', right: -4, bottom: -4, background: 'rgb(0,0,0)', color: '#fff', fontSize: 10.85, fontFamily: 'Tahoma, sans-serif', paddingLeft: 2, paddingRight: 2, pointerEvents: 'none', lineHeight: 1.2 }}>
          {cur}/{maxR}
        </span>
      )}
    </div>
  )
}

/**
 * computeLayout — positions talent nodes in pixel space.
 *
 * Two modes:
 *  • grid (default, or forceGrid): uses display_row/display_col with `step` px spacing.
 *    Reliable and predictable — produces correct diamond shapes.
 *  • raw: uses raw_position_x/y, calibrated against the grid to derive the pixel scale.
 *    More accurate to in-game layout but depends on correct Blizzard data.
 */
export function computeLayout(
  nodes: BlizzardNode[],
  nodePx: number,
  step: number,
  forceGrid = false
): { px: Map<number, { x: number; y: number }>; W: number; H: number } {
  const hasRaw = !forceGrid && nodes.some(n => n.rawX != null && n.rawY != null)

  if (hasRaw) {
    const rawXs = nodes.map(n => n.rawX ?? 0)
    const rawYs = nodes.map(n => n.rawY ?? 0)
    const minRX = Math.min(...rawXs)
    const minRY = Math.min(...rawYs)
    const maxRX = Math.max(...rawXs)
    const maxRY = Math.max(...rawYs)
    const rangeX = maxRX - minRX
    const rangeY = maxRY - minRY

    const rowRange = Math.max(...nodes.map(n => n.row)) - Math.min(...nodes.map(n => n.row))
    const colRange = Math.max(...nodes.map(n => n.col)) - Math.min(...nodes.map(n => n.col))
    const rawPerStepY = rowRange > 0 && rangeY > 0 ? rangeY / rowRange : 0
    const rawPerStepX = colRange > 0 && rangeX > 0 ? rangeX / colRange : 0
    const rawPerStep = rawPerStepY > 0 && rawPerStepX > 0
      ? (rawPerStepX + rawPerStepY) / 2
      : rawPerStepY || rawPerStepX || 100
    const scale = step / rawPerStep

    const px = new Map<number, { x: number; y: number }>()
    for (const n of nodes) {
      px.set(n.nodeId, {
        x: Math.round(((n.rawX ?? minRX) - minRX) * scale),
        y: Math.round(((n.rawY ?? minRY) - minRY) * scale),
      })
    }

    const W = Math.round(rangeX * scale) + nodePx
    const H = Math.round(rangeY * scale) + nodePx
    return { px, W, H }
  }

  // Grid layout from display_row / display_col
  const minRow = Math.min(...nodes.map(n => n.row))
  const minCol = Math.min(...nodes.map(n => n.col))
  const maxRow = Math.max(...nodes.map(n => n.row))
  const maxCol = Math.max(...nodes.map(n => n.col))

  const px = new Map<number, { x: number; y: number }>()
  for (const n of nodes) {
    px.set(n.nodeId, {
      x: (n.col - minCol) * step,
      y: (n.row - minRow) * step,
    })
  }
  const W = (maxCol - minCol) * step + nodePx
  const H = (maxRow - minRow) * step + nodePx
  return { px, W, H }
}

/** True if this node is part of player 1’s taken build (ranked + p1 or shared). */
function nodeTakenByP1(n: BlizzardNode): boolean {
  const r = n.rank ?? 0
  if (r <= 0) return false
  const s = n.state ?? 'neither'
  return s === 'p1' || s === 'both'
}

/** True if this node is part of player 2’s taken build (ranked + p2 or shared). */
function nodeTakenByP2(n: BlizzardNode): boolean {
  const r = n.rank ?? 0
  if (r <= 0) return false
  const s = n.state ?? 'neither'
  return s === 'p2' || s === 'both'
}

export function TalentTreeSection({ nodes, edges, name1, name2, renderMode = 'diff', nodePx, stepPx, maxWidth, forceWidth, forceGrid }: Props) {
  if (!nodes.length) return null

  const NODE = nodePx ?? DEFAULT_NODE
  const step = stepPx ?? (renderMode === 'raidbots' ? RAIDBOTS_STEP : DEFAULT_STEP)
  const { px, W, H } = computeLayout(nodes, NODE, step, forceGrid)

  const scale = forceWidth ? forceWidth / W : maxWidth && W > maxWidth ? maxWidth / W : 1
  const paddedW = W + 2 * LAYOUT_PAD
  const paddedH = H + 2 * LAYOUT_PAD
  const displayW = Math.round(paddedW * scale)
  const displayH = Math.round(paddedH * scale)

  const byId = new Map(nodes.map(n => [n.nodeId, n]))

  const nodeCenter = (n: BlizzardNode) => {
    const p = px.get(n.nodeId)!
    return { x: p.x + NODE / 2, y: p.y + NODE / 2 }
  }

  const nodeIds = new Set(nodes.map(n => n.nodeId))
  const sectionEdges = edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))

  const innerCore = (
    <div style={{ position: 'relative', width: W, height: H, flexShrink: 0 }}>
      <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: renderMode === 'raidbots' ? 5 : undefined }}>
        {sectionEdges.map((e, i) => {
          const from = byId.get(e.from)
          const to   = byId.get(e.to)
          if (!from || !to) return null
          const fp = nodeCenter(from)
          const tp = nodeCenter(to)
          if (renderMode === 'raidbots') {
            const fr = from.rank ?? 0
            const tr = to.rank ?? 0
            const gold = fr > 0 && tr > 0
            return (
              <line
                key={i}
                x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
                stroke={gold ? '#ffd100' : '#434343'}
                strokeWidth={gold ? 2 : 1.25}
                strokeOpacity={gold ? 0.6 : 0.85}
              />
            )
          }
          // Only tint an edge when *both* ends are taken by that player — avoids blue/yellow
          // “paths” through dead nodes (e.g. Spellsteal → 0-rank filler → Time Manipulation).
          const p1Edge = nodeTakenByP1(from) && nodeTakenByP1(to)
          const p2Edge = nodeTakenByP2(from) && nodeTakenByP2(to)
          const lineState: DiffState =
            p1Edge && p2Edge ? 'both'
            : p1Edge ? 'p1'
            : p2Edge ? 'p2'
            : 'neither'
          const color = lineState === 'p1'  ? '#e8b020'
            : lineState === 'p2'            ? '#4cb0f0'
            : lineState === 'both'          ? 'rgba(140,152,168,0.45)'
            :                                 'rgba(40,50,62,0.25)'
          const sw = lineState === 'p1' || lineState === 'p2' ? 3.5 : lineState === 'both' ? 1.35 : 1.25
          return <line key={i} x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        })}
      </svg>

      {nodes.map(n => {
        const p = px.get(n.nodeId)!
        const st = n.state ?? 'neither'
        const zDiff = renderMode === 'diff' && (st === 'p1' || st === 'p2') ? 8 : undefined
        const wrapZ = zDiff ?? (renderMode === 'raidbots' ? 6 : 1)
        return (
          <div
            key={n.nodeId}
            style={{ position: 'absolute', left: p.x, top: p.y, zIndex: wrapZ }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLDivElement).style.zIndex = '10050'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLDivElement).style.zIndex = String(wrapZ)
            }}
          >
            <NodeIcon node={n} size={NODE} renderMode={renderMode} />
          </div>
        )
      })}
    </div>
  )

  const inner = (
    <div
      style={{
        position: 'relative',
        width: paddedW,
        height: paddedH,
        flexShrink: 0,
        overflow: 'visible',
      }}
    >
      <div style={{ position: 'absolute', left: LAYOUT_PAD, top: LAYOUT_PAD, width: W, height: H, overflow: 'visible' }}>
        {innerCore}
      </div>
    </div>
  )

  if (scale !== 1) {
    return (
      <div style={{ width: displayW, height: displayH, flexShrink: 0, overflow: 'visible' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {inner}
        </div>
      </div>
    )
  }

  return inner
}
