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
  role: FightPlayerRow['role']
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

/** Players present in a fight (for solo report picker). */
export async function fetchFightPlayerRows(
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
