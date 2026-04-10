/**
 * TalentTree — renders a talent grid section as SVG.
 * Icons from Wowhead CDN (spell ID → icon slug via tooltip API, cached).
 * Connection lines from Blizzard's `unlocks` edges.
 * 3 color states: gold=p1 only, blue=p2 only, green=both, dim=neither.
 */
import { useEffect, useRef, useState } from 'react'

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
  colOffset?: number  // subtract from col so grid starts at 0
}

const NODE  = 36
const GAP   = 6
const STEP  = NODE + GAP

// Icon cache: spellId → icon slug
const iconCache: Record<number, string> = {}

function useSpellIcon(spellId: number): string | null {
  const [icon, setIcon] = useState<string | null>(iconCache[spellId] ?? null)
  useEffect(() => {
    if (!spellId || iconCache[spellId] !== undefined) {
      setIcon(iconCache[spellId] ?? null)
      return
    }
    fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}?dataEnv=11&locale=0`)
      .then(r => r.json())
      .then(d => {
        const slug = d.icon || null
        iconCache[spellId] = slug
        setIcon(slug)
      })
      .catch(() => { iconCache[spellId] = ''; setIcon(null) })
  }, [spellId])
  return icon ? `https://wow.zamimg.com/images/wow/icons/medium/${icon}.jpg` : null
}

function NodeIcon({ node, size }: { node: BlizzardNode; size: number }) {
  const entry = node.entries[0]
  const iconUrl = useSpellIcon(entry?.spellId ?? 0)
  const state = node.state || 'neither'
  const isChoice = node.nodeType === 'CHOICE' || node.entries.length > 1

  const colors = {
    p1:      { bg: 'rgba(201,162,39,0.2)',  border: 'rgba(201,162,39,1)',   glow: 'rgba(201,162,39,0.4)' },
    p2:      { bg: 'rgba(90,173,240,0.15)', border: 'rgba(90,173,240,1)',   glow: 'rgba(90,173,240,0.4)' },
    both:    { bg: 'rgba(29,158,117,0.2)',  border: 'rgba(29,158,117,0.8)', glow: 'rgba(29,158,117,0.3)' },
    neither: { bg: 'rgba(10,12,15,0.8)',    border: 'rgba(42,51,64,0.4)',   glow: 'transparent' },
  }
  const c = colors[state]
  const opacity = state === 'neither' ? 0.35 : 1
  const borderW = (state === 'p1' || state === 'p2') ? 2 : 1.5
  const radius = isChoice ? size / 2 : 5

  const name = entry?.name || `Node ${node.nodeId}`

  return (
    <div
      title={`${name}${node.rank ? ` (${node.rank}/${entry?.maxRanks})` : ''}`}
      data-wh-spell={entry?.spellId || undefined}
      data-wh-name={name}
      style={{
        width: size, height: size, borderRadius: radius,
        border: `${borderW}px solid ${c.border}`,
        background: c.bg, opacity,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'help', position: 'relative', overflow: 'hidden', flexShrink: 0,
        boxShadow: state !== 'neither' ? `0 0 8px ${c.glow}` : 'none',
        transition: 'transform .1s, box-shadow .1s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'scale(1.25)'
        el.style.zIndex = '20'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'scale(1)'
        el.style.zIndex = '1'
      }}
    >
      {iconUrl
        ? <img src={iconUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius - 2, display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : <span style={{ fontSize: 7, fontFamily: 'IBM Plex Mono,monospace', color: c.border, textAlign: 'center', padding: 1, fontWeight: 600 }}>
            {name.split(' ').map((w: string) => w[0]).join('').slice(0, 3)}
          </span>
      }
      {/* Rank badge */}
      {node.rank && node.rank > 0 && entry && entry.maxRanks > 1 && (
        <span style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.85)', color: '#ccc', fontSize: 7, padding: '0 2px', borderRadius: '2px 0 2px 0', lineHeight: '11px', fontFamily: 'IBM Plex Mono,monospace' }}>
          {node.rank}/{entry.maxRanks}
        </span>
      )}
    </div>
  )
}

export function TalentTreeSection({ nodes, edges, name1, name2, colOffset = 0 }: Props) {
  if (!nodes.length) return null

  const minRow = Math.min(...nodes.map(n => n.row))
  const minCol = Math.min(...nodes.map(n => n.col)) - (colOffset || 0)
  const maxRow = Math.max(...nodes.map(n => n.row))
  const maxCol = Math.max(...nodes.map(n => n.col)) - (colOffset || 0)

  const rows = maxRow - minRow + 1
  const cols = maxCol - minCol + 1
  const W = cols * STEP - GAP
  const H = rows * STEP - GAP

  // Build position lookup
  const byId = new Map(nodes.map(n => [n.nodeId, n]))
  const nodePos = (n: BlizzardNode) => ({
    x: (n.col - Math.min(...nodes.map(x => x.col))) * STEP + NODE / 2,
    y: (n.row - minRow) * STEP + NODE / 2,
  })

  // Filter edges to only ones where both nodes exist in this section
  const nodeIds = new Set(nodes.map(n => n.nodeId))
  const sectionEdges = edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))

  return (
    <div style={{ position: 'relative', width: W, height: H, flexShrink: 0 }}>
      {/* SVG connection lines */}
      <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        {sectionEdges.map((e, i) => {
          const from = byId.get(e.from)
          const to   = byId.get(e.to)
          if (!from || !to) return null
          const fp = nodePos(from)
          const tp = nodePos(to)
          const state = from.state || 'neither'
          const color = state === 'p1' ? 'rgba(201,162,39,0.35)'
            : state === 'p2' ? 'rgba(90,173,240,0.3)'
            : state === 'both' ? 'rgba(29,158,117,0.3)'
            : 'rgba(42,51,64,0.25)'
          return <line key={i} x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y} stroke={color} strokeWidth={1.5} />
        })}
      </svg>

      {/* Nodes */}
      {nodes.map(n => {
        const relCol = n.col - Math.min(...nodes.map(x => x.col))
        const relRow = n.row - minRow
        return (
          <div key={n.nodeId} style={{
            position: 'absolute',
            left: relCol * STEP,
            top:  relRow * STEP,
          }}>
            <NodeIcon node={n} size={NODE} />
          </div>
        )
      })}
    </div>
  )
}
