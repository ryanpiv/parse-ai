import { describe, it, expect, jest } from '@jest/globals'
import { fetchFightData } from '../../lib/fetchFightData'
import type { GqlFn } from '../../lib/fetchFightData'

function makeGqlResponse(dataType: string, events: unknown[]) {
  return { reportData: { report: { events: { data: events } } } }
}

describe('fetchFightData', () => {
  it('fetches all 5 event types in parallel and returns structured result', async () => {
    const mockCasts = [{ type: 'cast', abilityGameID: 1001, timestamp: 1000 }]
    const mockBuffs = [{ type: 'applybuff', abilityGameID: 2001, timestamp: 1100 }]
    const mockDebuffs = [{ type: 'applydebuff', abilityGameID: 3001, timestamp: 1200 }]
    const mockDamage = [{ type: 'damage', abilityGameID: 1001, amount: 50000, timestamp: 1300 }]
    const mockDeaths = [{ type: 'death', timestamp: 5000 }]

    const gql: GqlFn = jest.fn()
      .mockResolvedValueOnce(makeGqlResponse('Casts', mockCasts))
      .mockResolvedValueOnce(makeGqlResponse('Buffs', mockBuffs))
      .mockResolvedValueOnce(makeGqlResponse('Debuffs', mockDebuffs))
      .mockResolvedValueOnce(makeGqlResponse('DamageDone', mockDamage))
      .mockResolvedValueOnce(makeGqlResponse('Deaths', mockDeaths)) as GqlFn

    const result = await fetchFightData({
      reportCode: 'abc123',
      fightStart: 0,
      fightEnd: 30000,
      playerId: 5,
      playerName: 'TestPlayer',
      gql,
    })

    expect(gql).toHaveBeenCalledTimes(5)
    expect(result.casts).toEqual(mockCasts)
    expect(result.buffs).toEqual(mockBuffs)
    expect(result.debuffs).toEqual(mockDebuffs)
    expect(result.damage).toEqual(mockDamage)
    expect(result.deaths).toEqual(mockDeaths)
    expect(result.dur).toBe(30)
    expect(result.playerId).toBe(5)
    expect(result.playerName).toBe('TestPlayer')
  })

  it('returns empty arrays when WCL returns no event data', async () => {
    const gql: GqlFn = jest.fn().mockResolvedValue({}) as GqlFn

    const result = await fetchFightData({
      reportCode: 'xyz',
      fightStart: 0,
      fightEnd: 10000,
      playerId: 1,
      playerName: 'EmptyPlayer',
      gql,
    })

    expect(result.casts).toEqual([])
    expect(result.buffs).toEqual([])
    expect(result.debuffs).toEqual([])
    expect(result.damage).toEqual([])
    expect(result.deaths).toEqual([])
  })
})
