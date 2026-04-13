import { describe, it, expect } from '@jest/globals'
import { buildCastTimelineSegments } from '../../../lib/gameState/castTimeline'

const fightStart = 1_000_000
const playerId = 7
const nameMap: Record<number, string> = { 116: 'Frostbolt', 120: 'Fireball' }

describe('buildCastTimelineSegments', () => {
  it('pairs begincast with cast into a non-cancelled segment', () => {
    const casts = [
      { type: 'begincast', sourceID: playerId, abilityGameID: 116, timestamp: fightStart + 1000 },
      { type: 'cast', sourceID: playerId, abilityGameID: 116, timestamp: fightStart + 2500 },
    ]
    const segs = buildCastTimelineSegments(casts, fightStart, playerId, nameMap)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({
      spellId: 116,
      tStart: 1,
      tEnd: 2.5,
      cancelled: false,
      instant: false,
    })
  })

  it('marks instant casts when there is no begincast', () => {
    const casts = [{ type: 'cast', sourceID: playerId, abilityGameID: 120, timestamp: fightStart + 500 }]
    const segs = buildCastTimelineSegments(casts, fightStart, playerId, nameMap)
    expect(segs).toHaveLength(1)
    expect(segs[0].instant).toBe(true)
    expect(segs[0].tStart).toBe(0.5)
    expect(segs[0].tEnd).toBe(0.5)
  })

  it('marks cancelled when a new begincast arrives before cast', () => {
    const casts = [
      { type: 'begincast', sourceID: playerId, abilityGameID: 116, timestamp: fightStart + 1000 },
      { type: 'begincast', sourceID: playerId, abilityGameID: 116, timestamp: fightStart + 2000 },
      { type: 'cast', sourceID: playerId, abilityGameID: 116, timestamp: fightStart + 3500 },
    ]
    const segs = buildCastTimelineSegments(casts, fightStart, playerId, nameMap)
    expect(segs.some(s => s.cancelled && s.tStart === 1 && s.tEnd === 2)).toBe(true)
    const ok = segs.find(s => !s.cancelled && !s.instant)
    expect(ok?.tStart).toBe(2)
    expect(ok?.tEnd).toBe(3.5)
  })
})
