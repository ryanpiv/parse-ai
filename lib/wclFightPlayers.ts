import type { WclGqlFn } from './talents/fetchTalents'
import { wclClassIconSmall } from './wowClassIcon'

export type FightPlayerRow = {
  id: number
  name: string
  className: string
  specLabel: string
  role: 'dps' | 'healer' | 'tank'
  iconUrl: string | null
}

function specFromPlayer(p: any): string {
  const specs = p?.specs
  if (Array.isArray(specs) && specs.length > 0 && specs[0]?.spec) return String(specs[0].spec)
  if (p?.spec) return String(p.spec)
  return ''
}

function ingestBucket(
  map: Map<number, FightPlayerRow>,
  list: any[] | undefined,
  role: 'dps' | 'healer' | 'tank'
) {
  if (!Array.isArray(list)) return
  for (const p of list) {
    const id = Number(p?.id)
    if (!Number.isFinite(id)) continue
    const name = String(p?.name || '').trim()
    if (!name) continue
    const className = String(p?.type || '').trim() || 'Unknown'
    const specLabel = specFromPlayer(p) || className
    map.set(id, {
      id,
      name,
      className,
      specLabel,
      role,
      iconUrl: wclClassIconSmall(className),
    })
  }
}

async function fetchFightPlayerRowsFromPlayerDetails(
  gql: WclGqlFn,
  reportCode: string,
  fightId: number
): Promise<FightPlayerRow[]> {
  const data = await gql(
    `query($code: String!, $fightId: Int!) {
      reportData { report(code: $code) { playerDetails(fightIDs: [$fightId]) } }
    }`,
    { code: reportCode, fightId }
  )
  const details = data?.reportData?.report?.playerDetails?.data
  const map = new Map<number, FightPlayerRow>()
  ingestBucket(map, details?.dps, 'dps')
  ingestBucket(map, details?.healers, 'healer')
  ingestBucket(map, details?.tanks, 'tank')
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * When `playerDetails` is empty (some fights / log versions), infer roster from
 * damage and healing rankings for the fight window, joined to masterData players.
 */
async function fetchFightPlayerRowsFromRankingTables(
  gql: WclGqlFn,
  reportCode: string,
  startTime: number,
  endTime: number
): Promise<FightPlayerRow[]> {
  const [meta, dmg, hps] = await Promise.all([
    gql(
      `query($c:String!){reportData{report(code:$c){masterData{actors{id name type subType}}}}}`,
      { c: reportCode }
    ),
    gql(
      `query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:DamageDone,startTime:$s,endTime:$e)}}}`,
      { c: reportCode, s: startTime, e: endTime }
    ),
    gql(
      `query($c:String!,$s:Float!,$e:Float!){reportData{report(code:$c){table(dataType:Healing,startTime:$s,endTime:$e)}}}`,
      { c: reportCode, s: startTime, e: endTime }
    ),
  ])

  const report = meta?.reportData?.report
  if (!report) return []

  const actors = (report.masterData?.actors || []).filter((a: any) => String(a?.type) === 'Player')
  const byLowerName = new Map<string, any>()
  for (const a of actors) {
    const n = String(a?.name || '').trim().toLowerCase()
    if (n) byLowerName.set(n, a)
  }

  const dmgEntries = dmg?.reportData?.report?.table?.data?.entries || []
  const hpsEntries = hps?.reportData?.report?.table?.data?.entries || []

  const map = new Map<number, FightPlayerRow>()

  function ingestRankings(entries: any[] | undefined, role: 'dps' | 'healer' | 'tank') {
    if (!Array.isArray(entries)) return
    for (const e of entries) {
      const name = String(e?.name || '').trim()
      if (!name) continue
      const actor = byLowerName.get(name.toLowerCase())
      if (!actor) continue
      const id = Number(actor.id)
      if (!Number.isFinite(id)) continue

      const entryType = String(e?.type || '')
      if (entryType === 'Pet' || entryType === 'Summon') continue

      const classFromRow =
        entryType && entryType !== 'Player' && entryType !== 'Unknown' ? entryType : ''
      const sub = String(actor.subType || '').trim()
      const className = classFromRow || sub || 'Unknown'
      const specLabel = sub || classFromRow || 'Unknown'

      if (!map.has(id)) {
        map.set(id, {
          id,
          name: String(actor.name || name),
          className,
          specLabel,
          role,
          iconUrl: wclClassIconSmall(classFromRow) || wclClassIconSmall(sub),
        })
      }
    }
  }

  ingestRankings(dmgEntries, 'dps')
  ingestRankings(hpsEntries, 'healer')

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Players in a fight for the solo-report picker.
 * Uses `playerDetails` when WCL fills it; otherwise rankings + masterData for the fight window.
 */
export async function fetchFightPlayerRows(
  gql: WclGqlFn,
  reportCode: string,
  fightId: number,
  fightWindow?: { startTime: number; endTime: number }
): Promise<FightPlayerRow[]> {
  const fromDetails = await fetchFightPlayerRowsFromPlayerDetails(gql, reportCode, fightId)
  if (fromDetails.length) return fromDetails
  if (!fightWindow) return []
  return fetchFightPlayerRowsFromRankingTables(gql, reportCode, fightWindow.startTime, fightWindow.endTime)
}
