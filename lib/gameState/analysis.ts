interface AnnotateContext {
  getStateAt: (t: number) => Record<number, number>
  getDamageAfterCast: (spellId: number, castTime: number, windowSec?: number) => any[]
  getNPCDeathsBy: (t: number) => number
  fightStart: number
  nameMap: Record<number, string>
}

/**
 * Annotate each cast with full game state at that moment.
 * Returns generic buff/damage data — no spec-specific fields.
 */
export function annotateCasts(casts: any[], ctx: AnnotateContext) {
  const { getStateAt, getDamageAfterCast, getNPCDeathsBy, fightStart, nameMap } = ctx

  return casts.map((cast: any) => {
    const t = (cast.timestamp - fightStart) / 1000
    const id = cast.abilityGameID
    const name = nameMap[id] || cast.ability?.name || `Spell ${id}`
    const state = getStateAt(t)
    const damageHits = getDamageAfterCast(id, t, 3)
    const npcDeathsSoFar = getNPCDeathsBy(t)

    const activeBuffs: Record<number, { name: string; stacks: number }> = {}
    for (const [buffId, stacks] of Object.entries(state)) {
      const numId = Number(buffId)
      activeBuffs[numId] = { name: nameMap[numId] || `Buff ${numId}`, stacks }
    }

    const hitsCrit = damageHits.some((h: any) => h.crit)
    const hitsCount = damageHits.length
    const totalDamage = damageHits.reduce((s: number, h: any) => s + h.amount, 0)

    return {
      t, id, name,
      activeBuffs,
      npcDeathsSoFar,
      hitsCrit, hitsCount, totalDamage, damageHits,
    }
  })
}
