import { describe, it, expect } from '@jest/globals'
import { buildStateTracker, buildTargetTracker, buildDamageLookup } from '../../../lib/gameState/tracking'

describe('buildStateTracker', () => {
  const fightStart = 10000

  it('tracks buff apply/remove windows', () => {
    const buffs = [
      { type: 'applybuff', abilityGameID: 12472, timestamp: 10000 },
      { type: 'removebuff', abilityGameID: 12472, timestamp: 30000 },
    ]
    const { getStateAt, buffWindows } = buildStateTracker(buffs, [], fightStart)

    expect(buffWindows[12472]).toHaveLength(1)
    expect(buffWindows[12472][0]).toEqual({ start: 0, end: 20, stacks: 1 })
    expect(getStateAt(10)).toEqual({ 12472: 1 })
    expect(getStateAt(25)).toEqual({})
  })

  it('tracks stacking buffs', () => {
    const buffs = [
      { type: 'applybuff', abilityGameID: 190446, timestamp: 10000 },
      { type: 'applybuffstack', abilityGameID: 190446, timestamp: 11000, stack: 2 },
      { type: 'removebuff', abilityGameID: 190446, timestamp: 15000 },
    ]
    const { getStateAt } = buildStateTracker(buffs, [], fightStart)

    // Window closes with final stack count (2), so both queries see stacks=2
    expect(getStateAt(0.5)).toEqual({ 190446: 2 })
    expect(getStateAt(4)).toEqual({ 190446: 2 })
    expect(getStateAt(6)).toEqual({})
  })

  it('closes still-active buffs at end of fight', () => {
    const buffs = [
      { type: 'applybuff', abilityGameID: 80353, timestamp: 10000 },
    ]
    const { buffWindows } = buildStateTracker(buffs, [], fightStart)

    expect(buffWindows[80353]).toHaveLength(1)
    expect(buffWindows[80353][0].end).toBe(99999)
  })
})

describe('buildTargetTracker', () => {
  it('counts NPC deaths up to a given time', () => {
    const deaths = [
      { type: 'death', targetIsFriendly: false, timestamp: 15000 },
      { type: 'death', targetIsFriendly: false, timestamp: 25000 },
      { type: 'death', targetIsFriendly: true, timestamp: 20000 },
    ]
    const { getNPCDeathsBy, npcDeaths } = buildTargetTracker(deaths, 10000)

    expect(npcDeaths).toHaveLength(2)
    expect(getNPCDeathsBy(3)).toBe(0)
    expect(getNPCDeathsBy(5)).toBe(1)
    expect(getNPCDeathsBy(20)).toBe(2)
  })
})

describe('buildDamageLookup', () => {
  it('finds damage events after a cast within time window', () => {
    const damage = [
      { type: 'damage', abilityGameID: 30455, timestamp: 11000, amount: 50000, hitType: 2, targetID: 1 },
      { type: 'damage', abilityGameID: 30455, timestamp: 12000, amount: 30000, hitType: 1, targetID: 2 },
      { type: 'damage', abilityGameID: 30455, timestamp: 20000, amount: 10000, hitType: 1, targetID: 1 },
    ]
    const { getDamageAfterCast, getCritRate } = buildDamageLookup(damage, 10000)

    const hits = getDamageAfterCast(30455, 0.5, 3)
    expect(hits).toHaveLength(2)
    expect(hits[0].crit).toBe(true)
    expect(hits[1].crit).toBe(false)

    expect(getCritRate(30455)).toBeCloseTo(1 / 3)
    expect(getCritRate(99999)).toBeNull()
  })
})
