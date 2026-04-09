import {
  FOF_IDS, BF_IDS, IV_IDS, WC_IDS,
  GLACIAL_SPIKE_IDS, FLURRY_IDS, ICE_LANCE_IDS,
  FROZEN_ORB_IDS, RAY_OF_FROST_IDS, ICY_VEINS_IDS,
  ALTER_TIME_IDS, POTION_IDS,
} from './constants'

function hasAny(state: Record<number, number>, ids: number[]): boolean {
  return ids.some((id) => state[id] != null && state[id] > 0)
}

function getStacksOfAny(state: Record<number, number>, ids: number[]): number {
  for (const id of ids) {
    if (state[id] != null) return state[id]
  }
  return 0
}

interface AnnotateContext {
  getStateAt: (t: number) => Record<number, number>
  getDamageAfterCast: (spellId: number, castTime: number, windowSec?: number) => any[]
  getNPCDeathsBy: (t: number) => number
  fightStart: number
  nameMap: Record<number, string>
}

/**
 * Annotate each cast with full game state at that moment.
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

    const fofStacks = getStacksOfAny(state, FOF_IDS)
    const brainFreezeActive = hasAny(state, BF_IDS)
    const icyVeinsActive = hasAny(state, IV_IDS)
    const winterChillStacks = getStacksOfAny(state, WC_IDS)

    const hitsCrit = damageHits.some((h: any) => h.crit)
    const hitsCount = damageHits.length
    const totalDamage = damageHits.reduce((s: number, h: any) => s + h.amount, 0)

    return {
      t, id, name,
      state: {
        fofStacks, brainFreezeActive, icyVeinsActive, winterChillStacks, npcDeathsSoFar,
        activeBuffIds: Object.keys(state).map(Number),
      },
      hitsCrit, hitsCount, totalDamage, damageHits,
    }
  })
}

function isSpell(cast: any, ids: number[], nameParts?: string[]): boolean {
  if (ids.includes(cast.id)) return true
  if (nameParts && cast.name) {
    const n = cast.name.toLowerCase()
    return nameParts.some((p) => n.includes(p.toLowerCase()))
  }
  return false
}

/**
 * Detect combo sequences in annotated casts.
 */
export function detectSequences(annotatedCasts: any[], dur: number) {
  const sequences: any = {
    gsCombo: { total: 0, clean: 0, partial: 0 },
    bfFlurry: { total: 0, withIceLance: 0, withoutIceLance: 0 },
    iceLance: { total: 0, withFoF: 0, withoutFoF: 0, wasted: 0 },
    orbRayAlign: { orbCasts: 0, withRay: 0 },
    icyVeins: { casts: 0, withOrb: 0, withPotion: 0, withRay: 0 },
    frozenOrb: { casts: [] as any[], avgTargetsOnCast: 0 },
    alterTime: { casts: [] as number[], contexts: [] as any[] },
    potion: { casts: [] as number[], contexts: [] as any[] },
    procWaste: { fofExpired: 0, bfExpired: 0 },
  }

  const withinSec = (a: any, b: any, sec: number) => b && Math.abs(b.t - a.t) <= sec

  annotatedCasts.forEach((cast: any, i: number) => {
    const next = annotatedCasts[i + 1]
    const next2 = annotatedCasts[i + 2]

    if (isSpell(cast, ICE_LANCE_IDS, ['Ice Lance'])) {
      sequences.iceLance.total++
      if (cast.state.fofStacks > 0) {
        sequences.iceLance.withFoF++
      } else {
        sequences.iceLance.withoutFoF++
        const prevCast = annotatedCasts[i - 1]
        const isFlurryShatter = prevCast && isSpell(prevCast, FLURRY_IDS, ['Flurry']) && withinSec(prevCast, cast, 1.5)
        if (!isFlurryShatter) sequences.iceLance.wasted++
      }
    }

    if (isSpell(cast, FLURRY_IDS, ['Flurry'])) {
      if (cast.state.brainFreezeActive) {
        sequences.bfFlurry.total++
        const hasIL = next && isSpell(next, ICE_LANCE_IDS, ['Ice Lance']) && withinSec(cast, next, 1.5)
        if (hasIL) sequences.bfFlurry.withIceLance++
        else sequences.bfFlurry.withoutIceLance++
      }
    }

    if (isSpell(cast, [], ['Glacial Spike'])) {
      sequences.gsCombo.total++
      const hasFlurry = next && isSpell(next, FLURRY_IDS, ['Flurry']) && withinSec(cast, next, 3)
      const hasIL = hasFlurry && next2 && isSpell(next2, ICE_LANCE_IDS, ['Ice Lance']) && withinSec(next, next2, 1.5)
      if (hasFlurry && hasIL) sequences.gsCombo.clean++
      else if (hasFlurry) sequences.gsCombo.partial++
    }

    if (isSpell(cast, FROZEN_ORB_IDS, ['Frozen Orb'])) {
      sequences.frozenOrb.casts.push({
        t: cast.t,
        icyVeinsActive: cast.state.icyVeinsActive,
        npcDeaths: cast.state.npcDeathsSoFar,
        withRay: annotatedCasts.slice(i + 1).some((c: any) => isSpell(c, RAY_OF_FROST_IDS, ['Ray of Frost']) && c.t - cast.t <= 15),
      })
      sequences.icyVeins.withOrb += cast.state.icyVeinsActive ? 1 : 0
    }

    if (isSpell(cast, RAY_OF_FROST_IDS, ['Ray of Frost'])) {
      const recentOrb = annotatedCasts.slice(0, i).reverse().find((c: any) => isSpell(c, FROZEN_ORB_IDS, ['Frozen Orb']))
      const orbActive = recentOrb && cast.t - recentOrb.t <= 10
      sequences.orbRayAlign.orbCasts = sequences.frozenOrb.casts.length
      if (orbActive) sequences.orbRayAlign.withRay++
    }

    if (isSpell(cast, ICY_VEINS_IDS, ['Icy Veins'])) {
      sequences.icyVeins.casts++
      const nearOrb = annotatedCasts.some((c: any) => isSpell(c, FROZEN_ORB_IDS, ['Frozen Orb']) && Math.abs(c.t - cast.t) <= 5)
      if (nearOrb) sequences.icyVeins.withOrb++
      const nearPotion = annotatedCasts.some((c: any) => POTION_IDS.includes(c.id) && Math.abs(c.t - cast.t) <= 5)
      if (nearPotion) sequences.icyVeins.withPotion++
    }

    if (isSpell(cast, ALTER_TIME_IDS, ['Alter Time'])) {
      sequences.alterTime.casts.push(cast.t)
      sequences.alterTime.contexts.push({
        t: cast.t,
        icyVeinsActive: cast.state.icyVeinsActive,
        fofStacks: cast.state.fofStacks,
        brainFreezeActive: cast.state.brainFreezeActive,
      })
    }

    if (POTION_IDS.includes(cast.id) || (cast.name && cast.name.toLowerCase().includes('potion'))) {
      sequences.potion.casts.push(cast.t)
      sequences.potion.contexts.push({
        t: cast.t,
        icyVeinsActive: cast.state.icyVeinsActive,
      })
    }
  })

  if (sequences.frozenOrb.casts.length > 0) {
    sequences.frozenOrb.orbsWithIcyVeins = sequences.frozenOrb.casts.filter((c: any) => c.icyVeinsActive).length
    sequences.frozenOrb.orbsWithRay = sequences.frozenOrb.casts.filter((c: any) => c.withRay).length
  }

  return sequences
}
