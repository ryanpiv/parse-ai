import { describe, it, expect } from '@jest/globals'
import { computeUptimes, computeCastSpacing } from '../../../lib/gameState/metrics'

describe('computeUptimes', () => {
  it('calculates uptime percentage from buff windows', () => {
    const buffWindows = {
      12472: [{ start: 0, end: 20 }, { start: 40, end: 60 }],
    }
    const uptimes = computeUptimes(buffWindows, 100)
    expect(uptimes[12472]).toBe(40)
  })

  it('caps window end at fight duration', () => {
    const buffWindows = {
      80353: [{ start: 0, end: 99999 }],
    }
    const uptimes = computeUptimes(buffWindows, 300)
    expect(uptimes[80353]).toBe(100)
  })
})

describe('computeCastSpacing', () => {
  it('computes avg/min/max gap between casts', () => {
    const casts = [
      { id: 30455, t: 0 },
      { id: 30455, t: 3 },
      { id: 30455, t: 9 },
    ]
    const spacing = computeCastSpacing(casts)
    expect(spacing[30455].minGap).toBe(3)
    expect(spacing[30455].maxGap).toBe(6)
    expect(spacing[30455].avgGap).toBe(4.5)
  })

  it('skips spells cast only once', () => {
    const casts = [{ id: 84714, t: 10 }]
    const spacing = computeCastSpacing(casts)
    expect(spacing[84714]).toBeUndefined()
  })
})
