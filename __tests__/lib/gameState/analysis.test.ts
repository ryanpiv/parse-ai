import { describe, it, expect } from '@jest/globals'
import { annotateCasts, detectSequences } from '../../../lib/gameState/analysis'

function makeContext(overrides: Partial<Parameters<typeof annotateCasts>[1]> = {}) {
  return {
    getStateAt: () => ({}),
    getDamageAfterCast: () => [],
    getNPCDeathsBy: () => 0,
    fightStart: 0,
    nameMap: { 30455: 'Ice Lance', 44614: 'Flurry', 84714: 'Frozen Orb' },
    ...overrides,
  }
}

describe('annotateCasts', () => {
  it('annotates a cast with game state and damage data', () => {
    const casts = [
      { type: 'cast', abilityGameID: 30455, timestamp: 5000, ability: { name: 'Ice Lance' } },
    ]
    const ctx = makeContext({
      getStateAt: (t: number) => (t === 5 ? { 190446: 2 } : {}),
      getDamageAfterCast: () => [{ amount: 50000, crit: true }],
    })

    const result = annotateCasts(casts, ctx)
    expect(result).toHaveLength(1)
    expect(result[0].t).toBe(5)
    expect(result[0].name).toBe('Ice Lance')
    expect(result[0].state.fofStacks).toBe(2)
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
})

describe('detectSequences', () => {
  it('detects Ice Lance usage with and without FoF', () => {
    const casts = [
      { id: 30455, name: 'Ice Lance', t: 1, state: { fofStacks: 1, brainFreezeActive: false, icyVeinsActive: false } },
      { id: 30455, name: 'Ice Lance', t: 3, state: { fofStacks: 0, brainFreezeActive: false, icyVeinsActive: false } },
    ]
    const seq = detectSequences(casts, 60)
    expect(seq.iceLance.total).toBe(2)
    expect(seq.iceLance.withFoF).toBe(1)
    expect(seq.iceLance.withoutFoF).toBe(1)
  })

  it('detects clean Glacial Spike combo (GS -> Flurry -> IL)', () => {
    const casts = [
      { id: 199786, name: 'Glacial Spike', t: 10, state: { fofStacks: 0, brainFreezeActive: true, icyVeinsActive: false } },
      { id: 44614, name: 'Flurry', t: 11, state: { fofStacks: 0, brainFreezeActive: true, icyVeinsActive: false } },
      { id: 30455, name: 'Ice Lance', t: 12, state: { fofStacks: 0, brainFreezeActive: false, icyVeinsActive: false } },
    ]
    const seq = detectSequences(casts, 60)
    expect(seq.gsCombo.total).toBe(1)
    expect(seq.gsCombo.clean).toBe(1)
  })

  it('detects Brain Freeze Flurry with and without follow-up IL', () => {
    const casts = [
      { id: 44614, name: 'Flurry', t: 5, state: { fofStacks: 0, brainFreezeActive: true, icyVeinsActive: false } },
      { id: 30455, name: 'Ice Lance', t: 6, state: { fofStacks: 0, brainFreezeActive: false, icyVeinsActive: false } },
      { id: 44614, name: 'Flurry', t: 20, state: { fofStacks: 0, brainFreezeActive: true, icyVeinsActive: false } },
    ]
    const seq = detectSequences(casts, 60)
    expect(seq.bfFlurry.total).toBe(2)
    expect(seq.bfFlurry.withIceLance).toBe(1)
    expect(seq.bfFlurry.withoutIceLance).toBe(1)
  })
})
