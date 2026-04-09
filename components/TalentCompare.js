/**
 * TalentCompare.js
 * Icon grid showing talent differences between two players.
 * Rows: Differences | Class | Spec | Hero
 * Columns: Player 1 | Player 2
 * Icons fetched from Wowhead tooltip API.
 */

import { useState, useEffect, useRef } from 'react'

// ── Fetch talent data from WCL CombatantInfo ──────────────────────────────────
export async function fetchTalents({ reportCode, fightId, fightStart, fightEnd, playerName, playerId, gql }) {
  try {
    const fightIdInt = parseInt(fightId)

    const eventsData = await gql(`
      query($code: String!, $fightId: Int!, $start: Float!, $end: Float!) {
        reportData { report(code: $code) {
          events(dataType: CombatantInfo, fightIDs: [$fightId], startTime: $start, endTime: $end, limit: 100) { data }
        }}
      }
    `, { code: reportCode, fightId: fightIdInt, start: fightStart, end: fightEnd })

    const events = eventsData?.reportData?.report?.events?.data || []
    console.log(`[fetchTalents] ${playerName}: got ${events.length} CombatantInfo events`)
    if (!events.length) return null

    let playerEvent = playerId ? events.find(e => e.sourceID === playerId) : null

    if (!playerEvent) {
      const detailsData = await gql(`
        query($code: String!, $fightId: Int!) {
          reportData { report(code: $code) { playerDetails(fightIDs: [$fightId]) } }
        }
      `, { code: reportCode, fightId: fightIdInt })
      const details = detailsData?.reportData?.report?.playerDetails?.data
      const allPlayers = [...(details?.dps||[]), ...(details?.healers||[]), ...(details?.tanks||[])]
      const pd = allPlayers.find(p => p.name?.toLowerCase() === playerName?.toLowerCase())
      if (pd) playerEvent = events.find(e => e.sourceID === pd.id)
    }

    if (!playerEvent && events.length === 1) playerEvent = events[0]
    if (!playerEvent) { console.warn(`[fetchTalents] no match for ${playerName}`); return null }

    console.log(`[fetchTalents] ${playerName}: talentTree=${(playerEvent.talentTree||[]).length} talents=${(playerEvent.talents||[]).length}`)

    // talentTree: [{ id, rank, spellId, type? }] — modern TWW format
    // talents: [{ id, name }] — older format fallback
    const talentTree = playerEvent.talentTree || []
    const talents = playerEvent.talents || []

    return {
      name: playerName,
      sourceID: playerEvent.sourceID,
      talentTree: talentTree.length > 0 ? talentTree : talents,
      talentString: playerEvent.talentSpec || null,
    }
  } catch (e) {
    console.error('[fetchTalents] error:', e)
    return null
  }
}

// ── Fetch full talent tree layout from WCL gameData ───────────────────────────
// Returns map of definitionId -> { type: 0|1|2, spellId, name, row, col }
// type: 0=class, 1=spec, 2=hero
let _treeCache = null
export async function fetchTalentTreeLayout(classId = 8, specId = 64, gql) {
  if (_treeCache) return _treeCache
  try {
    const data = await gql(`
      query($classId: Int!, $specId: Int!) {
        gameData {
          talentTree(classId: $classId, specId: $specId) {
            classNodes { id definitionId spellId name row col type }
            specNodes  { id definitionId spellId name row col type }
            heroNodes  { id definitionId spellId name row col type }
          }
        }
      }
    `, { classId, specId })

    const tree = data?.gameData?.talentTree
    if (!tree) return null

    const layout = new Map()
    ;(tree.classNodes||[]).forEach(n => layout.set(n.definitionId || n.id, { ...n, category: 'class' }))
    ;(tree.specNodes ||[]).forEach(n => layout.set(n.definitionId || n.id, { ...n, category: 'spec'  }))
    ;(tree.heroNodes ||[]).forEach(n => layout.set(n.definitionId || n.id, { ...n, category: 'hero'  }))

    _treeCache = layout
    console.log(`[treeLayout] loaded ${layout.size} nodes`)
    return layout
  } catch (e) {
    console.warn('[treeLayout] gameData query failed, will use heuristic categorization:', e.message)
    return null
  }
}

// ── Categorize talents without tree layout ────────────────────────────────────
// Heuristic fallback: WCL CombatantInfo talentTree nodes with type field
function categorizeTalents(talentTree, treeLayout) {
  const result = { class: [], spec: [], hero: [] }

  talentTree.forEach(t => {
    const spellId = t.spellId || t.id
    const defId = t.id
    const nodeId = t.nodeID

    const node = treeLayout?.get(defId) || treeLayout?.get(spellId)
    if (node) {
      result[node.category].push({ id: spellId, defId, nodeId, name: t.name || node.name || `Talent ${spellId}`, rank: t.rank || 1 })
      return
    }

    const cat = t.type === 0 ? 'class' : t.type === 1 ? 'spec' : t.type === 2 ? 'hero' : null
    if (cat) {
      result[cat].push({ id: spellId, defId, nodeId, name: t.name || `Talent ${spellId}`, rank: t.rank || 1 })
    } else {
      result.spec.push({ id: spellId, defId, nodeId, name: t.name || `Talent ${spellId}`, rank: t.rank || 1 })
    }
  })

  return result
}

// ── Talent node map cache ─────────────────────────────────────────────────────
let _nodeMap = null

async function getNodeMap() {
  if (_nodeMap) return _nodeMap
  try {
    const r = await fetch('/api/talents?class=mage&spec=frost')
    const d = await r.json()
    _nodeMap = d.nodeMap || {}
    console.log(`[TalentCompare] loaded ${Object.keys(_nodeMap).length} node mappings`)
  } catch {
    _nodeMap = {}
  }
  return _nodeMap
}

// ── Icon + name cache ─────────────────────────────────────────────────────────
const _cache = {}

async function fetchTalentInfo(nodeId, defId) {
  const key = `n${nodeId}`
  if (_cache[key] !== undefined) return _cache[key]

  // Try nodeMap first
  const nodeMap = await getNodeMap()
  const mapped = nodeMap[nodeId] || nodeMap[String(nodeId)]
  if (mapped?.name && mapped?.icon) {
    _cache[key] = { name: mapped.name, icon: mapped.icon }
    return _cache[key]
  }
  if (mapped?.spellId) {
    // Have spellId but no icon yet — fetch via tooltip
    try {
      const r = await fetch(`/api/tooltip?id=${mapped.spellId}&type=spell`)
      if (r.ok) {
        const d = await r.json()
        if (d.icon) {
          const result = {
            name: mapped.name || d.name || `Spell ${mapped.spellId}`,
            icon: `https://wow.zamimg.com/images/wow/icons/medium/${d.icon}`,
          }
          _cache[key] = result
          return result
        }
      }
    } catch {}
  }

  // Fallback: try Wowhead tooltip with defId
  try {
    const r2 = await fetch(`/api/tooltip?id=${defId}&type=spell`)
    if (r2.ok) {
      const d2 = await r2.json()
      if (d2.name && d2.icon) {
        const result = { name: d2.name, icon: `https://wow.zamimg.com/images/wow/icons/medium/${d2.icon}` }
        _cache[key] = result
        return result
      }
    }
  } catch {}

  _cache[key] = null
  return null
}

async function fetchIcon(spellId) {
  if (_cache[spellId] !== undefined) return _cache[spellId]
  try {
    const res = await fetch(`/api/tooltip?id=${spellId}&type=spell`)
    if (!res.ok) throw new Error('not ok')
    const d = await res.json()
    const url = d.icon ? `https://wow.zamimg.com/images/wow/icons/medium/${d.icon}` : null
    _cache[spellId] = url
    return url
  } catch {
    _cache[spellId] = null
    return null
  }
}

// ── Talent Icon component ─────────────────────────────────────────────────────
function TalentIcon({ spellId, nodeId, name, state, size = 40 }) {
  const [iconUrl, setIconUrl] = useState(null)
  const [resolvedName, setResolvedName] = useState(name)
  const ref = useRef(null)

  useEffect(() => {
    if (nodeId) {
      fetchTalentInfo(nodeId, spellId).then(info => {
        if (info) {
          setIconUrl(info.icon)
          if (info.name) setResolvedName(info.name)
        }
      })
    } else {
      fetchIcon(spellId).then(url => setIconUrl(url))
    }
  }, [spellId, nodeId])

  // Trigger global tooltip system via data attribute
  useEffect(() => {
    if (ref.current) {
      ref.current.setAttribute('data-wh-spell', spellId)
      ref.current.setAttribute('data-wh-name', resolvedName || name)
    }
  }, [spellId, resolvedName, name])

  const borderColor = state === 'p1' ? 'rgba(201,162,39,0.9)'
    : state === 'p2' ? 'rgba(90,173,240,0.9)'
    : state === 'both' ? 'rgba(64,160,96,0.7)'
    : 'rgba(42,51,64,0.5)'

  const opacity = (state === 'neither') ? 0.25 : 1

  return (
    <a
      ref={ref}
      href={`https://www.wowhead.com/spell=${spellId}`}
      target="_blank"
      rel="noreferrer"
      data-wh-spell={spellId}
      data-wh-name={resolvedName || name}
      title={resolvedName || name}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: 7, flexShrink: 0,
        border: `2px solid ${borderColor}`,
        background: iconUrl ? 'transparent' : '#1e252e',
        opacity,
        cursor: 'pointer',
        textDecoration: 'none',
        overflow: 'hidden',
        position: 'relative',
        transition: 'transform .1s, opacity .1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.zIndex = 10 }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = 1 }}
    >
      {iconUrl
        ? <img src={iconUrl} alt={resolvedName || name} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 5 }} onError={e => { e.target.style.display='none' }} />
        : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, color: '#4a5a6a', textAlign: 'center', padding: 2 }}>
            {(resolvedName || name).slice(0, 3).toUpperCase()}
          </span>
      }
      {/* State indicator dot */}
      {(state === 'p1' || state === 'p2') && (
        <div style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 7, height: 7, borderRadius: '50%',
          background: state === 'p1' ? '#c9a227' : '#5aadf0',
          border: '1px solid rgba(0,0,0,0.5)',
        }} />
      )}
    </a>
  )
}

// ── Icon grid for a single cell ───────────────────────────────────────────────
function IconGrid({ talents, emptyLabel }) {
  if (!talents || talents.length === 0) {
    return <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--dim)', padding: '4px 0' }}>{emptyLabel || '—'}</div>
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {talents.map((t, i) => (
        <TalentIcon key={i} spellId={t.id} nodeId={t.nodeId} name={t.name} state={t.state} size={38} />
      ))}
    </div>
  )
}

// ── Main TalentCompare component ──────────────────────────────────────────────
export function TalentCompare({ p1Talents, p2Talents, name1, name2, treeLayout }) {
  if (!p1Talents && !p2Talents) {
    return (
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--dim)', padding: '8px 0' }}>
        Talent data not available. Check browser console for details.
      </div>
    )
  }

  // Categorize both players' talents
  const cats1 = categorizeTalents(p1Talents?.talentTree || [], treeLayout)
  const cats2 = categorizeTalents(p2Talents?.talentTree || [], treeLayout)

  // Build sets for diffing
  function makeIdSet(arr) { return new Set(arr.map(t => t.id)) }
  const set1 = { class: makeIdSet(cats1.class), spec: makeIdSet(cats1.spec), hero: makeIdSet(cats1.hero) }
  const set2 = { class: makeIdSet(cats2.class), spec: makeIdSet(cats2.spec), hero: makeIdSet(cats2.hero) }

  // Annotate each talent with its state relative to the other player
  function annotate(talents, otherSet) {
    return talents.map(t => ({ ...t, state: otherSet.has(t.id) ? 'both' : 'p1' }))
  }
  function annotateP2(talents, otherSet) {
    return talents.map(t => ({ ...t, state: otherSet.has(t.id) ? 'both' : 'p2' }))
  }

  // For "full" rows — show all talents from union of both players, with state
  function buildFullRow(cat) {
    const allIds = new Set([...set1[cat], ...set2[cat]])
    const allTalents1 = [], allTalents2 = []
    // Merge both lists preserving order, deduplicate
    const merged = new Map()
    cats1[cat].forEach(t => merged.set(t.id, t))
    cats2[cat].forEach(t => { if (!merged.has(t.id)) merged.set(t.id, t) })

    merged.forEach((t, id) => {
      const inP1 = set1[cat].has(id)
      const inP2 = set2[cat].has(id)
      allTalents1.push({ ...t, state: inP1 ? (inP2 ? 'both' : 'p1') : 'neither' })
      allTalents2.push({ ...t, state: inP2 ? (inP1 ? 'both' : 'p2') : 'neither' })
    })

    return { p1: allTalents1, p2: allTalents2 }
  }

  const classRow = buildFullRow('class')
  const specRow  = buildFullRow('spec')
  const heroRow  = buildFullRow('hero')

  // Differences row — only unique talents
  const diff1 = [
    ...cats1.class.filter(t => !set2.class.has(t.id)).map(t => ({ ...t, state: 'p1', cat: 'class' })),
    ...cats1.spec.filter(t  => !set2.spec.has(t.id) ).map(t => ({ ...t, state: 'p1', cat: 'spec'  })),
    ...cats1.hero.filter(t  => !set2.hero.has(t.id) ).map(t => ({ ...t, state: 'p1', cat: 'hero'  })),
  ]
  const diff2 = [
    ...cats2.class.filter(t => !set1.class.has(t.id)).map(t => ({ ...t, state: 'p2', cat: 'class' })),
    ...cats2.spec.filter(t  => !set1.spec.has(t.id) ).map(t => ({ ...t, state: 'p2', cat: 'spec'  })),
    ...cats2.hero.filter(t  => !set1.hero.has(t.id) ).map(t => ({ ...t, state: 'p2', cat: 'hero'  })),
  ]

  const totalDiffs = diff1.length + diff2.length
  const shared = cats1.class.filter(t => set2.class.has(t.id)).length
    + cats1.spec.filter(t => set2.spec.has(t.id)).length
    + cats1.hero.filter(t => set2.hero.has(t.id)).length

  const s = {
    grid: { display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 0 },
    rowLabel: { fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim)', paddingTop: 10, paddingRight: 10, display: 'flex', alignItems: 'flex-start' },
    cell: { padding: '10px 8px', borderBottom: '1px solid var(--border)' },
    colHeader: { fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', padding: '6px 8px', borderBottom: '1px solid var(--border)' },
    diffCell: { padding: '10px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', borderRadius: 0 },
  }

  return (
    <div>
      {/* Summary + Wowhead links */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
          <span style={{ color: 'var(--dim)' }}>Shared: <span style={{ color: 'var(--text)' }}>{shared}</span></span>
          <span style={{ color: 'var(--gold2)' }}>{name1} unique: <strong>{diff1.length}</strong></span>
          <span style={{ color: 'var(--blue)' }}>{name2} unique: <strong>{diff2.length}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {p1Talents?.talentString && (
            <a href={`https://www.wowhead.com/talent-calc/mage/frost#${p1Talents.talentString}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--gold2)' }}>
              {name1} on Wowhead ↗
            </a>
          )}
          {p2Talents?.talentString && (
            <a href={`https://www.wowhead.com/talent-calc/mage/frost#${p2Talents.talentString}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--blue)' }}>
              {name2} on Wowhead ↗
            </a>
          )}
        </div>
      </div>

      {/* Grid */}
      <div style={s.grid}>
        {/* Header row */}
        <div style={{ ...s.colHeader, color: 'var(--dim)' }} />
        <div style={{ ...s.colHeader, color: 'var(--gold2)', borderLeft: '1px solid var(--border)' }}>{name1}</div>
        <div style={{ ...s.colHeader, color: 'var(--blue)', borderLeft: '1px solid var(--border)' }}>{name2}</div>

        {/* Differences row */}
        {totalDiffs > 0 && <>
          <div style={{ ...s.rowLabel, ...s.diffCell, background: 'var(--bg3)' }}>Diff</div>
          <div style={{ ...s.diffCell, borderLeft: '1px solid var(--border)', borderLeft: '2px solid rgba(201,162,39,0.3)' }}>
            <IconGrid talents={diff1} emptyLabel="Identical" />
          </div>
          <div style={{ ...s.diffCell, borderLeft: '2px solid rgba(90,173,240,0.3)' }}>
            <IconGrid talents={diff2} emptyLabel="Identical" />
          </div>
        </>}

        {/* Class row */}
        {(classRow.p1.length > 0 || classRow.p2.length > 0) && <>
          <div style={{ ...s.rowLabel, ...s.cell }}>Class</div>
          <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}><IconGrid talents={classRow.p1} /></div>
          <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}><IconGrid talents={classRow.p2} /></div>
        </>}

        {/* Spec row */}
        {(specRow.p1.length > 0 || specRow.p2.length > 0) && <>
          <div style={{ ...s.rowLabel, ...s.cell }}>Spec</div>
          <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}><IconGrid talents={specRow.p1} /></div>
          <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}><IconGrid talents={specRow.p2} /></div>
        </>}

        {/* Hero row */}
        {(heroRow.p1.length > 0 || heroRow.p2.length > 0) && <>
          <div style={{ ...s.rowLabel, ...s.cell }}>Hero</div>
          <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}><IconGrid talents={heroRow.p1} /></div>
          <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}><IconGrid talents={heroRow.p2} /></div>
        </>}

        {/* Fallback: if no categorization, show raw diff */}
        {classRow.p1.length === 0 && specRow.p1.length === 0 && heroRow.p1.length === 0 && (
          <>
            <div style={{ ...s.rowLabel, ...s.cell }}>Talents</div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid talents={(p1Talents?.talentTree||[]).map(t => ({ id: t.spellId||t.id, name: t.name||`Talent ${t.spellId||t.id}`, state: 'p1' }))} />
            </div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid talents={(p2Talents?.talentTree||[]).map(t => ({ id: t.spellId||t.id, name: t.name||`Talent ${t.spellId||t.id}`, state: 'p2' }))} />
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--dim)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(64,160,96,0.2)', border: '1.5px solid rgba(64,160,96,0.6)', display: 'inline-block' }} />
          both
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(201,162,39,0.15)', border: '2px solid rgba(201,162,39,0.9)', display: 'inline-block' }} />
          {name1} only
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(90,173,240,0.15)', border: '2px solid rgba(90,173,240,0.9)', display: 'inline-block' }} />
          {name2} only
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1e252e', border: '1px solid rgba(42,51,64,0.5)', opacity: 0.4, display: 'inline-block' }} />
          neither
        </span>
      </div>
    </div>
  )
}
