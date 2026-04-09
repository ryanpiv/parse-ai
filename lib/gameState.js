/**
 * gameState.js
 *
 * Takes raw events and builds:
 * 1. A timeline of active buffs/debuffs/procs at any given timestamp
 * 2. Each cast annotated with the full game state at that moment
 * 3. Sequence detection (combos like GS->Flurry->IL, Orb->RoF, etc.)
 * 4. Target count at any moment (from NPC deaths)
 * 5. Proc efficiency metrics
 */

// Spell IDs we care about for Frost Mage analysis
// These are the key procs, cooldowns, and debuffs
const KNOWN_SPELLS = {
  // Procs / buffs on player
  190446: 'Fingers of Frost',
  44544:  'Fingers of Frost',  // alternate ID
  57761:  'Brain Freeze',
  228358: 'Brain Freeze',      // alternate
  382252: 'Icy Veins',
  12472:  'Icy Veins',
  235219: 'Cold Front',
  198144: 'Ice Form',
  382297: 'Slick Ice',
  414660: 'Thermal Void',
  281711: 'Glacial Spike (proc)',
  199786: 'Arcane Intellect',  // will be overridden by real name
  // Debuffs on target
  228358: 'Winter\'s Chill',
  205473: 'Winters Chill',
  44572:  'Deep Freeze',
  112948: 'Frozen',
  // Cooldowns
  84714:  'Frozen Orb',
  401490: 'Ray of Frost',
  116011: 'Rune of Power',
  55342:  'Mirror Image',
  80353:  'Time Warp',
  342246: 'Alter Time',
  // Potions / consumables
  307162: 'Potion of Spectral Intellect',
  371028: 'Elemental Potion of Power',
  383953: 'Elemental Potion of Ultimate Power',
  432923: 'Tempered Potion',
  // Generic
  26297:  'Blink',
}

/**
 * Build a state tracker from buff/debuff events.
 * Returns a function getStateAt(timestamp) -> { activeBuffs, activeDebuffs }
 */
export function buildStateTracker(buffEvents, debuffEvents, fightStart) {
  // Track buff windows: { spellId -> [{ start, end, stacks }] }
  const buffWindows = {}
  const activeAtTime = {}  // spellId -> { start, stacks }

  const allEvents = [
    ...buffEvents.map(e => ({ ...e, _type: 'buff' })),
    ...debuffEvents.map(e => ({ ...e, _type: 'debuff' })),
  ].sort((a, b) => a.timestamp - b.timestamp)

  allEvents.forEach(ev => {
    const id = ev.abilityGameID
    const t = (ev.timestamp - fightStart) / 1000
    const type = ev.type  // applybuff, removebuff, applybuffstack, etc.

    if (!buffWindows[id]) buffWindows[id] = []

    if (type === 'applybuff' || type === 'applydebuff') {
      activeAtTime[id] = { start: t, stacks: 1 }
    } else if (type === 'applybuffstack' || type === 'applydebuffstack') {
      if (activeAtTime[id]) {
        activeAtTime[id].stacks = ev.stack || (activeAtTime[id].stacks + 1)
      } else {
        activeAtTime[id] = { start: t, stacks: ev.stack || 1 }
      }
    } else if (type === 'removebuffstack' || type === 'removedebuffstack') {
      if (activeAtTime[id]) {
        activeAtTime[id].stacks = ev.stack || Math.max(0, activeAtTime[id].stacks - 1)
      }
    } else if (type === 'removebuff' || type === 'removedebuff') {
      if (activeAtTime[id]) {
        buffWindows[id].push({ start: activeAtTime[id].start, end: t, stacks: activeAtTime[id].stacks })
        delete activeAtTime[id]
      }
    }
  })

  // Close any still-active buffs at end of fight
  Object.entries(activeAtTime).forEach(([id, state]) => {
    if (!buffWindows[id]) buffWindows[id] = []
    buffWindows[id].push({ start: state.start, end: 99999, stacks: state.stacks })
  })

  // getStateAt returns all active buffs/debuffs at a given fight-relative timestamp
  function getStateAt(t) {
    const active = {}
    Object.entries(buffWindows).forEach(([id, windows]) => {
      for (const w of windows) {
        if (t >= w.start && t <= w.end) {
          active[id] = w.stacks
          break
        }
      }
    })
    return active
  }

  return { getStateAt, buffWindows }
}

/**
 * Build target count timeline from death events.
 * Returns getTargetCountAt(timestamp) -> number
 */
export function buildTargetTracker(deathEvents, fightStart) {
  // Only count NPC deaths (not player deaths)
  const npcDeaths = deathEvents
    .filter(ev => ev.type === 'death' && ev.targetIsFriendly === false)
    .map(ev => (ev.timestamp - fightStart) / 1000)
    .sort((a, b) => a - b)

  // We don't know exact spawn times, but we can track deaths
  // Assumption: fights start with some base target count, decreases as NPCs die
  // This gives us "at this point in the fight, X NPCs had died"
  function getNPCDeathsBy(t) {
    return npcDeaths.filter(d => d <= t).length
  }

  return { getNPCDeathsBy, npcDeaths }
}

/**
 * Build damage lookup: for each cast, find the resulting damage event(s)
 * within a short window to detect crits, multitarget hits, etc.
 */
export function buildDamageLookup(damageEvents, fightStart) {
  const bySpell = {}
  damageEvents.forEach(ev => {
    if (ev.type !== 'damage') return
    const id = ev.abilityGameID
    if (!bySpell[id]) bySpell[id] = []
    bySpell[id].push({
      t: (ev.timestamp - fightStart) / 1000,
      amount: ev.amount || 0,
      crit: ev.hitType === 2,        // hitType 2 = crit
      targetID: ev.targetID,
      absorbed: ev.absorbed || 0,
      overkill: ev.overkill || 0,
    })
  })

  // Get all damage hits for a spell within a time window after a cast
  function getDamageAfterCast(spellId, castTime, windowSec = 3) {
    const hits = bySpell[spellId] || []
    return hits.filter(h => h.t >= castTime && h.t <= castTime + windowSec)
  }

  // Get crit rate for a spell
  function getCritRate(spellId) {
    const hits = bySpell[spellId] || []
    if (!hits.length) return null
    return hits.filter(h => h.crit).length / hits.length
  }

  return { getDamageAfterCast, getCritRate, bySpell }
}

/**
 * Annotate each cast with full game state at that moment.
 * This is the core function that enriches cast data.
 */
export function annotateCasts(casts, { getStateAt, getDamageAfterCast, getNPCDeathsBy, fightStart, nameMap }) {
  return casts.map(cast => {
    const t = (cast.timestamp - fightStart) / 1000
    const id = cast.abilityGameID
    const name = nameMap[id] || cast.ability?.name || `Spell ${id}`
    const state = getStateAt(t)
    const damageHits = getDamageAfterCast(id, t, 3)
    const npcDeathsSoFar = getNPCDeathsBy(t)

    // Key procs active at cast time
    const fofStacks = getStacksOfAny(state, [190446, 44544, 44545])
    const brainFreezeActive = hasAny(state, [57761, 228358])
    const icyVeinsActive = hasAny(state, [12472, 382252])
    const winterChillStacks = getStacksOfAny(state, [228358, 205473])

    // Did this cast crit? (Shatter = guaranteed crit when target frozen)
    const hitsCrit = damageHits.some(h => h.crit)
    const hitsCount = damageHits.length  // number of targets hit
    const totalDamage = damageHits.reduce((s, h) => s + h.amount, 0)

    return {
      t,
      id,
      name,
      // Game state at cast time
      state: {
        fofStacks,
        brainFreezeActive,
        icyVeinsActive,
        winterChillStacks,
        npcDeathsSoFar,
        activeBuffIds: Object.keys(state).map(Number),
      },
      // Outcome
      hitsCrit,
      hitsCount,
      totalDamage,
      damageHits,
    }
  })
}

function hasAny(state, ids) {
  return ids.some(id => state[id] != null && state[id] > 0)
}

function getStacksOfAny(state, ids) {
  for (const id of ids) {
    if (state[id] != null) return state[id]
  }
  return 0
}

/**
 * Detect combo sequences in annotated casts.
 * Looks for patterns like:
 * - Glacial Spike -> Flurry -> Ice Lance (the GS combo)
 * - Frozen Orb -> Ray of Frost
 * - Flurry -> Ice Lance (Brain Freeze proc usage)
 * - Ice Lance without Fingers of Frost (wasted FoF window)
 */
export function detectSequences(annotatedCasts, dur) {
  const sequences = {
    // Glacial Spike -> Flurry -> Ice Lance
    gsCombo: { total: 0, clean: 0, partial: 0 },
    // Brain Freeze Flurry -> Ice Lance
    bfFlurry: { total: 0, withIceLance: 0, withoutIceLance: 0 },
    // Ice Lance usage
    iceLance: { total: 0, withFoF: 0, withoutFoF: 0, wasted: 0 },
    // Frozen Orb -> Ray of Frost alignment
    orbRayAlign: { orbCasts: 0, withRay: 0 },
    // Icy Veins alignment with other cooldowns
    icyVeins: { casts: 0, withOrb: 0, withPotion: 0, withRay: 0 },
    // Frozen Orb usage
    frozenOrb: { casts: [], avgTargetsOnCast: 0 },
    // Alter Time
    alterTime: { casts: [], contexts: [] },
    // Potion timing
    potion: { casts: [], contexts: [] },
    // FoF overcap (using FoF when already at 2 stacks and generating more)
    procWaste: { fofExpired: 0, bfExpired: 0 },
  }

  const GLACIAL_SPIKE = [199786]  // will be matched by name too
  const FLURRY       = [44614]
  const ICE_LANCE    = [30455]
  const FROZEN_ORB   = [84714]
  const RAY_OF_FROST = [205021]
  const ICY_VEINS    = [12472, 382252]
  const ALTER_TIME   = [342246, 108978]
  const POTION_IDS   = [307162, 371028, 383953, 432923, 33448]

  // Match by name for spells we might not have exact IDs for
  function isSpell(cast, ids, nameParts) {
    if (ids.includes(cast.id)) return true
    if (nameParts && cast.name) {
      const n = cast.name.toLowerCase()
      return nameParts.some(p => n.includes(p.toLowerCase()))
    }
    return false
  }

  annotatedCasts.forEach((cast, i) => {
    const next = annotatedCasts[i + 1]
    const next2 = annotatedCasts[i + 2]
    const withinSec = (a, b, sec) => b && Math.abs(b.t - a.t) <= sec

    // Ice Lance analysis
    if (isSpell(cast, ICE_LANCE, ['Ice Lance'])) {
      sequences.iceLance.total++
      if (cast.state.fofStacks > 0) {
        sequences.iceLance.withFoF++
      } else {
        sequences.iceLance.withoutFoF++
        // Ice Lance without FoF is only good in Flurry shatters
        const prevCast = annotatedCasts[i - 1]
        const isFlurryShatter = prevCast && isSpell(prevCast, FLURRY, ['Flurry']) && withinSec(prevCast, cast, 1.5)
        if (!isFlurryShatter) sequences.iceLance.wasted++
      }
    }

    // Flurry -> Ice Lance (Brain Freeze combo)
    if (isSpell(cast, FLURRY, ['Flurry'])) {
      if (cast.state.brainFreezeActive) {
        sequences.bfFlurry.total++
        const hasIL = next && isSpell(next, ICE_LANCE, ['Ice Lance']) && withinSec(cast, next, 1.5)
        if (hasIL) sequences.bfFlurry.withIceLance++
        else sequences.bfFlurry.withoutIceLance++
      }
    }

    // Glacial Spike combo detection
    if (isSpell(cast, [], ['Glacial Spike'])) {
      sequences.gsCombo.total++
      const hasFlurry = next && isSpell(next, FLURRY, ['Flurry']) && withinSec(cast, next, 3)
      const hasIL = hasFlurry && next2 && isSpell(next2, ICE_LANCE, ['Ice Lance']) && withinSec(next, next2, 1.5)
      if (hasFlurry && hasIL) sequences.gsCombo.clean++
      else if (hasFlurry) sequences.gsCombo.partial++
    }

    // Frozen Orb tracking
    if (isSpell(cast, FROZEN_ORB, ['Frozen Orb'])) {
      sequences.frozenOrb.casts.push({
        t: cast.t,
        icyVeinsActive: cast.state.icyVeinsActive,
        npcDeaths: cast.state.npcDeathsSoFar,
        // Look for Ray of Frost within 15s after Orb
        withRay: annotatedCasts.slice(i + 1).some(c => isSpell(c, RAY_OF_FROST, ['Ray of Frost']) && c.t - cast.t <= 15),
      })
      sequences.icyVeins.withOrb += cast.state.icyVeinsActive ? 1 : 0
    }

    // Ray of Frost tracking
    if (isSpell(cast, RAY_OF_FROST, ['Ray of Frost'])) {
      // Was Orb active? (Orb lasts ~10s)
      const recentOrb = annotatedCasts.slice(0, i).reverse().find(c => isSpell(c, FROZEN_ORB, ['Frozen Orb']))
      const orbActive = recentOrb && cast.t - recentOrb.t <= 10
      sequences.orbRayAlign.orbCasts = sequences.frozenOrb.casts.length
      if (orbActive) sequences.orbRayAlign.withRay++
    }

    // Icy Veins tracking
    if (isSpell(cast, ICY_VEINS, ['Icy Veins'])) {
      sequences.icyVeins.casts++
      // Check if Orb cast within 5s before/after
      const nearOrb = annotatedCasts.some(c => isSpell(c, FROZEN_ORB, ['Frozen Orb']) && Math.abs(c.t - cast.t) <= 5)
      if (nearOrb) sequences.icyVeins.withOrb++
      // Check potion
      const nearPotion = annotatedCasts.some(c => POTION_IDS.includes(c.id) && Math.abs(c.t - cast.t) <= 5)
      if (nearPotion) sequences.icyVeins.withPotion++
    }

    // Alter Time
    if (isSpell(cast, ALTER_TIME, ['Alter Time'])) {
      sequences.alterTime.casts.push(cast.t)
      sequences.alterTime.contexts.push({
        t: cast.t,
        icyVeinsActive: cast.state.icyVeinsActive,
        fofStacks: cast.state.fofStacks,
        brainFreezeActive: cast.state.brainFreezeActive,
      })
    }

    // Potion
    if (POTION_IDS.includes(cast.id) || (cast.name && cast.name.toLowerCase().includes('potion'))) {
      sequences.potion.casts.push(cast.t)
      sequences.potion.contexts.push({
        t: cast.t,
        icyVeinsActive: cast.state.icyVeinsActive,
      })
    }
  })

  // Compute averages
  if (sequences.frozenOrb.casts.length > 0) {
    sequences.frozenOrb.orbsWithIcyVeins = sequences.frozenOrb.casts.filter(c => c.icyVeinsActive).length
    sequences.frozenOrb.orbsWithRay = sequences.frozenOrb.casts.filter(c => c.withRay).length
  }

  return sequences
}

/**
 * Compute buff uptime percentages.
 */
export function computeUptimes(buffWindows, dur) {
  const uptimes = {}
  Object.entries(buffWindows).forEach(([id, windows]) => {
    const totalActive = windows.reduce((s, w) => s + (Math.min(w.end, dur) - w.start), 0)
    uptimes[id] = Math.round((totalActive / dur) * 100)
  })
  return uptimes
}

/**
 * Compute cast spacing stats — average gap between casts of the same spell.
 */
export function computeCastSpacing(annotatedCasts) {
  const bySpell = {}
  annotatedCasts.forEach(c => {
    if (!bySpell[c.id]) bySpell[c.id] = []
    bySpell[c.id].push(c.t)
  })
  const spacing = {}
  Object.entries(bySpell).forEach(([id, times]) => {
    if (times.length < 2) return
    const gaps = []
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1])
    spacing[id] = {
      avgGap: parseFloat((gaps.reduce((s, g) => s + g, 0) / gaps.length).toFixed(1)),
      minGap: parseFloat(Math.min(...gaps).toFixed(1)),
      maxGap: parseFloat(Math.max(...gaps).toFixed(1)),
    }
  })
  return spacing
}
