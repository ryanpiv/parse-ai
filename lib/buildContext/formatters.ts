export function fmtOverall(p: any): string {
  const m = Math.floor(p.dur / 60),
    s = String(Math.round(p.dur % 60)).padStart(2, '0')
  return `${p.name}: ${p.dps?.toLocaleString() || '?'} DPS | ${m}:${s} | ${p.downtime.cpm} casts/min | ${p.downtime.pct}% downtime (${p.downtime.sec}s) | ${p.downtime.total} casts\n`
}

export function fmtProcEfficiency(
  name: string,
  seq: any,
  uptimes: any,
  nameMap: any
): string {
  let s = `${name}:\n`

  // Ice Lance efficiency
  const il = seq.iceLance
  if (il.total > 0) {
    const fofPct = Math.round((il.withFoF / il.total) * 100)
    const wastePct = Math.round((il.wasted / il.total) * 100)
    s += `  Ice Lance: ${il.total} casts — ${fofPct}% inside Fingers of Frost, ${wastePct}% wasted (no FoF, no Flurry shatter)\n`
  }

  // Brain Freeze Flurry efficiency
  const bf = seq.bfFlurry
  if (bf.total > 0) {
    const ilPct = Math.round((bf.withIceLance / bf.total) * 100)
    s += `  Brain Freeze Flurry: ${bf.total} procs used — ${ilPct}% followed by Ice Lance (${bf.withoutIceLance} missed)\n`
  }

  // GS combo efficiency
  const gs = seq.gsCombo
  if (gs.total > 0) {
    const cleanPct = Math.round((gs.clean / gs.total) * 100)
    s += `  Glacial Spike combo: ${gs.total} casts — ${cleanPct}% clean (GS→Flurry→IL), ${gs.partial} partial, ${gs.total - gs.clean - gs.partial} no combo\n`
  }

  return s
}

export function fmtSequences(name: string, seq: any): string {
  let s = `${name}:\n`
  const orb = seq.frozenOrb
  if (orb.casts.length > 0) {
    s += `  Frozen Orb: ${orb.casts.length} casts\n`
    s += `    With Icy Veins active: ${orb.orbsWithIcyVeins || 0}/${orb.casts.length}\n`
    s += `    Followed by Ray of Frost: ${orb.orbsWithRay || 0}/${orb.casts.length}\n`
    orb.casts.forEach((c: any, i: number) => {
      s += `    Cast ${i + 1}: ${c.t.toFixed(1)}s — IV:${c.icyVeinsActive ? 'yes' : 'no'} | Ray:${c.withRay ? 'yes' : 'no'} | NPC deaths at time: ${c.npcDeaths}\n`
    })
  }
  return s
}

export function fmtOrbUsage(name: string, seq: any): string {
  const orb = seq.frozenOrb
  if (!orb.casts.length) return `${name}: No Frozen Orb casts recorded\n`
  const ivAlign = Math.round(((orb.orbsWithIcyVeins || 0) / orb.casts.length) * 100)
  const rayAlign = Math.round(((orb.orbsWithRay || 0) / orb.casts.length) * 100)
  return (
    `${name}: ${orb.casts.length} Orb casts — ${ivAlign}% with Icy Veins, ${rayAlign}% with Ray of Frost\n` +
    `  Timings: ${orb.casts.map((c: any) => c.t.toFixed(1) + 's').join(', ')}\n`
  )
}

export function fmtAlterTime(name: string, seq: any): string {
  const at = seq.alterTime
  if (!at.casts.length) return `${name}: No Alter Time casts\n`
  let s = `${name}: ${at.casts.length} Alter Time casts at: ${at.casts.map((t: number) => t.toFixed(1) + 's').join(', ')}\n`
  at.contexts.forEach((c: any, i: number) => {
    s += `  Cast ${i + 1} at ${c.t.toFixed(1)}s: IV:${c.icyVeinsActive ? 'yes' : 'no'} | FoF:${c.fofStacks} stacks | BF:${c.brainFreezeActive ? 'yes' : 'no'}\n`
  })
  return s
}

export function fmtIcyVeins(name: string, seq: any, windows: any): string {
  const iv = seq.icyVeins
  let s = `${name}: ${iv.casts} Icy Veins casts`
  if (iv.casts > 0) {
    s += ` — with Orb: ${iv.withOrb}/${iv.casts} | with Potion: ${iv.withPotion}/${iv.casts}`
  }
  s += '\n'
  if (windows?.length) {
    s += `  Windows: ${windows.map((w: any) => `${w.start.toFixed(1)}s-${w.end.toFixed(1)}s`).join(', ')}\n`
  }
  return s
}

export function fmtPotion(name: string, seq: any): string {
  const p = seq.potion
  if (!p.casts.length) return `${name}: No potion cast detected\n`
  let s = `${name}: Potion at ${p.casts.map((t: number) => t.toFixed(1) + 's').join(', ')}\n`
  p.contexts.forEach((c: any) => {
    s += `  At ${c.t.toFixed(1)}s: Icy Veins active: ${c.icyVeinsActive ? 'yes' : 'no'}\n`
  })
  return s
}
