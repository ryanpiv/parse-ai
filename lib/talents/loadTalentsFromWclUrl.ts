import { parseWclUrl, resolveReportFightQuery } from '../wclReportUrl'
import { fetchFightPlayerRows, type FightPlayerRow } from '../wclFightPlayers'
import { fetchTalents, type WclGqlFn } from './fetchTalents'

type FightMeta = { id: number; name: string; startTime: number; endTime: number; kill?: boolean }

const META_Q = `query($c:String!){reportData{report(code:$c){title fights{id name startTime endTime kill} masterData{actors{id name type subType}}}}}`

export type TalentLoadPick = {
  kind: 'pick-player'
  players: FightPlayerRow[]
  code: string
  fightId: number
  startTime: number
  endTime: number
}

export type TalentLoadReady = {
  kind: 'loaded'
  name: string
  specId: number
  talentString: string
  talentTree: unknown[]
}

function findActor(actors: any[], srcRaw: string) {
  const src = srcRaw.trim()
  if (!src) return undefined
  if (!Number.isNaN(Number(src))) {
    const id = parseInt(src, 10)
    return actors.find((a: any) => a.id === id && String(a.type) === 'Player')
  }
  const lower = src.toLowerCase()
  return actors.find((a: any) => a.name?.toLowerCase() === lower && String(a.type) === 'Player')
}

async function loadForFight(
  gql: WclGqlFn,
  code: string,
  fight: FightMeta,
  srcRaw: string,
  actors: any[]
): Promise<TalentLoadPick | TalentLoadReady> {
  let src = srcRaw.trim()
  if (!src) {
    const players = await fetchFightPlayerRows(gql, code, fight.id, {
      startTime: fight.startTime,
      endTime: fight.endTime,
    })
    if (!players.length) {
      throw new Error(
        'No player roster for this fight. Add ?source= (player id or name) to the URL, or pick a different pull.',
      )
    }
    if (players.length > 1) {
      return {
        kind: 'pick-player',
        players,
        code,
        fightId: fight.id,
        startTime: fight.startTime,
        endTime: fight.endTime,
      }
    }
    src = String(players[0].id)
  }

  const actor = findActor(actors, src)
  const name = actor?.name || src
  const tt = await fetchTalents({
    reportCode: code,
    fightId: fight.id,
    fightStart: fight.startTime,
    fightEnd: fight.endTime,
    playerName: name,
    playerId: actor?.id,
    gql,
  })
  if (!tt) {
    throw new Error(`No CombatantInfo talents for ${name} in this fight.`)
  }
  const talentString = typeof tt.talentString === 'string' ? tt.talentString.trim() : ''
  const talentTree = Array.isArray(tt.talentTree) ? tt.talentTree : []
  const specId = Number(tt.specID) || 0
  if (!talentString && talentTree.length === 0) {
    throw new Error(`WCL returned no talent string or tree rows for ${name}.`)
  }
  if (!specId && !talentString) {
    throw new Error('Could not determine specialization. Paste an export string instead, or add ?source=.')
  }
  return {
    kind: 'loaded',
    name,
    specId,
    talentString,
    talentTree,
  }
}

export async function confirmTalentPlayer(
  gql: WclGqlFn,
  pick: Omit<TalentLoadPick, 'kind' | 'players'>,
  playerId: number,
  playerName: string
): Promise<TalentLoadReady> {
  const tt = await fetchTalents({
    reportCode: pick.code,
    fightId: pick.fightId,
    fightStart: pick.startTime,
    fightEnd: pick.endTime,
    playerName: playerName,
    playerId,
    gql,
  })
  if (!tt) throw new Error(`No CombatantInfo talents for ${playerName} in this fight.`)
  const talentString = typeof tt.talentString === 'string' ? tt.talentString.trim() : ''
  const talentTree = Array.isArray(tt.talentTree) ? tt.talentTree : []
  const specId = Number(tt.specID) || 0
  if (!talentString && talentTree.length === 0) {
    throw new Error(`WCL returned no talent string or tree rows for ${playerName}.`)
  }
  return { kind: 'loaded', name: playerName, specId, talentString, talentTree }
}

/** Load player-1 talents from a WCL report or compare URL (no full fight event dump). */
export async function loadTalentsFromWclUrl(
  rawUrl: string,
  gql: WclGqlFn,
  sourceOverride?: string
): Promise<TalentLoadPick | TalentLoadReady> {
  const parsed = parseWclUrl(rawUrl.trim())

  if (parsed.kind === 'compare') {
    const m1 = await gql(META_Q, { c: parsed.r1 })
    const report = m1?.reportData?.report
    if (!report) throw new Error(`Report ${parsed.r1} not found or inaccessible.`)
    const fight = (report.fights || []).find((f: FightMeta) => f.id === parsed.f1id)
    if (!fight) {
      const ids = (report.fights || []).map((f: FightMeta) => f.id).join(', ')
      throw new Error(`Fight ${parsed.f1id} not found. Available fight IDs: ${ids}`)
    }
    const src = (sourceOverride || parsed.src1 || '').trim()
    return loadForFight(gql, parsed.r1, fight, src, report.masterData?.actors || [])
  }

  const m1 = await gql(META_Q, { c: parsed.code })
  const report = m1?.reportData?.report
  if (!report) throw new Error('Report not found or inaccessible.')
  const fights = report.fights || []
  const fightId = resolveReportFightQuery(fights, parsed.fightQuery)
  const fight = fights.find((f: FightMeta) => f.id === fightId)
  if (!fight) throw new Error(`Fight ${fightId} not found.`)
  const src = (sourceOverride || parsed.source || '').trim()
  return loadForFight(gql, parsed.code, fight, src, report.masterData?.actors || [])
}
