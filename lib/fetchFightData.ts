/**
 * Fetches all relevant events for a single player in a single fight:
 * - Cast events
 * - Buff apply/remove (player buffs and procs)
 * - Debuff apply/remove (on target)
 * - Damage events with hit type (crit detection / Shatter)
 * - Enemy NPC deaths (target count tracking)
 */

export type GqlFn = (query: string, variables: Record<string, unknown>) => Promise<Record<string, unknown>>

interface FetchFightDataParams {
  reportCode: string
  fightStart: number
  fightEnd: number
  playerId: number
  playerName: string
  gql: GqlFn
}

interface WCLEventData {
  reportData?: { report?: { events?: { data?: unknown[] } } }
}

export interface FightData {
  casts: unknown[]
  buffs: unknown[]
  debuffs: unknown[]
  damage: unknown[]
  deaths: unknown[]
  fightStart: number
  fightEnd: number
  dur: number
  playerId: number
  playerName: string
}

function extractEvents(data: unknown): unknown[] {
  const d = data as WCLEventData | undefined
  return d?.reportData?.report?.events?.data ?? []
}

export async function fetchFightData({ reportCode, fightStart, fightEnd, playerId, playerName, gql }: FetchFightDataParams): Promise<FightData> {
  const dur = (fightEnd - fightStart) / 1000

  const [castData, buffData, debuffData, damageData, enemyDeathData] = await Promise.all([
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){
      reportData{report(code:$c){
        events(dataType:Casts,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd, src: playerId }),

    gql(`query($c:String!,$s:Float!,$e:Float!,$tgt:Int!){
      reportData{report(code:$c){
        events(dataType:Buffs,startTime:$s,endTime:$e,targetID:$tgt,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd, tgt: playerId }),

    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){
      reportData{report(code:$c){
        events(dataType:Debuffs,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd, src: playerId }),

    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){
      reportData{report(code:$c){
        events(dataType:DamageDone,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd, src: playerId }),

    gql(`query($c:String!,$s:Float!,$e:Float!){
      reportData{report(code:$c){
        events(dataType:Deaths,startTime:$s,endTime:$e,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd }),
  ])

  return {
    casts: extractEvents(castData),
    buffs: extractEvents(buffData),
    debuffs: extractEvents(debuffData),
    damage: extractEvents(damageData),
    deaths: extractEvents(enemyDeathData),
    fightStart,
    fightEnd,
    dur,
    playerId,
    playerName,
  }
}
