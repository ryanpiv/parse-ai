import { describe, it, expect } from '@jest/globals'
import { annotateCasts } from '../../../lib/gameState/analysis'

function makeContext(overrides: Partial<Parameters<typeof annotateCasts>[1]> = {}) {
  return {
    getStateAt: () => ({}),
    getDamageAfterCast: () => [],
    getNPCDeathsBy: () => 0,
    fightStart: 0,
    nameMap: { 1001: 'Spell Alpha', 1002: 'Spell Beta', 1003: 'Spell Gamma' } as Record<number, string>,
    ...overrides,
  }
}

describe('annotateCasts', () => {
  it('annotates a cast with game state and damage data', () => {
    const casts = [
      { type: 'cast', abilityGameID: 1001, timestamp: 5000, ability: { name: 'Spell Alpha' } },
    ]
    const ctx = makeContext({
      getStateAt: (t: number) => (t === 5 ? { 2001: 2 } : {}) as Record<number, number>,
      getDamageAfterCast: () => [{ amount: 50000, crit: true }],
      nameMap: { 1001: 'Spell Alpha', 2001: 'Proc Buff' },
    })

    const result = annotateCasts(casts, ctx)
    expect(result).toHaveLength(1)
    expect(result[0].t).toBe(5)
    expect(result[0].name).toBe('Spell Alpha')
    expect(result[0].activeBuffs[2001]).toEqual({ name: 'Proc Buff', stacks: 2 })
    expect(result[0].hitsCrit).toBe(true)
    expect(result[0].totalDamage).toBe(50000)
  })

  it('uses nameMap for spell names, falls back to ability.name', () => {
    const casts = [
      { type: 'cast', abilityGameID: 99999, timestamp: 1000, ability: { name: 'Unknown Spell' } },
    ]
    const result = annotateCasts(casts, makeContext())
    expect(result[0].name).toBe('Unknown Spell')
  })

  it('includes all active buffs generically', () => {
    const casts = [
      { type: 'cast', abilityGameID: 1001, timestamp: 3000, ability: { name: 'Spell Alpha' } },
    ]
    const ctx = makeContext({
      getStateAt: () => ({ 100: 1, 200: 3 }),
      nameMap: { 1001: 'Spell Alpha', 100: 'Buff A', 200: 'Buff B' },
    })

    const result = annotateCasts(casts, ctx)
    expect(result[0].activeBuffs[100]).toEqual({ name: 'Buff A', stacks: 1 })
    expect(result[0].activeBuffs[200]).toEqual({ name: 'Buff B', stacks: 3 })
  })

  it('returns empty activeBuffs when no buffs are active', () => {
    const casts = [
      { type: 'cast', abilityGameID: 1001, timestamp: 1000 },
    ]
    const result = annotateCasts(casts, makeContext())
    expect(Object.keys(result[0].activeBuffs)).toHaveLength(0)
  })
})
