import { useState, useEffect } from 'react'
import { TalentTreeSection, type BlizzardNode, type DiffState } from './TalentTree'

interface WCLTalent { id: number; nodeID: number; rank: number }
interface TalentData { name: string; talentTree?: WCLTalent[]; talents?: any[] }

interface Props {
  p1Talents: TalentData | null
  p2Talents: TalentData | null
  name1: string
  name2: string
  treeLayout?: any
  specId?: number
}

const LABEL: React.CSSProperties = {
  fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600,
  letterSpacing: '.8px', textTransform: 'uppercase',
  color: 'var(--dim,#4a5a6a)', marginBottom: 8,
}

function TalentLink({ spellId, name, color }: { spellId: number; name: string; color: 'gold' | 'blue' }) {
  const c = color === 'gold'
    ? { text: 'rgba(201,162,39,1)', border: 'rgba(201,162,39,0.4)' }
    : { text: 'rgba(90,173,240,1)', border: 'rgba(90,173,240,0.4)' }
  return (
    <a href={`https://www.wowhead.com/spell=${spellId}`} target="_blank" rel="noreferrer"
      data-wh-spell={spellId} data-wh-name={name}
      style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: c.text,
        textDecoration: 'none', borderBottom: `1px dotted ${c.border}`, cursor: 'help' }}>
      {name}
    </a>
  )
}

export function TalentCompare({ p1Talents, p2Talents, name1, name2, specId }: Props) {
  const [treeData, setTreeData] = useState<any>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    setTreeData(null)
    setError(null)
    setLoading(true)
    fetch(`/api/blizzard-tree?specId=${specId || 64}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setTreeData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [specId])

  if (!p1Talents && !p2Talents) return (
    <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--dim,#4a5a6a)' }}>
      Talent data not available.
    </div>
  )

  // Build WCL selection maps: nodeId → rank
  const sel1 = new Map<number, number>()
  const sel2 = new Map<number, number>()
  ;(p1Talents?.talentTree || []).forEach((t: WCLTalent) => sel1.set(t.nodeID, t.rank))
  ;(p2Talents?.talentTree || []).forEach((t: WCLTalent) => sel2.set(t.nodeID, t.rank))

  function annotate(nodes: BlizzardNode[]): BlizzardNode[] {
    return nodes.map(n => {
      const in1 = sel1.has(n.nodeId), in2 = sel2.has(n.nodeId)
      const state: DiffState = in1 && in2 ? 'both' : in1 ? 'p1' : in2 ? 'p2' : 'neither'
      return { ...n, state, rank: sel1.get(n.nodeId) ?? sel2.get(n.nodeId) }
    })
  }

  const allNodes: BlizzardNode[] = treeData?.nodes || []
  const edges = treeData?.edges || []
  const classNodes = annotate(allNodes.filter((n: BlizzardNode) => n.type === 'class'))
  const specNodes  = annotate(allNodes.filter((n: BlizzardNode) => n.type === 'spec'))
  const allHeroTypes: string[] = treeData?.heroTypes || []
  const heroNodesByType: Record<string, BlizzardNode[]> = {}
  allHeroTypes.forEach(t => { heroNodesByType[t] = annotate(allNodes.filter((n: BlizzardNode) => n.type === t)) })
  // Only show hero trees where at least one player has a node selected
  const heroTypes = allHeroTypes.filter(t => heroNodesByType[t].some(n => n.state !== 'neither'))

  // Diff stats
  const allAnnotated = annotate(allNodes)
  const p1Only = allAnnotated.filter(n => n.state === 'p1')
  const p2Only = allAnnotated.filter(n => n.state === 'p2')
  const both   = allAnnotated.filter(n => n.state === 'both')

  const className = treeData?.className || ''
  const specName  = treeData?.specName  || ''

  return (
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
                  <TalentLink key={n.nodeId} spellId={n.entries[0].spellId} name={n.entries[0].name || `Node ${n.nodeId}`} color="gold" />
                ) : (
                  <span key={n.nodeId} style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'rgba(201,162,39,0.7)' }}>{n.entries[0]?.name || `Node ${n.nodeId}`}</span>
                ))}
              </div>
            )}
            {p2Only.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: 'rgba(90,173,240,0.7)', flexShrink: 0 }}>{name2}:</span>
                {p2Only.map(n => n.entries[0]?.spellId ? (
                  <TalentLink key={n.nodeId} spellId={n.entries[0].spellId} name={n.entries[0].name || `Node ${n.nodeId}`} color="blue" />
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

      {/* All trees side by side */}
      {!loading && !error && treeData && (
        <div style={{ display: 'flex', gap: 28, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
          {/* Class tree */}
          {classNodes.length > 0 && (
            <div style={{ flexShrink: 0 }}>
              <div style={LABEL}>{className ? `Class — ${className}` : 'Class'}</div>
              <TalentTreeSection nodes={classNodes} edges={edges} name1={name1} name2={name2} />
            </div>
          )}

          {/* Hero trees */}
          {heroTypes.map(ht => (
            <div key={ht} style={{ flexShrink: 0 }}>
              <div style={LABEL}>{ht.replace(/^hero_/, '').replace(/_/g, ' ')}</div>
              <TalentTreeSection nodes={heroNodesByType[ht] || []} edges={edges} name1={name1} name2={name2} />
            </div>
          ))}

          {/* Spec tree */}
          {specNodes.length > 0 && (
            <div style={{ flexShrink: 0 }}>
              <div style={LABEL}>{specName ? `Spec — ${specName}` : 'Spec'}</div>
              <TalentTreeSection nodes={specNodes} edges={edges} name1={name1} name2={name2} />
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {!loading && treeData && (
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: 'var(--dim,#4a5a6a)', flexWrap: 'wrap' }}>
          {[
            { bg: 'rgba(255,255,255,0.04)', border: 'rgba(160,170,185,0.55)', label: 'both' },
            { bg: 'rgba(201,162,39,0.18)',  border: 'rgba(201,162,39,1)',      label: `${name1} only` },
            { bg: 'rgba(90,173,240,0.13)',  border: 'rgba(90,173,240,1)',      label: `${name2} only` },
            { bg: 'rgba(8,10,14,0.7)',      border: 'rgba(40,50,62,0.3)',      label: 'neither', dim: true },
          ].map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: l.dim ? 0.5 : 1 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.border}`, display: 'inline-block' }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
