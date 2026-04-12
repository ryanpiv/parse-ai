export function fmtOverall(p: any): string {
  const m = Math.floor(p.dur / 60),
    s = String(Math.round(p.dur % 60)).padStart(2, '0')
  return `${p.name}: ${p.dps?.toLocaleString() || '?'} DPS | ${m}:${s} | ${p.downtime.cpm} casts/min | ${p.downtime.pct}% downtime (${p.downtime.sec}s) | ${p.downtime.total} casts\n`
}

export function fmtBuffUptimes(name: string, uptimes: Record<number, number>, nameMap: Record<number, string>): string {
  const entries = Object.entries(uptimes)
    .map(([id, pct]) => ({ id: Number(id), name: nameMap[Number(id)] || `Buff ${id}`, pct: pct as number }))
    .filter(e => e.pct > 0 && !e.name.startsWith('Buff '))
    .sort((a, b) => b.pct - a.pct)

  if (!entries.length) return `${name}: No significant buff uptimes recorded\n`

  let s = `${name}:\n`
  entries.forEach(e => {
    s += `  ${e.name} (spell ${e.id}): ${e.pct}% uptime\n`
  })
  return s
}

export function fmtCastDetails(name: string, annotated: any[], limit = 60): string {
  if (!annotated.length) return `${name}: No casts recorded\n`

  let s = `${name} — ${annotated.length} total casts (showing first ${Math.min(limit, annotated.length)}):\n`
  annotated.slice(0, limit).forEach((c: any) => {
    const buffNames = Object.values(c.activeBuffs || {})
      .map((b: any) => b.stacks > 1 ? `${b.name}(${b.stacks})` : b.name)
      .filter((n: string) => !n.startsWith('Buff '))
    const buffStr = buffNames.length ? ` [buffs: ${buffNames.join(', ')}]` : ''
    const dmgStr = c.totalDamage > 0 ? ` → ${c.totalDamage.toLocaleString()} dmg${c.hitsCrit ? ' (crit)' : ''}` : ''
    s += `  ${c.t.toFixed(1)}s: ${c.name} (${c.id})${dmgStr}${buffStr}\n`
  })
  return s
}

export function fmtPotion(name: string, annotated: any[]): string {
  const potionCasts = annotated.filter((c: any) =>
    c.name && c.name.toLowerCase().includes('potion')
  )
  if (!potionCasts.length) return `${name}: No potion cast detected\n`

  let s = `${name}: Potion at ${potionCasts.map((c: any) => c.t.toFixed(1) + 's').join(', ')}\n`
  potionCasts.forEach((c: any) => {
    const buffNames = Object.values(c.activeBuffs || {})
      .map((b: any) => b.name)
      .filter((n: string) => !n.startsWith('Buff '))
    s += `  At ${c.t.toFixed(1)}s: active buffs: ${buffNames.join(', ') || 'none'}\n`
  })
  return s
}
