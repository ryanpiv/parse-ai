/**
 * Build a state tracker from buff/debuff events.
 * Returns getStateAt(timestamp) -> active buff map and raw buffWindows.
 */
export function buildStateTracker(buffEvents: any[], debuffEvents: any[], fightStart: number) {
  const buffWindows: Record<number, Array<{ start: number; end: number; stacks: number }>> = {}
  const activeAtTime: Record<number, { start: number; stacks: number }> = {}

  const allEvents = [
    ...buffEvents.map((e: any) => ({ ...e, _type: 'buff' })),
    ...debuffEvents.map((e: any) => ({ ...e, _type: 'debuff' })),
  ].sort((a, b) => a.timestamp - b.timestamp)

  allEvents.forEach((ev) => {
    const id = ev.abilityGameID
    const t = (ev.timestamp - fightStart) / 1000
    const type = ev.type

    if (!buffWindows[id]) buffWindows[id] = []

    if (type === 'applybuff' || type === 'applydebuff') {
      activeAtTime[id] = { start: t, stacks: 1 }
    } else if (type === 'applybuffstack' || type === 'applydebuffstack') {
      if (activeAtTime[id]) {
        activeAtTime[id].stacks = ev.stack || activeAtTime[id].stacks + 1
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

  Object.entries(activeAtTime).forEach(([id, state]) => {
    const numId = Number(id)
    if (!buffWindows[numId]) buffWindows[numId] = []
    buffWindows[numId].push({ start: state.start, end: 99999, stacks: state.stacks })
  })

  function getStateAt(t: number): Record<number, number> {
    const active: Record<number, number> = {}
    Object.entries(buffWindows).forEach(([id, windows]) => {
      for (const w of windows) {
        if (t >= w.start && t <= w.end) {
          active[Number(id)] = w.stacks
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
 */
export function buildTargetTracker(deathEvents: any[], fightStart: number) {
  const npcDeaths = deathEvents
    .filter((ev: any) => ev.type === 'death' && ev.targetIsFriendly === false)
    .map((ev: any) => (ev.timestamp - fightStart) / 1000)
    .sort((a: number, b: number) => a - b)

  function getNPCDeathsBy(t: number): number {
    return npcDeaths.filter((d: number) => d <= t).length
  }

  return { getNPCDeathsBy, npcDeaths }
}

/**
 * Build damage lookup for crit detection and per-cast damage analysis.
 */
export function buildDamageLookup(damageEvents: any[], fightStart: number) {
  const bySpell: Record<number, Array<{ t: number; amount: number; crit: boolean; targetID: number; absorbed: number; overkill: number }>> = {}

  damageEvents.forEach((ev: any) => {
    if (ev.type !== 'damage') return
    const id = ev.abilityGameID
    if (!bySpell[id]) bySpell[id] = []
    bySpell[id].push({
      t: (ev.timestamp - fightStart) / 1000,
      amount: ev.amount || 0,
      crit: ev.hitType === 2,
      targetID: ev.targetID,
      absorbed: ev.absorbed || 0,
      overkill: ev.overkill || 0,
    })
  })

  function getDamageAfterCast(spellId: number, castTime: number, windowSec = 3) {
    const hits = bySpell[spellId] || []
    return hits.filter((h) => h.t >= castTime && h.t <= castTime + windowSec)
  }

  function getCritRate(spellId: number): number | null {
    const hits = bySpell[spellId] || []
    if (!hits.length) return null
    return hits.filter((h) => h.crit).length / hits.length
  }

  return { getDamageAfterCast, getCritRate, bySpell }
}
