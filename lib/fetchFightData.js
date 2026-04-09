/**
 * fetchFightData.js
 * Fetches all relevant events for a single player in a single fight:
 * - Cast events
 * - Buff apply/remove (player buffs and procs)
 * - Debuff apply/remove (on target)
 * - Damage events with hit type (crit detection / Shatter)
 * - Enemy NPC deaths (target count tracking)
 */

export async function fetchFightData({ reportCode, fightStart, fightEnd, playerId, playerName, gql }) {
  const dur = (fightEnd - fightStart) / 1000

  // Fetch everything in parallel
  const [
    castData,
    buffData,
    debuffData,
    damageData,
    enemyDeathData,
  ] = await Promise.all([
    // Casts by this player
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){
      reportData{report(code:$c){
        events(dataType:Casts,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd, src: playerId }),

    // Buffs on this player
    gql(`query($c:String!,$s:Float!,$e:Float!,$tgt:Int!){
      reportData{report(code:$c){
        events(dataType:Buffs,startTime:$s,endTime:$e,targetID:$tgt,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd, tgt: playerId }),

    // Debuffs applied by this player (Winter's Chill etc)
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){
      reportData{report(code:$c){
        events(dataType:Debuffs,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd, src: playerId }),

    // Damage done by this player (with hitType for crit/Shatter detection)
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){
      reportData{report(code:$c){
        events(dataType:DamageDone,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd, src: playerId }),

    // Enemy deaths (for target count tracking)
    gql(`query($c:String!,$s:Float!,$e:Float!){
      reportData{report(code:$c){
        events(dataType:Deaths,startTime:$s,endTime:$e,limit:10000){data}
      }}
    }`, { c: reportCode, s: fightStart, e: fightEnd }),
  ])

  const casts    = castData?.reportData?.report?.events?.data || []
  const buffs    = buffData?.reportData?.report?.events?.data || []
  const debuffs  = debuffData?.reportData?.report?.events?.data || []
  const damage   = damageData?.reportData?.report?.events?.data || []
  const deaths   = enemyDeathData?.reportData?.report?.events?.data || []

  return { casts, buffs, debuffs, damage, deaths, fightStart, fightEnd, dur, playerId, playerName }
}
