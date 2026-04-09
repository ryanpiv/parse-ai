/**
 * buildContext
 *
 * Takes two fully-analyzed fight datasets and builds a rich context string
 * for Claude that explains not just WHAT each player did, but the game state
 * conditions under which they did it.
 */

import {
  fmtAlterTime,
  fmtIcyVeins,
  fmtOrbUsage,
  fmtOverall,
  fmtPotion,
  fmtProcEfficiency,
  fmtSequences,
} from './formatters'

export function buildRichContext(p1: any, p2: any, talentDiff: any): string {
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
  p1.spellRows?.forEach((r: any) => allSpells.add(JSON.stringify({ id: r.id, name: r.name })))
  ;[...allSpells].forEach((s) => {
    try {
      const { id, name } = JSON.parse(s as string)
      if (name && !name.startsWith('Spell ')) ctx += `${name}: spell ID ${id} → https://www.wowhead.com/spell=${id}\n`
    } catch {}
  })
  ctx += '\n'

  // Talent diff section
  if (talentDiff?.t1 || talentDiff?.t2) {
    ctx += `=== TALENT DIFFERENCES ===\n`
    const ids1 = new Set((talentDiff.t1?.talents || []).map((t: any) => t.id))
    const ids2 = new Set((talentDiff.t2?.talents || []).map((t: any) => t.id))
    const all = new Map()
    ;(talentDiff.t1?.talents || []).forEach((t: any) => all.set(t.id, t))
    ;(talentDiff.t2?.talents || []).forEach((t: any) => {
      if (!all.has(t.id)) all.set(t.id, t)
    })
    const p1Only: any[] = [],
      p2Only: any[] = []
    all.forEach((t: any, id: any) => {
      if (ids1.has(id) && !ids2.has(id)) p1Only.push(t)
      if (ids2.has(id) && !ids1.has(id)) p2Only.push(t)
    })
    if (p1Only.length) ctx += `${n1} has but ${n2} does not:\n${p1Only.map((t: any) => `  - ${t.name} (spell ${t.guid || t.id})`).join('\n')}\n`
    if (p2Only.length) ctx += `${n2} has but ${n1} does not:\n${p2Only.map((t: any) => `  - ${t.name} (spell ${t.guid || t.id})`).join('\n')}\n`
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
  ctx += `${n1}: ${p1.opener.map((c: any) => `${c.name}@${c.at}s`).join(' → ')}\n`
  ctx += `${n2}: ${p2.opener.map((c: any) => `${c.name}@${c.at}s`).join(' → ')}\n\n`

  // ── SPELL USAGE ──
  ctx += `=== SPELL USAGE (casts/min) ===\n`
  ctx += `${'Spell'.padEnd(30)} ${n1.padEnd(12)} ${n2.padEnd(12)} Diff   First cast timing\n`
  ctx += `${'-'.repeat(80)}\n`
  p1.spellRows.filter((r: any) => r.ppm1 > 0 || r.ppm2 > 0).forEach((r: any) => {
    const diff = r.ppm2 > 0 ? (((r.ppm1 - r.ppm2) / r.ppm2) * 100).toFixed(0) : null
    const ds =
      diff === null ? 'one player' : (Number(diff) >= 0 ? '+' : '') + diff + '%'
    const ft =
      r.first1 !== null && r.first2 !== null && Math.abs(r.first1 - r.first2) > 1.5
        ? `  [first: ${r.first1}s vs ${r.first2}s]`
        : ''
    ctx += `${(r.name || '').slice(0, 28).padEnd(30)} ${String(r.ppm1).padEnd(12)} ${String(r.ppm2).padEnd(12)} ${ds}${ft}\n`
  })
  ctx += '\n'

  // ── DOWNTIME ──
  ctx += `=== DOWNTIME ===\n`
  ctx += `${n1}: ${p1.downtime.pct}% (${p1.downtime.sec}s) — biggest gaps: ${p1.downtime.wins.map((w: any) => w.g + 's').join(', ') || 'none'}\n`
  ctx += `${n2}: ${p2.downtime.pct}% (${p2.downtime.sec}s) — biggest gaps: ${p2.downtime.wins.map((w: any) => w.g + 's').join(', ') || 'none'}\n\n`

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
  p1.spellRows.filter((r: any) => r.ppm1 > 0.3 || r.ppm2 > 0.3).slice(0, 10).forEach((r: any) => {
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
