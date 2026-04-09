/**
 * TalentCompare.js
 */

import { useState, useEffect, useRef } from 'react'

// ── Fetch talent data from WCL ────────────────────────────────────────────────
export async function fetchTalents({ reportCode, fightId, fightStart, fightEnd, playerName, playerId, gql }) {
  try {
    // Parse fightId as int just in case it comes in as string
    const fightIdInt = parseInt(fightId)

    // Fetch CombatantInfo events — these contain the talent data
    // Use both fightIDs filter AND startTime/endTime for reliability
    const eventsData = await gql(`
      query($code: String!, $fightId: Int!, $start: Float!, $end: Float!) {
        reportData {
          report(code: $code) {
            events(
              dataType: CombatantInfo
              fightIDs: [$fightId]
              startTime: $start
              endTime: $end
              limit: 100
            ) { data }
          }
        }
      }
    `, { code: reportCode, fightId: fightIdInt, start: fightStart, end: fightEnd })

    const events = eventsData?.reportData?.report?.events?.data || []
    console.log(`[fetchTalents] ${playerName}: got ${events.length} CombatantInfo events`)

    if (events.length === 0) {
      console.warn(`[fetchTalents] No CombatantInfo events found for fight ${fightIdInt} in ${reportCode}`)
      return null
    }

    // Find this player's event — try by playerId first, then by name via playerDetails
    let playerEvent = playerId ? events.find(e => e.sourceID === playerId) : null

    if (!playerEvent) {
      // Fallback: fetch playerDetails to map names to IDs
      const detailsData = await gql(`
        query($code: String!, $fightId: Int!) {
          reportData { report(code: $code) { playerDetails(fightIDs: [$fightId]) } }
        }
      `, { code: reportCode, fightId: fightIdInt })

      const details = detailsData?.reportData?.report?.playerDetails?.data
      const allPlayers = [
        ...(details?.dps || []),
        ...(details?.healers || []),
        ...(details?.tanks || []),
      ]
      console.log(`[fetchTalents] playerDetails players:`, allPlayers.map(p => `${p.name}(${p.id})`).join(', '))
      const pd = allPlayers.find(p => p.name?.toLowerCase() === playerName?.toLowerCase())
      if (pd) playerEvent = events.find(e => e.sourceID === pd.id)
    }

    if (!playerEvent) {
      // Last resort: if only one event, use it
      if (events.length === 1) playerEvent = events[0]
      else {
        console.warn(`[fetchTalents] Could not match ${playerName} to any CombatantInfo event. Event sourceIDs: ${events.map(e=>e.sourceID).join(', ')}`)
        return null
      }
    }

    console.log(`[fetchTalents] ${playerName} matched sourceID ${playerEvent.sourceID}`)
    console.log(`[fetchTalents] talentTree length: ${(playerEvent.talentTree||[]).length}, talents length: ${(playerEvent.talents||[]).length}`)

    // Modern WoW uses talentTree: [{ id, rank, spellId }]
    // Older format uses talents: [{ id, name }]
    const talentTree = playerEvent.talentTree || []
    const talents = playerEvent.talents || []
    const combined = talentTree.length > 0 ? talentTree : talents

    return {
      name: playerName,
      sourceID: playerEvent.sourceID,
      talents: combined,
      talentString: playerEvent.talentSpec || null,
    }
  } catch (e) {
    console.error('[fetchTalents] error:', e)
    return null
  }
}

// ── Diff two talent sets ──────────────────────────────────────────────────────
export function diffTalents(t1, t2) {
  // Normalize: handle both {id, name} and {id, spellId, rank} formats
  function normalize(talents) {
    return (talents || []).map(t => ({
      id: t.spellId || t.id,
      name: t.name || `Talent ${t.spellId || t.id}`,
      rank: t.rank || 1,
    })).filter(t => t.id)
  }

  const list1 = normalize(t1?.talents)
  const list2 = normalize(t2?.talents)
  const ids1 = new Set(list1.map(t => t.id))
  const ids2 = new Set(list2.map(t => t.id))
  const all = new Map()
  list1.forEach(t => all.set(t.id, t))
  list2.forEach(t => { if (!all.has(t.id)) all.set(t.id, t) })

  const shared = [], p1Only = [], p2Only = []
  all.forEach((talent, id) => {
    if (ids1.has(id) && ids2.has(id)) shared.push(talent)
    else if (ids1.has(id)) p1Only.push(talent)
    else p2Only.push(talent)
  })

  return { shared, p1Only, p2Only }
}

// ── Wowhead tooltip hook ──────────────────────────────────────────────────────
// Manages tooltips ourselves so they dismiss properly on mouseout
function useWowheadTooltip() {
  const tooltipRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const el = document.createElement('div')
    el.id = 'wh-tooltip-custom'
    el.style.cssText = `
      position:fixed;z-index:9999;pointer-events:none;
      background:#1a1a1a;border:1px solid #444;border-radius:4px;
      padding:8px 10px;max-width:280px;font-size:12px;line-height:1.5;
      color:#e8edf2;font-family:'IBM Plex Sans',sans-serif;display:none;
      box-shadow:0 4px 16px rgba(0,0,0,0.6);
    `
    document.body.appendChild(el)
    tooltipRef.current = el
    return () => { el.remove() }
  }, [])

  async function showTooltip(e, spellId, knownName) {
    clearTimeout(timerRef.current)
    const el = tooltipRef.current
    if (!el) return
    el.style.display = 'block'
    el.style.cssText += ';padding:0;max-width:320px;overflow:hidden;border-radius:6px;'
    el.innerHTML = '<div style="padding:10px 12px;color:#4a5a6a;font-family:IBM Plex Mono,monospace;font-size:11px">Loading...</div>'
    positionTooltip(e, el)
    try {
      const res = await fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}?dataEnv=11&locale=0`)
      const data = await res.json()
      const iconName = data.icon || ''
      const iconUrl = iconName ? `https://wow.zamimg.com/images/wow/icons/medium/${iconName}.jpg` : ''
      const displayName = knownName || data.name || 'Spell ' + spellId
      const header = `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #1e252e;background:#0a0c0f">
        ${iconUrl ? `<img src="${iconUrl}" style="width:36px;height:36px;border-radius:4px;border:1px solid #2a3340;flex-shrink:0" onerror="this.style.display='none'"/>` : ''}
        <div style="font-family:Rajdhani,sans-serif;font-size:15px;font-weight:600;color:#e8be40;letter-spacing:.5px">${displayName}</div>
      </div>`
      const body = (data.tooltip || '')
        .replace(/<table[^>]*>/gi, '<div style="margin-bottom:2px">').replace(/<\/table>/gi, '</div>')
        .replace(/<tr[^>]*>/gi, '<div>').replace(/<\/tr>/gi, '</div>')
        .replace(/<td[^>]*>/gi, '<span style="margin-right:4px">').replace(/<\/td>/gi, '</span>')
        .replace(/<th[^>]*>.*?<\/th>/gi, '')
      el.innerHTML = header + `<div style="padding:10px 12px;font-size:12px;color:#8a9bb0;line-height:1.6;max-height:180px;overflow-y:auto">${body || 'Spell ID: ' + spellId}</div>`
      positionTooltip(e, el)
    } catch {
      el.innerHTML = `<div style="padding:10px 12px"><span style="color:#e8be40;font-family:Rajdhani,sans-serif;font-size:14px">${knownName || 'Spell ' + spellId}</span></div>`
    }
  }

  function positionTooltip(e, el) {
    const x = e.clientX + 14
    const y = e.clientY + 14
    const maxX = window.innerWidth - 300
    const maxY = window.innerHeight - 200
    el.style.left = Math.min(x, maxX) + 'px'
    el.style.top = Math.min(y, maxY) + 'px'
  }

  function moveTooltip(e) {
    positionTooltip(e, tooltipRef.current)
  }

  function hideTooltip() {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (tooltipRef.current) tooltipRef.current.style.display = 'none'
    }, 80)
  }

  return { showTooltip, moveTooltip, hideTooltip }
}

// ── Talent link component ─────────────────────────────────────────────────────
function TalentLink({ talent, color }) {
  const { showTooltip, moveTooltip, hideTooltip } = useWowheadTooltip()
  const spellId = talent.id

  return (
    <a
      href={`https://www.wowhead.com/spell=${spellId}`}
      target="_blank"
      rel="noreferrer"
      onMouseEnter={e => showTooltip(e, spellId, talent.name)}
      onMouseMove={moveTooltip}
      onMouseLeave={hideTooltip}
      style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 12,
        color: color === 'gold' ? 'var(--gold2)' : color === 'blue' ? 'var(--blue)' : 'var(--muted)',
        textDecoration: 'none',
        borderBottom: `1px dotted ${color === 'gold' ? 'rgba(201,162,39,0.5)' : color === 'blue' ? 'rgba(90,173,240,0.5)' : 'var(--dim)'}`,
        cursor: 'help',
      }}
    >
      {talent.name}
    </a>
  )
}

// ── Talent Compare Component ──────────────────────────────────────────────────
export function TalentCompare({ p1Talents, p2Talents, name1, name2 }) {
  if (!p1Talents && !p2Talents) {
    return (
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--dim)', padding: '8px 0' }}>
        Talent data not available for this fight. WCL may not have combatant info recorded.
      </div>
    )
  }

  const diff = diffTalents(p1Talents, p2Talents)
  const hasDiffs = diff.p1Only.length > 0 || diff.p2Only.length > 0

  const tag = (label, color) => (
    <span style={{
      fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
      letterSpacing: '.5px', textTransform: 'uppercase', padding: '1px 6px',
      borderRadius: 2, marginRight: 6,
      background: color === 'gold' ? 'rgba(201,162,39,0.12)' : color === 'blue' ? 'rgba(90,173,240,0.12)' : 'rgba(74,90,106,0.15)',
      color: color === 'gold' ? 'var(--gold2)' : color === 'blue' ? 'var(--blue)' : 'var(--dim)',
      border: `1px solid ${color === 'gold' ? 'rgba(201,162,39,0.25)' : color === 'blue' ? 'rgba(90,173,240,0.2)' : 'rgba(74,90,106,0.25)'}`,
    }}>{label}</span>
  )

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
        <span style={{ color: 'var(--dim)' }}>Shared: <span style={{ color: 'var(--text)' }}>{diff.shared.length}</span></span>
        <span style={{ color: 'var(--gold2)' }}>{name1} only: <strong>{diff.p1Only.length}</strong></span>
        <span style={{ color: 'var(--blue)' }}>{name2} only: <strong>{diff.p2Only.length}</strong></span>
      </div>

      {/* Visual diff grid */}
      {hasDiffs ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'var(--bg3)', border: '1px solid rgba(201,162,39,0.2)', borderRadius: 4, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>
              {name1} only
            </div>
            {diff.p1Only.length === 0
              ? <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--dim)' }}>No unique talents</div>
              : diff.p1Only.map(t => (
                <div key={t.id} style={{ marginBottom: 6 }}>
                  <TalentLink talent={t} color="gold" />
                </div>
              ))
            }
          </div>
          <div style={{ background: 'var(--bg3)', border: '1px solid rgba(90,173,240,0.2)', borderRadius: 4, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: 10 }}>
              {name2} only
            </div>
            {diff.p2Only.length === 0
              ? <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--dim)' }}>No unique talents</div>
              : diff.p2Only.map(t => (
                <div key={t.id} style={{ marginBottom: 6 }}>
                  <TalentLink talent={t} color="blue" />
                </div>
              ))
            }
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--green)', marginBottom: 16 }}>
          ✓ Identical talent builds
        </div>
      )}

      {/* Full list — diffs first, then shared */}
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>
        All talents
      </div>
      <div style={{ columns: 2, columnGap: 16 }}>
        {[
          ...diff.p1Only.map(t => ({ t, color: 'gold', label: name1 })),
          ...diff.p2Only.map(t => ({ t, color: 'blue', label: name2 })),
          ...diff.shared.map(t => ({ t, color: 'dim', label: 'both' })),
        ].map(({ t, color, label }) => (
          <div key={t.id + label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, breakInside: 'avoid' }}>
            {tag(label, color)}
            <TalentLink talent={t} color={color} />
          </div>
        ))}
      </div>
    </div>
  )
}
