export type WclGqlFn = (
  query: string,
  variables: Record<string, unknown>
) => Promise<any>

export async function fetchTalents({
  reportCode,
  fightId,
  fightStart,
  fightEnd,
  playerName,
  playerId,
  gql,
}: {
  reportCode: string
  fightId: string | number
  fightStart: number
  fightEnd: number
  playerName: string
  playerId?: number | null
  gql: WclGqlFn
}): Promise<any> {
  try {
    const fightIdInt = parseInt(String(fightId), 10)

    const eventsData = await gql(
      `
      query($code: String!, $fightId: Int!, $start: Float!, $end: Float!) {
        reportData { report(code: $code) {
          events(dataType: CombatantInfo, fightIDs: [$fightId], startTime: $start, endTime: $end, limit: 100) { data }
        }}
      }
    `,
      { code: reportCode, fightId: fightIdInt, start: fightStart, end: fightEnd }
    )

    const events = eventsData?.reportData?.report?.events?.data || []
    console.log(`[fetchTalents] ${playerName}: got ${events.length} CombatantInfo events`)
    if (!events.length) return null

    let playerEvent = playerId ? events.find((e: any) => e.sourceID === playerId) : null

    if (!playerEvent) {
      const detailsData = await gql(
        `
        query($code: String!, $fightId: Int!) {
          reportData { report(code: $code) { playerDetails(fightIDs: [$fightId]) } }
        }
      `,
        { code: reportCode, fightId: fightIdInt }
      )
      const details = detailsData?.reportData?.report?.playerDetails?.data
      const allPlayers = [...(details?.dps || []), ...(details?.healers || []), ...(details?.tanks || [])]
      const pd = allPlayers.find((p: any) => p.name?.toLowerCase() === playerName?.toLowerCase())
      if (pd) playerEvent = events.find((e: any) => e.sourceID === pd.id)
    }

    if (!playerEvent && events.length === 1) playerEvent = events[0]
    if (!playerEvent) {
      console.warn(`[fetchTalents] no match for ${playerName}`)
      return null
    }

    console.log(
      `[fetchTalents] ${playerName}: talentTree=${(playerEvent.talentTree || []).length} talents=${(playerEvent.talents || []).length}`
    )

    const talentTree = playerEvent.talentTree || []
    const talents = playerEvent.talents || []

    return {
      name: playerName,
      sourceID: playerEvent.sourceID,
      specID: playerEvent.specID || null,
      talentTree: talentTree.length > 0 ? talentTree : talents,
      talentString: playerEvent.talentSpec || null,
    }
  } catch (e) {
    console.error('[fetchTalents] error:', e)
    return null
  }
}

