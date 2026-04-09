/**
 * buildContext.js
 *
 * Takes two fully-analyzed fight datasets and builds a rich context string
 * for Claude that explains not just WHAT each player did, but the game state
 * conditions under which they did it.
 */

export function buildRichContext(p1, p2, talentDiff) {
  const { name: n1, spec: s1 } = p1
  const { name: n2, spec: s2 } = p2

  let ctx = `You are an expert World of Warcraft raiding coach with deep knowledge of Frost Mage mechanics in The War Within / Midnight Season 1.\n\n`
  ctx += `CRITICAL RULES:\n`
  ctx += `- Both players are ${s1} spec\n`
  ctx += `- Only reference spells that appear in the data below — never invent spell names\n`
  ctx += `- When explaining WHY something is better, reference the specific game state conditions (proc counts, buff windows, target counts) from the data\n`
  ctx += `- Do not give generic advice — every recommendation must be grounded in something specific you see in this data\n`
  ctx += `- ALWAYS link spell names to Wowhead using this exact format: [Spell Name](https://www.wowhead.com/spell=SPELL_ID)\n`
  ctx += `  Use the spell ID map below to get the correct IDs\n\n`

  // Build spell ID map from the data so Claude can link correctly
  ctx += `=== SPELL ID MAP (use these for Wowhead links) ===\n`
  const allSpells = new Set()
  p1.spellRows?.forEach(r => allSpells.add(JSON.stringify({ id: r.id, name: r.name })))
  ;[...allSpells].forEach(s => {
    try {
      const { id, name } = JSON.parse(s)
      if (name && !name.startsWith('Spell ')) ctx += `${name}: spell ID ${id} → https://www.wowhead.com/spell=${id}\n`
    } catch {}
  })
  ctx += '\n'

  // Talent diff section
  if (talentDiff?.t1 || talentDiff?.t2) {
    ctx += `=== TALENT DIFFERENCES ===\n`
    const ids1 = new Set((talentDiff.t1?.talents || []).map(t => t.id))
    const ids2 = new Set((talentDiff.t2?.talents || []).map(t => t.id))
    const all = new Map()
    ;(talentDiff.t1?.talents || []).forEach(t => all.set(t.id, t))
    ;(talentDiff.t2?.talents || []).forEach(t => { if (!all.has(t.id)) all.set(t.id, t) })
    const p1Only = [], p2Only = []
    all.forEach((t, id) => {
      if (ids1.has(id) && !ids2.has(id)) p1Only.push(t)
      if (ids2.has(id) && !ids1.has(id)) p2Only.push(t)
    })
    if (p1Only.length) ctx += `${n1} has but ${n2} does not:\n${p1Only.map(t => `  - ${t.name} (spell ${t.guid || t.id})`).join('\n')}\n`
    if (p2Only.length) ctx += `${n2} has but ${n1} does not:\n${p2Only.map(t => `  - ${t.name} (spell ${t.guid || t.id})`).join('\n')}\n`
    if (!p1Only.length && !p2Only.length) ctx += `Identical talent builds.\n`
    ctx += '\n'
  }

  ctx += `FIGHT: ${p1.boss}\n`
  ctx += `${n1} (seeking improvement) vs ${n2} (comparison player)\n\n`

  // ── OVERALL ──
  ctx += `=== OVERALL ===\n`
  ctx += fmtOverall(p1)
  ctx += fmtOverall(p2)
  ctx += '\n'

  // ── OPENER ──
  ctx += `=== OPENER (first 20s) ===\n`
  ctx += `${n1}: ${p1.opener.map(c => `${c.name}@${c.at}s`).join(' → ')}\n`
  ctx += `${n2}: ${p2.opener.map(c => `${c.name}@${c.at}s`).join(' → ')}\n\n`

  // ── SPELL USAGE ──
  ctx += `=== SPELL USAGE (casts/min) ===\n`
  ctx += `${'Spell'.padEnd(30)} ${n1.padEnd(12)} ${n2.padEnd(12)} Diff   First cast timing\n`
  ctx += `${'-'.repeat(80)}\n`
  p1.spellRows.filter(r => r.ppm1 > 0 || r.ppm2 > 0).forEach(r => {
    const diff = r.ppm2 > 0 ? ((r.ppm1 - r.ppm2) / r.ppm2 * 100).toFixed(0) : null
    const ds = diff === null ? 'one player' : (diff >= 0 ? '+' : '') + diff + '%'
    const ft = (r.first1 !== null && r.first2 !== null && Math.abs(r.first1 - r.first2) > 1.5)
      ? `  [first: ${r.first1}s vs ${r.first2}s]` : ''
    ctx += `${(r.name || '').slice(0, 28).padEnd(30)} ${String(r.ppm1).padEnd(12)} ${String(r.ppm2).padEnd(12)} ${ds}${ft}\n`
  })
  ctx += '\n'

  // ── DOWNTIME ──
  ctx += `=== DOWNTIME ===\n`
  ctx += `${n1}: ${p1.downtime.pct}% (${p1.downtime.sec}s) — biggest gaps: ${p1.downtime.wins.map(w => w.g + 's').join(', ') || 'none'}\n`
  ctx += `${n2}: ${p2.downtime.pct}% (${p2.downtime.sec}s) — biggest gaps: ${p2.downtime.wins.map(w => w.g + 's').join(', ') || 'none'}\n\n`

  // ── PROC EFFICIENCY ──
  ctx += `=== PROC AND BUFF EFFICIENCY ===\n`
  ctx += fmtProcEfficiency(n1, p1.sequences, p1.uptimes, p1.nameMap)
  ctx += '\n'
  ctx += fmtProcEfficiency(n2, p2.sequences, p2.uptimes, p2.nameMap)
  ctx += '\n'

  // ── SEQUENCE ANALYSIS ──
  ctx += `=== COMBO SEQUENCE ANALYSIS ===\n`
  ctx += fmtSequences(n1, p1.sequences)
  ctx += '\n'
  ctx += fmtSequences(n2, p2.sequences)
  ctx += '\n'

  // ── FROZEN ORB USAGE ──
  ctx += `=== FROZEN ORB USAGE ===\n`
  ctx += fmtOrbUsage(n1, p1.sequences)
  ctx += '\n'
  ctx += fmtOrbUsage(n2, p2.sequences)
  ctx += '\n'

  // ── ALTER TIME ──
  if (p1.sequences.alterTime.casts.length > 0 || p2.sequences.alterTime.casts.length > 0) {
    ctx += `=== ALTER TIME USAGE ===\n`
    ctx += fmtAlterTime(n1, p1.sequences)
    ctx += fmtAlterTime(n2, p2.sequences)
    ctx += '\n'
  }

  // ── ICY VEINS WINDOWS ──
  ctx += `=== ICY VEINS WINDOWS ===\n`
  ctx += fmtIcyVeins(n1, p1.sequences, p1.icyVeinsWindows)
  ctx += '\n'
  ctx += fmtIcyVeins(n2, p2.sequences, p2.icyVeinsWindows)
  ctx += '\n'

  // ── POTION ──
  ctx += `=== POTION USAGE ===\n`
  ctx += fmtPotion(n1, p1.sequences)
  ctx += fmtPotion(n2, p2.sequences)
  ctx += '\n'

  // ── CAST TIMESTAMPS (key spells) ──
  ctx += `=== CAST TIMESTAMPS — key spells, first 15 casts ===\n`
  p1.spellRows.filter(r => r.ppm1 > 0.3 || r.ppm2 > 0.3).slice(0, 10).forEach(r => {
    ctx += `${r.name}:\n`
    ctx += `  ${n1}: [${r.ts1.slice(0, 15).join(', ')}]\n`
    ctx += `  ${n2}: [${r.ts2.slice(0, 15).join(', ')}]\n`
  })
  ctx += '\n'

  ctx += `=== HOW TO ANSWER QUESTIONS ===\n`
  ctx += `When asked about differences, explain:\n`
  ctx += `1. WHAT is different (the numbers)\n`
  ctx += `2. WHY it matters mechanically (how it affects Shatter, proc generation, burst windows)\n`
  ctx += `3. WHEN to make the decision differently (the specific game state conditions)\n`
  ctx += `4. HOW to fix it practically (what to look for and change)\n`
  ctx += `Always link spell names using [Spell Name](https://www.wowhead.com/spell=ID) format.\n`
  ctx += `Use ### headers. Be specific — no generic advice.\n`

  return ctx
}

function fmtOverall(p) {
  const m = Math.floor(p.dur / 60), s = String(Math.round(p.dur % 60)).padStart(2, '0')
  return `${p.name}: ${p.dps?.toLocaleString() || '?'} DPS | ${m}:${s} | ${p.downtime.cpm} casts/min | ${p.downtime.pct}% downtime (${p.downtime.sec}s) | ${p.downtime.total} casts\n`
}

function fmtProcEfficiency(name, seq, uptimes, nameMap) {
  let s = `${name}:\n`

  // Ice Lance efficiency
  const il = seq.iceLance
  if (il.total > 0) {
    const fofPct = Math.round(il.withFoF / il.total * 100)
    const wastePct = Math.round(il.wasted / il.total * 100)
    s += `  Ice Lance: ${il.total} casts — ${fofPct}% inside Fingers of Frost, ${wastePct}% wasted (no FoF, no Flurry shatter)\n`
  }

  // Brain Freeze Flurry efficiency
  const bf = seq.bfFlurry
  if (bf.total > 0) {
    const ilPct = Math.round(bf.withIceLance / bf.total * 100)
    s += `  Brain Freeze Flurry: ${bf.total} procs used — ${ilPct}% followed by Ice Lance (${bf.withoutIceLance} missed)\n`
  }

  // GS combo efficiency
  const gs = seq.gsCombo
  if (gs.total > 0) {
    const cleanPct = Math.round(gs.clean / gs.total * 100)
    s += `  Glacial Spike combo: ${gs.total} casts — ${cleanPct}% clean (GS→Flurry→IL), ${gs.partial} partial, ${gs.total - gs.clean - gs.partial} no combo\n`
  }

  return s
}

function fmtSequences(name, seq) {
  let s = `${name}:\n`
  const orb = seq.frozenOrb
  if (orb.casts.length > 0) {
    s += `  Frozen Orb: ${orb.casts.length} casts\n`
    s += `    With Icy Veins active: ${orb.orbsWithIcyVeins || 0}/${orb.casts.length}\n`
    s += `    Followed by Ray of Frost: ${orb.orbsWithRay || 0}/${orb.casts.length}\n`
    orb.casts.forEach((c, i) => {
      s += `    Cast ${i + 1}: ${c.t.toFixed(1)}s — IV:${c.icyVeinsActive ? 'yes' : 'no'} | Ray:${c.withRay ? 'yes' : 'no'} | NPC deaths at time: ${c.npcDeaths}\n`
    })
  }
  return s
}

function fmtOrbUsage(name, seq) {
  const orb = seq.frozenOrb
  if (!orb.casts.length) return `${name}: No Frozen Orb casts recorded\n`
  const ivAlign = Math.round((orb.orbsWithIcyVeins || 0) / orb.casts.length * 100)
  const rayAlign = Math.round((orb.orbsWithRay || 0) / orb.casts.length * 100)
  return `${name}: ${orb.casts.length} Orb casts — ${ivAlign}% with Icy Veins, ${rayAlign}% with Ray of Frost\n` +
    `  Timings: ${orb.casts.map(c => c.t.toFixed(1) + 's').join(', ')}\n`
}

function fmtAlterTime(name, seq) {
  const at = seq.alterTime
  if (!at.casts.length) return `${name}: No Alter Time casts\n`
  let s = `${name}: ${at.casts.length} Alter Time casts at: ${at.casts.map(t => t.toFixed(1) + 's').join(', ')}\n`
  at.contexts.forEach((c, i) => {
    s += `  Cast ${i + 1} at ${c.t.toFixed(1)}s: IV:${c.icyVeinsActive ? 'yes' : 'no'} | FoF:${c.fofStacks} stacks | BF:${c.brainFreezeActive ? 'yes' : 'no'}\n`
  })
  return s
}

function fmtIcyVeins(name, seq, windows) {
  const iv = seq.icyVeins
  let s = `${name}: ${iv.casts} Icy Veins casts`
  if (iv.casts > 0) {
    s += ` — with Orb: ${iv.withOrb}/${iv.casts} | with Potion: ${iv.withPotion}/${iv.casts}`
  }
  s += '\n'
  if (windows?.length) {
    s += `  Windows: ${windows.map(w => `${w.start.toFixed(1)}s-${w.end.toFixed(1)}s`).join(', ')}\n`
  }
  return s
}

function fmtPotion(name, seq) {
  const p = seq.potion
  if (!p.casts.length) return `${name}: No potion cast detected\n`
  let s = `${name}: Potion at ${p.casts.map(t => t.toFixed(1) + 's').join(', ')}\n`
  p.contexts.forEach(c => {
    s += `  At ${c.t.toFixed(1)}s: Icy Veins active: ${c.icyVeinsActive ? 'yes' : 'no'}\n`
  })
  return s
}
