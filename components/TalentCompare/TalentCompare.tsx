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
}

function TalentLink({ spellId, name, color }: { spellId: number; name: string; color: 'gold'|'blue'|'dim' }) {
  const c = color === 'gold' ? { text: 'rgba(201,162,39,1)', border: 'rgba(201,162,39,0.4)' }
    : color === 'blue' ? { text: 'rgba(90,173,240,1)', border: 'rgba(90,173,240,0.4)' }
    : { text: 'var(--muted,#8a9bb0)', border: 'var(--dim,#4a5a6a)' }
  return (
    <a href={`https://www.wowhead.com/spell=${spellId}`} target="_blank" rel="noreferrer"
      data-wh-spell={spellId} data-wh-name={name}
      style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: c.text,
        textDecoration: 'none', borderBottom: `1px dotted ${c.border}`, cursor: 'help' }}>
      {name}
    </a>
  )
}

type Tab = 'class' | 'spec' | 'hero' | 'diff'

export function TalentCompare({ p1Talents, p2Talents, name1, name2 }: Props) {
  const [tab, setTab] = useState<Tab>('class')
  const [treeData, setTreeData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (treeData) return
    setLoading(true)
    fetch('/api/blizzard-tree?specId=64')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setTreeData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Build WCL selection maps: nodeId → rank
  const sel1 = new Map<number, number>()
  const sel2 = new Map<number, number>()
  ;(p1Talents?.talentTree || []).forEach((t: WCLTalent) => sel1.set(t.nodeID, t.rank))
  ;(p2Talents?.talentTree || []).forEach((t: WCLTalent) => sel2.set(t.nodeID, t.rank))

  // Annotate Blizzard nodes with diff state
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
  const heroTypes: string[] = treeData?.heroTypes || []
  const heroNodesByType: Record<string, BlizzardNode[]> = {}
  heroTypes.forEach(t => { heroNodesByType[t] = annotate(allNodes.filter((n: BlizzardNode) => n.type === t)) })

  // Diff stats
  const all = annotate(allNodes)
  const p1Only = all.filter(n => n.state === 'p1')
  const p2Only = all.filter(n => n.state === 'p2')
  const both   = all.filter(n => n.state === 'both')

  const tabStyle = (active: boolean) => ({
    fontFamily: 'Rajdhani,sans-serif', fontWeight: 600 as const, fontSize: 11,
    letterSpacing: '.8px', textTransform: 'uppercase' as const,
    padding: '5px 12px', borderRadius: 3,
    border: '1px solid var(--border,#2a3340)', cursor: 'pointer' as const,
    background: active ? 'var(--bg4,#1e252e)' : 'transparent',
    color: active ? 'var(--text,#e8edf2)' : 'var(--dim,#4a5a6a)',
  })

  if (!p1Talents && !p2Talents) return (
    <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--dim,#4a5a6a)' }}>
      Talent data not available.
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'IBM Plex Mono,monospace', fontSize: 11 }}>
          <span style={{ color: 'var(--dim,#4a5a6a)' }}>Shared: <span style={{ color: 'var(--text,#e8edf2)' }}>{both.length}</span></span>
          <span style={{ color: 'rgba(201,162,39,0.9)' }}>{name1} only: <strong>{p1Only.length}</strong></span>
          <span style={{ color: 'rgba(90,173,240,0.8)' }}>{name2} only: <strong>{p2Only.length}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {(['class','spec','hero','diff'] as Tab[]).map(t => (
            <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'var(--dim,#4a5a6a)', padding: '20px 0' }}>Loading talent tree from Blizzard...</div>}
      {error && <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'var(--red,#d44040)', padding: '8px 0' }}>Error: {error}</div>}

      {/* Tree views */}
      {!loading && !error && treeData && (
        <>
          {tab === 'class' && (
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim,#4a5a6a)', marginBottom: 8 }}>Class tree — Mage</div>
              <TalentTreeSection nodes={classNodes} edges={edges} name1={name1} name2={name2} />
            </div>
          )}
          {tab === 'spec' && (
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim,#4a5a6a)', marginBottom: 8 }}>Spec tree — Frost</div>
              <TalentTreeSection nodes={specNodes} edges={edges} name1={name1} name2={name2} />
            </div>
          )}
          {tab === 'hero' && (
            <div style={{ display: 'flex', gap: 24, overflowX: 'auto', paddingBottom: 8 }}>
              {heroTypes.length === 0
                ? <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'var(--dim,#4a5a6a)' }}>No hero talent data returned.</div>
                : heroTypes.map(ht => (
                    <div key={ht}>
                      <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim,#4a5a6a)', marginBottom: 8 }}>
                        {ht.replace('hero_', '').replace(/_/g, ' ')}
                      </div>
                      <TalentTreeSection nodes={heroNodesByType[ht] || []} edges={edges} name1={name1} name2={name2} />
                    </div>
                  ))
              }
            </div>
          )}
        </>
      )}

      {/* Diff list */}
      {tab === 'diff' && (
        <div>
          {(p1Only.length > 0 || p2Only.length > 0) ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--bg3,#181d23)', border: '1px solid rgba(201,162,39,0.2)', borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'rgba(201,162,39,0.9)', marginBottom: 8 }}>{name1} only</div>
                {p1Only.map(n => <div key={n.nodeId} style={{ marginBottom: 5 }}><TalentLink spellId={n.entries[0]?.spellId} name={n.entries[0]?.name || `Node ${n.nodeId}`} color="gold" /></div>)}
              </div>
              <div style={{ background: 'var(--bg3,#181d23)', border: '1px solid rgba(90,173,240,0.2)', borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'rgba(90,173,240,0.8)', marginBottom: 8 }}>{name2} only</div>
                {p2Only.map(n => <div key={n.nodeId} style={{ marginBottom: 5 }}><TalentLink spellId={n.entries[0]?.spellId} name={n.entries[0]?.name || `Node ${n.nodeId}`} color="blue" /></div>)}
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--green,#40a060)', marginBottom: 12 }}>✓ Identical talent builds</div>
          )}
          <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim,#4a5a6a)', marginBottom: 8 }}>All talents</div>
          <div style={{ columns: 2, columnGap: 16 }}>
            {[...p1Only.map(n=>({...n,who:'p1'})), ...p2Only.map(n=>({...n,who:'p2'})), ...both.map(n=>({...n,who:'both'}))].map(n => {
              const name = n.entries[0]?.name || `Node ${n.nodeId}`
              const spellId = n.entries[0]?.spellId || 0
              const color: 'gold'|'blue'|'dim' = n.who === 'p1' ? 'gold' : n.who === 'p2' ? 'blue' : 'dim'
              const tagColor = n.who === 'p1' ? 'rgba(201,162,39,0.9)' : n.who === 'p2' ? 'rgba(90,173,240,0.8)' : 'var(--dim,#4a5a6a)'
              const label = n.who === 'both' ? 'both' : n.who === 'p1' ? name1.slice(0,6) : name2.slice(0,6)
              return (
                <div key={`${n.who}-${n.nodeId}`} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, breakInside: 'avoid' as const }}>
                  <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' as const, padding: '1px 5px', borderRadius: 2, marginRight: 6, background: `${tagColor}18`, color: tagColor, border: `1px solid ${tagColor}40`, flexShrink: 0 }}>{label}</span>
                  {spellId ? <TalentLink spellId={spellId} name={name} color={color} /> : <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--muted,#8a9bb0)' }}>{name}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      {tab !== 'diff' && !loading && (
        <div style={{ display: 'flex', gap: 14, marginTop: 12, fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: 'var(--dim,#4a5a6a)', flexWrap: 'wrap' }}>
          {[
            { bg: 'rgba(29,158,117,0.2)',  border: 'rgba(29,158,117,0.8)', label: 'both' },
            { bg: 'rgba(201,162,39,0.2)',  border: 'rgba(201,162,39,1)',   label: `${name1} only` },
            { bg: 'rgba(90,173,240,0.15)', border: 'rgba(90,173,240,1)',   label: `${name2} only` },
            { bg: 'rgba(10,12,15,0.8)',    border: 'rgba(42,51,64,0.4)',   label: 'neither', dim: true },
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
