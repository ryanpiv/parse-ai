import { useMemo } from 'react'
import { heroTreeShortLabel } from '../../lib/talents/heroLabels'
import { partitionBlizzardTalentNodes } from '../../lib/talents/partitionBlizzardTree'
import { TalentTreeSection, type BlizzardNode, type DiffState } from './TalentTree'
import { SpellTooltipProvider } from './SpellTooltip'
import { uniformClassSpecTreeWidth } from './uniformClassSpecTreeWidth'
import { useBlizzardTalentTree } from './useBlizzardTalentTree'
import { useSpellTooltip } from './SpellTooltip'

interface WCLTalent { id: number; nodeID: number; rank: number }
interface TalentData { name: string; talentTree?: WCLTalent[]; talents?: any[] }

interface Props {
  p1Talents: TalentData | null
  p2Talents: TalentData | null
  name1: string
  name2: string
  specId?: number
}

const LABEL: React.CSSProperties = {
  fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600,
  letterSpacing: '.8px', textTransform: 'uppercase',
  color: 'var(--dim,#4a5a6a)', marginBottom: 8,
}

const NODE_PX = 28
const STEP = 42
const MAX_TREE_W = 340

function TalentDiffLink({ spellId, name, color }: { spellId: number; name: string; color: 'gold' | 'blue' }) {
  const { show, hide } = useSpellTooltip()
  const c = color === 'gold'
    ? { text: 'rgba(201,162,39,1)', border: 'rgba(201,162,39,0.4)' }
    : { text: 'rgba(90,173,240,1)', border: 'rgba(90,173,240,0.4)' }
  return (
    <a
      href={`https://www.wowhead.com/spell=${spellId}`}
      target="_blank"
      rel="noreferrer"
      style={{
        fontFamily: 'IBM Plex Mono,monospace',
        fontSize: 11,
        color: c.text,
        textDecoration: 'none',
        borderBottom: `1px dotted ${c.border}`,
        cursor: 'help',
      }}
      onMouseEnter={e => show(spellId, e.currentTarget.getBoundingClientRect(), name)}
      onMouseLeave={() => hide()}
    >
      {name}
    </a>
  )
}

function annotateDiff(nodes: BlizzardNode[], sel1: Map<number, number>, sel2: Map<number, number>): BlizzardNode[] {
  return nodes.map(n => {
    const in1 = sel1.has(n.nodeId)
    const in2 = sel2.has(n.nodeId)
    const state: DiffState = in1 && in2 ? 'both' : in1 ? 'p1' : in2 ? 'p2' : 'neither'
    const rank = sel1.get(n.nodeId) ?? sel2.get(n.nodeId) ?? 0
    return { ...n, state, rank }
  })
}

export function TalentCompare({ p1Talents, p2Talents, name1, name2, specId }: Props) {
  const { tree: treeData, loading, error } = useBlizzardTalentTree(specId ?? 0, {
    skip: !specId,
  })

  // Build WCL selection maps: nodeId → rank (empty maps when both players missing — hooks below still run)
  const sel1 = new Map<number, number>()
  const sel2 = new Map<number, number>()
  ;(p1Talents?.talentTree || []).forEach((t: WCLTalent) => sel1.set(t.nodeID, t.rank))
  ;(p2Talents?.talentTree || []).forEach((t: WCLTalent) => sel2.set(t.nodeID, t.rank))

  const allNodes: BlizzardNode[] = treeData?.nodes || []
  const edges = treeData?.edges || []
  const allHeroTypes: string[] = treeData?.heroTypes || []
  const { classNodesStripped: classNodesBase, specNodesStripped: specNodesBase, heroNodesByType: heroNodesByTypeBase } =
    partitionBlizzardTalentNodes(allNodes, allHeroTypes)

  const classNodes = annotateDiff(classNodesBase, sel1, sel2)
  const specNodes = annotateDiff(specNodesBase, sel1, sel2)
  const heroNodesByType: Record<string, BlizzardNode[]> = {}
  allHeroTypes.forEach(t => {
    heroNodesByType[t] = annotateDiff(heroNodesByTypeBase[t], sel1, sel2)
  })
  const heroTypes = allHeroTypes.filter(t => heroNodesByType[t].some(n => n.state !== 'neither'))

  const uniformWidth = useMemo(
    () => uniformClassSpecTreeWidth(classNodes, specNodes, NODE_PX, STEP, MAX_TREE_W),
    [classNodes, specNodes]
  )

  const allAnnotated = annotateDiff(allNodes, sel1, sel2)
  const p1Only = allAnnotated.filter(n => n.state === 'p1')
  const p2Only = allAnnotated.filter(n => n.state === 'p2')
  const both   = allAnnotated.filter(n => n.state === 'both')

  const className = treeData?.className || ''
  const specName  = treeData?.specName  || ''

  if (!p1Talents && !p2Talents) {
    return (
      <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--dim,#4a5a6a)' }}>
        Talent data not available.
      </div>
    )
  }

  return (
    <SpellTooltipProvider>
    <div>
      {/* Diff summary */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--dim,#4a5a6a)' }}>Shared: <span style={{ color: 'var(--text,#e8edf2)' }}>{both.length}</span></span>
          <span style={{ color: 'rgba(201,162,39,0.9)' }}>{name1} only: <strong>{p1Only.length}</strong></span>
          <span style={{ color: 'rgba(90,173,240,0.8)' }}>{name2} only: <strong>{p2Only.length}</strong></span>
        </div>

        {/* Inline diff lists */}
        {(p1Only.length > 0 || p2Only.length > 0) && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', flex: 1 }}>
            {p1Only.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: 'rgba(201,162,39,0.7)', flexShrink: 0 }}>{name1}:</span>
                {p1Only.map(n => n.entries[0]?.spellId ? (
                  <TalentDiffLink key={n.nodeId} spellId={n.entries[0].spellId} name={n.entries[0].name || `Node ${n.nodeId}`} color="gold" />
                ) : (
                  <span key={n.nodeId} style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'rgba(201,162,39,0.7)' }}>{n.entries[0]?.name || `Node ${n.nodeId}`}</span>
                ))}
              </div>
            )}
            {p2Only.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: 'rgba(90,173,240,0.7)', flexShrink: 0 }}>{name2}:</span>
                {p2Only.map(n => n.entries[0]?.spellId ? (
                  <TalentDiffLink key={n.nodeId} spellId={n.entries[0].spellId} name={n.entries[0].name || `Node ${n.nodeId}`} color="blue" />
                ) : (
                  <span key={n.nodeId} style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'rgba(90,173,240,0.7)' }}>{n.entries[0]?.name || `Node ${n.nodeId}`}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'var(--dim,#4a5a6a)', padding: '20px 0' }}>
          Loading talent tree...
        </div>
      )}
      {error && (
        <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'var(--red,#d44040)', padding: '8px 0' }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && treeData && (
        <div
          style={{
            width: '100%',
            overflowX: 'auto',
            overflowY: 'visible',
            padding: '8px 20px 24px',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              alignItems: 'flex-start',
              gap: 24,
              textAlign: 'left',
              verticalAlign: 'top',
            }}
          >
            {classNodes.length > 0 && (
              <div style={{ flexShrink: 0, padding: '0 8px', overflow: 'visible' }}>
                <div style={LABEL}>{className ? `Class — ${className}` : 'Class'}</div>
                <TalentTreeSection nodes={classNodes} edges={edges} name1={name1} name2={name2} nodePx={NODE_PX} stepPx={STEP} forceWidth={uniformWidth} forceGrid />
              </div>
            )}

            {heroTypes.map(ht => (
              <div key={ht} style={{ flexShrink: 0, padding: '0 8px', overflow: 'visible' }}>
                <div style={LABEL}>{heroTreeShortLabel(ht)}</div>
                <TalentTreeSection nodes={heroNodesByType[ht] || []} edges={edges} name1={name1} name2={name2} nodePx={NODE_PX} stepPx={STEP} maxWidth={200} />
              </div>
            ))}

            {specNodes.length > 0 && (
              <div style={{ flexShrink: 0, padding: '0 8px', overflow: 'visible' }}>
                <div style={LABEL}>{specName ? `Spec — ${specName}` : 'Spec'}</div>
                <TalentTreeSection nodes={specNodes} edges={edges} name1={name1} name2={name2} nodePx={NODE_PX} stepPx={STEP} forceWidth={uniformWidth} forceGrid />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      {!loading && treeData && (
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: 'var(--dim,#4a5a6a)', flexWrap: 'wrap' }}>
          {[
            { bg: 'rgba(255,255,255,0.07)', border: 'rgba(175,186,202,0.85)', w: 1, label: 'both' },
            { bg: 'rgba(201,162,39,0.42)', border: '#f0d060', w: 3, label: `${name1} only` },
            { bg: 'rgba(90,173,240,0.38)', border: '#9fd6ff', w: 3, label: `${name2} only` },
            { bg: 'rgba(8,10,14,0.82)', border: 'rgba(38,44,54,0.65)', w: 1, label: 'neither', dim: true },
          ].map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: l.dim ? 0.5 : 1 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: l.bg,
                  border: `${l.w}px solid ${l.border}`,
                  display: 'inline-block',
                  boxSizing: 'border-box',
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
