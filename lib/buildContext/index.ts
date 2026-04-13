import {
  fmtOverall,
  fmtBuffUptimes,
  fmtCastDetails,
  fmtPotion,
} from './formatters'
import { getClassGuideSupplement } from '../knowledge/embeddedGuides'
import { getSimcAplSupplement } from '../knowledge/embeddedSimc'

interface KillStatus {
  isKill1: boolean
  isKill2: boolean
}

export type BuildRichContextOptions = KillStatus & {
  /** When true, include SimC default APL + opt-in framing (Frost Mage / spec 64 only for now). */
  simcGroundedAnalysis?: boolean
}

export function buildRichContext(p1: any, p2: any, talentDiff: any, options?: BuildRichContextOptions): string {
  const { name: n1, spec: s1 } = p1
  const { name: n2 } = p2
  const isKill1 = options?.isKill1 ?? true
  const isKill2 = options?.isKill2 ?? true
  const simcGrounded = options?.simcGroundedAnalysis === true

  let ctx = `You are an expert World of Warcraft raiding coach with deep knowledge of ${s1} mechanics in The War Within / Midnight Season 1.\n\n`
  ctx += `CRITICAL RULES:\n`
  ctx += `- Both players are ${s1} spec\n`
  ctx += `- Only reference spells that appear in the data below — never invent spell names\n`
  ctx += `- When explaining WHY something is better, reference the specific game state conditions (proc counts, buff windows, target counts) from the data\n`
  ctx += `- Do not give generic advice — every recommendation must be grounded in something specific you see in this data\n`
  ctx += `- ALWAYS link spell names to Wowhead using this exact format: [Spell Name](https://www.wowhead.com/spell=SPELL_ID)\n`
  ctx += `  Use the spell ID map below to get the correct IDs\n`
  ctx += `- Use your deep knowledge of ${s1} rotation, priorities, and cooldown alignment to interpret the raw cast and buff data below\n`
  ctx += `- Identify proc usage patterns, cooldown alignment, combo execution, and wasted opportunities from the cast-by-cast data\n\n`

  const guideExtra = getClassGuideSupplement(talentDiff?.specId)
  if (guideExtra) ctx += guideExtra

  const simcExtra = getSimcAplSupplement(talentDiff?.specId, simcGrounded, n1)
  if (simcExtra) ctx += simcExtra

  if (!isKill1 || !isKill2) {
    ctx += `=== FIGHT COMPLETION STATUS ===\n`
    ctx += `${n1}: ${isKill1 ? 'KILL ✓' : 'WIPE — fight ended early, late-phase data is unavailable'}\n`
    ctx += `${n2}: ${isKill2 ? 'KILL ✓' : 'WIPE — fight ended early, late-phase data is unavailable'}\n`
    ctx += `IMPORTANT: When one or both fights are wipes, do NOT critique late-fight cooldown usage or compare DPS at phases that didn't happen. Focus on: opener, early rotation (0-60s), mid-fight decisions, and patterns visible in the truncated data. Acknowledge the limitation when relevant.\n\n`
  }

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

  if (talentDiff?.t1 || talentDiff?.t2) {
    ctx += `=== TALENT DIFFERENCES ===\n`
    const ids1 = new Set((talentDiff.t1?.talentTree || talentDiff.t1?.talents || []).map((t: any) => t.id))
    const ids2 = new Set((talentDiff.t2?.talentTree || talentDiff.t2?.talents || []).map((t: any) => t.id))
    const all = new Map()
    ;(talentDiff.t1?.talentTree || talentDiff.t1?.talents || []).forEach((t: any) => all.set(t.id, t))
    ;(talentDiff.t2?.talentTree || talentDiff.t2?.talents || []).forEach((t: any) => { if (!all.has(t.id)) all.set(t.id, t) })
    const p1Only: any[] = [], p2Only: any[] = []
    all.forEach((t: any, id: any) => {
      if (ids1.has(id) && !ids2.has(id)) p1Only.push(t)
      if (ids2.has(id) && !ids1.has(id)) p2Only.push(t)
    })
    if (p1Only.length) ctx += `${n1} has but ${n2} does not:\n${p1Only.map((t: any) => `  - ${t.name} (spell ${t.id})`).join('\n')}\n`
    if (p2Only.length) ctx += `${n2} has but ${n1} does not:\n${p2Only.map((t: any) => `  - ${t.name} (spell ${t.id})`).join('\n')}\n`
    if (!p1Only.length && !p2Only.length) ctx += `Identical talent builds.\n`
    ctx += '\n'
  }

  ctx += `FIGHT: ${p1.boss}\n`
  ctx += `${n1} (seeking improvement) vs ${n2} (comparison player)\n\n`

  ctx += `=== OVERALL ===\n`
  ctx += fmtOverall(p1)
  ctx += fmtOverall(p2)
  ctx += '\n'

  ctx += `=== OPENER (first 20s) ===\n`
  ctx += `${n1}: ${p1.opener.map((c: any) => `${c.name}@${c.at}s`).join(' → ')}\n`
  ctx += `${n2}: ${p2.opener.map((c: any) => `${c.name}@${c.at}s`).join(' → ')}\n\n`

  ctx += `=== SPELL USAGE (casts/min) ===\n`
  ctx += `${'Spell'.padEnd(30)} ${n1.padEnd(12)} ${n2.padEnd(12)} Diff   First cast timing\n`
  ctx += `${'-'.repeat(80)}\n`
  p1.spellRows.filter((r: any) => r.ppm1 > 0 || r.ppm2 > 0).forEach((r: any) => {
    const diff = r.ppm2 > 0 ? (((r.ppm1 - r.ppm2) / r.ppm2) * 100).toFixed(0) : null
    const ds = diff === null ? 'one player' : (Number(diff) >= 0 ? '+' : '') + diff + '%'
    const ft = r.first1 !== null && r.first2 !== null && Math.abs(r.first1 - r.first2) > 1.5 ? `  [first: ${r.first1}s vs ${r.first2}s]` : ''
    ctx += `${(r.name || '').slice(0, 28).padEnd(30)} ${String(r.ppm1).padEnd(12)} ${String(r.ppm2).padEnd(12)} ${ds}${ft}\n`
  })
  ctx += '\n'

  ctx += `=== DOWNTIME ===\n`
  ctx += `${n1}: ${p1.downtime.pct}% (${p1.downtime.sec}s) — biggest gaps: ${p1.downtime.wins.map((w: any) => w.g + 's').join(', ') || 'none'}\n`
  ctx += `${n2}: ${p2.downtime.pct}% (${p2.downtime.sec}s) — biggest gaps: ${p2.downtime.wins.map((w: any) => w.g + 's').join(', ') || 'none'}\n\n`

  ctx += `=== BUFF UPTIMES ===\n`
  ctx += fmtBuffUptimes(n1, p1.uptimes, p1.nameMap)
  ctx += '\n'
  ctx += fmtBuffUptimes(n2, p2.uptimes, p2.nameMap)
  ctx += '\n'

  ctx += `=== CAST-BY-CAST DETAILS (with active buffs at each cast) ===\n`
  ctx += fmtCastDetails(n1, p1.annotated)
  ctx += '\n'
  ctx += fmtCastDetails(n2, p2.annotated)
  ctx += '\n'

  ctx += `=== POTION USAGE ===\n`
  ctx += fmtPotion(n1, p1.annotated)
  ctx += fmtPotion(n2, p2.annotated)
  ctx += '\n'

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
  ctx += `2. WHY it matters mechanically (how it affects damage, proc generation, burst windows)\n`
  ctx += `3. WHEN to make the decision differently (the specific game state conditions)\n`
  ctx += `4. HOW to fix it practically (what to look for and change)\n`
  ctx += `Always link spell names using [Spell Name](https://www.wowhead.com/spell=ID) format.\n`
  ctx += `Use ### headers. Be specific — no generic advice.\n`

  return ctx
}

export type BuildPlayerOneContextOptions = {
  isKill1: boolean
  simcGroundedAnalysis?: boolean
}

/** Rich context for player 1 only (solo coaching, no vs-partner data). */
export function buildRichContextPlayerOne(p1: any, talentDiff: any, options: BuildPlayerOneContextOptions): string {
  const { name: n1, spec: s1 } = p1
  const isKill1 = options.isKill1
  const simcGrounded = options.simcGroundedAnalysis === true

  let ctx = `You are an expert World of Warcraft raiding coach with deep knowledge of ${s1} mechanics in The War Within / Midnight Season 1.\n\n`
  ctx += `CRITICAL RULES:\n`
  ctx += `- You are reviewing ONE player (${n1}, ${s1}) — there is no second player in this session\n`
  ctx += `- Only reference spells that appear in the data below — never invent spell names\n`
  ctx += `- Ground every recommendation in specific data from this log\n`
  ctx += `- ALWAYS link spell names: [Spell Name](https://www.wowhead.com/spell=SPELL_ID) using the spell ID map\n\n`

  const guideExtra = getClassGuideSupplement(talentDiff?.specId)
  if (guideExtra) ctx += guideExtra

  const simcExtra = getSimcAplSupplement(talentDiff?.specId, simcGrounded, n1)
  if (simcExtra) ctx += simcExtra

  if (!isKill1) {
    ctx += `=== FIGHT COMPLETION STATUS ===\n`
    ctx += `${n1}: WIPE — fight ended early, late-phase data is unavailable\n`
    ctx += `Focus on opener, early rotation (0–60s), and patterns visible in the truncated data.\n\n`
  }

  ctx += `=== SPELL ID MAP ===\n`
  const soloSpells = new Set<string>()
  p1.spellRows?.forEach((r: any) => soloSpells.add(JSON.stringify({ id: r.id, name: r.name })))
  for (const s of soloSpells) {
    try {
      const { id, name } = JSON.parse(s) as { id: string; name: string }
      if (name && !name.startsWith('Spell ')) ctx += `${name}: spell ID ${id} → https://www.wowhead.com/spell=${id}\n`
    } catch {
      /* ignore */
    }
  }
  ctx += '\n'

  if (talentDiff?.t1) {
    ctx += `=== TALENT BUILD (${n1}) ===\n`
    const nodes = talentDiff.t1?.talentTree || talentDiff.t1?.talents || []
    if (nodes.length) {
      nodes.forEach((t: any) => {
        ctx += `  - ${t.name} (spell ${t.spellId ?? t.id})\n`
      })
    } else {
      ctx += `  (no talent tree rows in data)\n`
    }
    ctx += '\n'
  }

  ctx += `FIGHT: ${p1.boss}\nPlayer: ${n1} (${s1})\n\n`

  ctx += `=== OVERALL ===\n${fmtOverall(p1)}\n`

  ctx += `=== OPENER (first 20s) ===\n${n1}: ${p1.opener.map((c: any) => `${c.name}@${c.at}s`).join(' → ')}\n\n`

  ctx += `=== SPELL USAGE (casts/min) ===\n${'Spell'.padEnd(30)} ${n1.padEnd(12)}\n${'-'.repeat(50)}\n`
  p1.spellRows.filter((r: any) => r.ppm1 > 0).forEach((r: any) => {
    ctx += `${(r.name || '').slice(0, 28).padEnd(30)} ${String(r.ppm1).padEnd(12)}\n`
  })
  ctx += '\n'

  ctx += `=== DOWNTIME ===\n${n1}: ${p1.downtime.pct}% (${p1.downtime.sec}s) — gaps: ${p1.downtime.wins.map((w: any) => w.g + 's').join(', ') || 'none'}\n\n`

  ctx += `=== BUFF UPTIMES ===\n${fmtBuffUptimes(n1, p1.uptimes, p1.nameMap)}\n`

  ctx += `=== CAST-BY-CAST ===\n${fmtCastDetails(n1, p1.annotated)}\n`

  ctx += `=== POTION ===\n${fmtPotion(n1, p1.annotated)}\n`

  ctx += `=== CAST TIMESTAMPS (key spells) ===\n`
  p1.spellRows.filter((r: any) => r.ppm1 > 0.3).slice(0, 10).forEach((r: any) => {
    ctx += `${r.name}:\n  ${n1}: [${r.ts1.slice(0, 15).join(', ')}]\n`
  })
  ctx += '\nUse ### headers. Be specific — no generic advice.\n'

  return ctx
}

