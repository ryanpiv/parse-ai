/**
 * TalentTree — renders a talent grid section with SVG connection lines.
 * Icons fetched server-side via /api/tooltip (avoids CORS, proper headers).
 * Diff states: p1=gold border, p2=blue border, both=no highlight, neither=dimmed.
 */
import { useEffect, useState } from 'react'

export type DiffState = 'p1' | 'p2' | 'both' | 'neither'

export interface BlizzardNode {
  nodeId: number
  row: number
  col: number
  type: string
  nodeType: string
  entries: { rank: number; spellId: number; name: string; description: string; maxRanks: number }[]
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
}

const NODE = 36
const GAP  = 6
const STEP = NODE + GAP

// Module-level icon cache: spellId → slug or '' (failed)
const iconCache: Record<number, string> = {}

function useSpellIcon(spellId: number): string | null {
  const [icon, setIcon] = useState<string | null>(
    spellId && iconCache[spellId] !== undefined ? (iconCache[spellId] || null) : null
  )

  useEffect(() => {
    if (!spellId) return
    if (iconCache[spellId] !== undefined) {
      setIcon(iconCache[spellId] || null)
      return
    }
    // Route through our server-side proxy — avoids CORS, has proper User-Agent
    fetch(`/api/tooltip?id=${spellId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        const slug: string = d.icon || ''
        iconCache[spellId] = slug
        setIcon(slug || null)
      })
      .catch(() => {
        iconCache[spellId] = ''
        setIcon(null)
      })
  }, [spellId])

  return icon ? `https://wow.zamimg.com/images/wow/icons/medium/${icon}.jpg` : null
}

function NodeIcon({ node, size }: { node: BlizzardNode; size: number }) {
  const entry = node.entries[0]
  const iconUrl = useSpellIcon(entry?.spellId ?? 0)
  const state = node.state ?? 'neither'
  const isChoice = node.nodeType === 'CHOICE' || node.entries.length > 1

  // both = selected by both players — normal/neutral look, no call-out
  // p1/p2 = only one player — colored border
  // neither = unselected — dim
  const style: Record<DiffState, { bg: string; border: string; glow: string; opacity: number; borderW: number }> = {
    both:    { bg: 'rgba(255,255,255,0.04)', border: 'rgba(160,170,185,0.55)', glow: 'none',                    opacity: 1,    borderW: 1.5 },
    p1:      { bg: 'rgba(201,162,39,0.18)',  border: 'rgba(201,162,39,1)',      glow: 'rgba(201,162,39,0.5)',    opacity: 1,    borderW: 2.5 },
    p2:      { bg: 'rgba(90,173,240,0.13)',  border: 'rgba(90,173,240,1)',      glow: 'rgba(90,173,240,0.45)',   opacity: 1,    borderW: 2.5 },
    neither: { bg: 'rgba(8,10,14,0.7)',      border: 'rgba(40,50,62,0.3)',      glow: 'none',                    opacity: 0.22, borderW: 1   },
  }
  const s = style[state]
  const radius = isChoice ? size / 2 : 5
  const name = entry?.name || `Node ${node.nodeId}`

  return (
    <div
      title={`${name}${node.rank && entry?.maxRanks && entry.maxRanks > 1 ? ` (${node.rank}/${entry.maxRanks})` : ''}`}
      data-wh-spell={entry?.spellId || undefined}
      data-wh-name={name}
      style={{
        width: size, height: size, borderRadius: radius,
        border: `${s.borderW}px solid ${s.border}`,
        background: s.bg,
        opacity: s.opacity,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'help', position: 'relative', overflow: 'hidden', flexShrink: 0,
        boxShadow: s.glow !== 'none' ? `0 0 7px ${s.glow}, inset 0 0 0 1px ${s.glow}` : 'none',
        transition: 'transform .1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.25)'; (e.currentTarget as HTMLElement).style.zIndex = '20' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)';    (e.currentTarget as HTMLElement).style.zIndex = '1'  }}
    >
      {iconUrl
        ? <img src={iconUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius - 1, display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : <span style={{ fontSize: 7, fontFamily: 'IBM Plex Mono,monospace', color: s.border, textAlign: 'center', padding: 1, fontWeight: 600, lineHeight: 1 }}>
            {name.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase()}
          </span>
      }
      {node.rank && node.rank > 0 && entry && entry.maxRanks > 1 && (
        <span style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.88)', color: '#ccc', fontSize: 7, padding: '0 2px', borderRadius: '2px 0 2px 0', lineHeight: '11px', fontFamily: 'IBM Plex Mono,monospace' }}>
          {node.rank}/{entry.maxRanks}
        </span>
      )}
    </div>
  )
}

export function TalentTreeSection({ nodes, edges, name1, name2 }: Props) {
  if (!nodes.length) return null

  const minRow = Math.min(...nodes.map(n => n.row))
  const minCol = Math.min(...nodes.map(n => n.col))
  const maxRow = Math.max(...nodes.map(n => n.row))
  const maxCol = Math.max(...nodes.map(n => n.col))

  const rows = maxRow - minRow + 1
  const cols = maxCol - minCol + 1
  const W = cols * STEP - GAP
  const H = rows * STEP - GAP

  const byId = new Map(nodes.map(n => [n.nodeId, n]))

  const nodePos = (n: BlizzardNode) => ({
    x: (n.col - minCol) * STEP + NODE / 2,
    y: (n.row - minRow) * STEP + NODE / 2,
  })

  const nodeIds = new Set(nodes.map(n => n.nodeId))
  const sectionEdges = edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))

  return (
    <div style={{ position: 'relative', width: W, height: H, flexShrink: 0 }}>
      <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        {sectionEdges.map((e, i) => {
          const from = byId.get(e.from)
          const to   = byId.get(e.to)
          if (!from || !to) return null
          const fp = nodePos(from)
          const tp = nodePos(to)
          // Color line by the "more specific" endpoint: prefer p1/p2 over both/neither
          const fromState = from.state ?? 'neither'
          const toState   = to.state   ?? 'neither'
          const lineState = (fromState === 'p1' || toState === 'p1') ? 'p1'
            : (fromState === 'p2' || toState === 'p2') ? 'p2'
            : fromState === 'both' || toState === 'both' ? 'both'
            : 'neither'
          const color = lineState === 'p1'      ? 'rgba(201,162,39,0.45)'
            : lineState === 'p2'                ? 'rgba(90,173,240,0.4)'
            : lineState === 'both'              ? 'rgba(120,130,145,0.35)'
            :                                     'rgba(40,50,62,0.2)'
          return <line key={i} x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y} stroke={color} strokeWidth={1.5} />
        })}
      </svg>

      {nodes.map(n => (
        <div key={n.nodeId} style={{
          position: 'absolute',
          left: (n.col - minCol) * STEP,
          top:  (n.row - minRow) * STEP,
        }}>
          <NodeIcon node={n} size={NODE} />
        </div>
      ))}
    </div>
  )
}
