import { gql } from '../wclClient'

// ── Spell name resolution ─────────────────────────────────────────────────────
export function collectNames(events: Array<{ abilityGameID?: number; ability?: { name?: string } }>, map: Record<number, string>) {
  events.forEach((ev) => {
    if (ev.abilityGameID && ev.ability?.name) map[ev.abilityGameID] = ev.ability.name
  })
}

export async function resolveNames(ids: number[], known: Record<number, string>): Promise<Record<number, string>> {
  const missing = ids.filter((id) => !known[id])
  if (!missing.length) return known
  const result = { ...known }
  for (let i = 0; i < missing.length; i += 20) {
    const batch = missing.slice(i, i + 20)
    try {
      const fields = batch.map((id, j) => `s${j}: ability(id: ${id}) { name }`).join('\n')
      const data = await gql(`query { gameData { ${fields} } }`)
      batch.forEach((id, j) => {
        const n = (data?.gameData as any)?.[`s${j}`]?.name
        if (n) result[id] = n
      })
    } catch {
      /* keep Spell ID fallback */
    }
  }
  return result
}

// ── Full fight data fetcher ───────────────────────────────────────────────────
interface FetchFightDataParams {
  reportCode: string
  fightStart: number
  fightEnd: number
  playerId: number
  setStep: (msg: string) => void
}

export interface RawFightData {
  casts: any[]
  buffs: any[]
  debuffs: any[]
  damage: any[]
  deaths: any[]
}

export async function fetchFullFightData({ reportCode, fightStart, fightEnd, playerId, setStep }: FetchFightDataParams): Promise<RawFightData> {
  setStep('Fetching cast events...')
  const [castData, buffData, debuffData, damageData, enemyDeathData] = await Promise.all([
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){reportData{report(code:$c){events(dataType:Casts,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}}}}`, { c: reportCode, s: fightStart, e: fightEnd, src: playerId }),
    gql(`query($c:String!,$s:Float!,$e:Float!,$tgt:Int!){reportData{report(code:$c){events(dataType:Buffs,startTime:$s,endTime:$e,targetID:$tgt,limit:10000){data}}}}`, { c: reportCode, s: fightStart, e: fightEnd, tgt: playerId }),
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){reportData{report(code:$c){events(dataType:Debuffs,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}}}}`, { c: reportCode, s: fightStart, e: fightEnd, src: playerId }),
    gql(`query($c:String!,$s:Float!,$e:Float!,$src:Int!){reportData{report(code:$c){events(dataType:DamageDone,startTime:$s,endTime:$e,sourceID:$src,limit:10000){data}}}}`, { c: reportCode, s: fightStart, e: fightEnd, src: playerId }),
    gql(`query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){events(dataType:Deaths,startTime:$s,endTime:$e,limit:10000){data}}}}`, { c: reportCode, s: fightStart, e: fightEnd }),
  ])
  return {
    casts: (castData as any)?.reportData?.report?.events?.data || [],
    buffs: (buffData as any)?.reportData?.report?.events?.data || [],
    debuffs: (debuffData as any)?.reportData?.report?.events?.data || [],
    damage: (damageData as any)?.reportData?.report?.events?.data || [],
    deaths: (enemyDeathData as any)?.reportData?.report?.events?.data || [],
  }
}

// ── Process all fight data into analysis ──────────────────────────────────────
import {
  buildStateTracker,
  buildTargetTracker,
  buildDamageLookup,
  annotateCasts,
  detectSequences,
  computeUptimes,
  computeCastSpacing,
} from '../gameState'

interface ProcessFightDataParams {
  raw: RawFightData
  fightStart: number
  fightEnd: number
  playerId: number
  playerName: string
  spec: string
  dps: number | null
  takenTotal: number | undefined
  nameMap: Record<number, string>
}

export interface AnalyzedFightData {
  name: string
  spec: string
  dps: number | null
  takenTotal: number | undefined
  dur: number
  nameMap: Record<number, string>
  downtime: { pct: number; sec: number; wins: { g: number }[]; cpm: number; total: number }
  opener: { name: string; at: number }[]
  spellMap: Record<string, { name: string; id: string; count: number; ts: number[]; ppm: number }>
  sequences: any
  uptimes: any
  spacing: any
  icyVeinsWindows: any[]
  critRates: Record<string, number>
  annotated: any[]
  buffWindows: any
  npcDeaths: any
  boss?: string
  spellRows?: any[]
}

export async function processFightData({ raw, fightStart, fightEnd, playerId, playerName, spec, dps, takenTotal, nameMap }: ProcessFightDataParams): Promise<AnalyzedFightData> {
  const dur = (fightEnd - fightStart) / 1000
  const { casts, buffs, debuffs, damage, deaths } = raw

  const playerCasts = casts.filter((e: any) => e.type === 'cast' && e.sourceID === playerId)

  const { getStateAt, buffWindows } = buildStateTracker(buffs, debuffs, fightStart) as { getStateAt: any; buffWindows: Record<number, any[]> }
  const { getNPCDeathsBy, npcDeaths } = buildTargetTracker(deaths, fightStart)
  const { getDamageAfterCast, getCritRate } = buildDamageLookup(damage, fightStart)

  const annotated = annotateCasts(playerCasts, { getStateAt, getDamageAfterCast, getNPCDeathsBy, fightStart, nameMap })
  const sequences = detectSequences(annotated, dur)
  const uptimes = computeUptimes(buffWindows, dur)
  const spacing = computeCastSpacing(annotated)

  const sc = [...playerCasts].sort((a: any, b: any) => a.timestamp - b.timestamp)
  let dt = 0
  const dtWins: { g: number }[] = []
  for (let i = 1; i < sc.length; i++) {
    const g = ((sc[i] as any).timestamp - (sc[i - 1] as any).timestamp) / 1000
    if (g > 1.5 && g < 30) {
      dt += g - 1.5
      dtWins.push({ g: +g.toFixed(1) })
    }
  }
  const downtime = {
    pct: Math.round((dt / dur) * 100),
    sec: Math.round(dt),
    wins: dtWins.sort((a, b) => b.g - a.g).slice(0, 6),
    cpm: Math.round((playerCasts.length / dur) * 60),
    total: playerCasts.length,
  }

  const opener = annotated.filter((c: any) => c.t <= 20).map((c: any) => ({ name: c.name, at: c.t }))

  const spellMap: Record<string, { name: string; id: string; count: number; ts: number[]; ppm: number }> = {}
  annotated.forEach((c: any) => {
    const id = String(c.id)
    if (!spellMap[id]) spellMap[id] = { name: c.name, id, count: 0, ts: [], ppm: 0 }
    spellMap[id].count++
    spellMap[id].ts.push(c.t)
  })
  Object.values(spellMap).forEach((s) => {
    s.ppm = parseFloat(((s.count / dur) * 60).toFixed(2))
  })

  const IV_IDS = [12472, 382252]
  const icyVeinsWindows: any[] = []
  IV_IDS.forEach((id) => {
    if (buffWindows[id]) icyVeinsWindows.push(...buffWindows[id])
  })
  icyVeinsWindows.sort((a, b) => a.start - b.start)

  const critRates: Record<string, number> = {}
  Object.keys(spellMap).forEach((id) => {
    const r = getCritRate(Number(id))
    if (r !== null) critRates[id] = Math.round(r * 100)
  })

  return {
    name: playerName,
    spec,
    dps,
    takenTotal,
    dur,
    nameMap,
    downtime,
    opener,
    spellMap,
    sequences,
    uptimes,
    spacing,
    icyVeinsWindows,
    critRates,
    annotated,
    buffWindows,
    npcDeaths,
  }
}
