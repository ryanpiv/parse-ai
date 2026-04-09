export type WclGqlFn = (
  query: string,
  variables: Record<string, unknown>
) => Promise<any>

let _treeCache: Map<number, any> | null = null

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
      talentTree: talentTree.length > 0 ? talentTree : talents,
      talentString: playerEvent.talentSpec || null,
    }
  } catch (e) {
    console.error('[fetchTalents] error:', e)
    return null
  }
}

export async function fetchTalentTreeLayout(
  classId = 8,
  specId = 64,
  gql: WclGqlFn
): Promise<Map<number, any> | null> {
  if (_treeCache) return _treeCache
  try {
    const data = await gql(
      `
      query($classId: Int!, $specId: Int!) {
        gameData {
          talentTree(classId: $classId, specId: $specId) {
            classNodes { id definitionId spellId name row col type }
            specNodes  { id definitionId spellId name row col type }
            heroNodes  { id definitionId spellId name row col type }
          }
        }
      }
    `,
      { classId, specId }
    )

    const tree = data?.gameData?.talentTree
    if (!tree) return null

    const layout = new Map<number, any>()
    ;(tree.classNodes || []).forEach((n: any) => layout.set(n.definitionId || n.id, { ...n, category: 'class' }))
    ;(tree.specNodes || []).forEach((n: any) => layout.set(n.definitionId || n.id, { ...n, category: 'spec' }))
    ;(tree.heroNodes || []).forEach((n: any) => layout.set(n.definitionId || n.id, { ...n, category: 'hero' }))

    _treeCache = layout
    console.log(`[treeLayout] loaded ${layout.size} nodes`)
    return layout
  } catch (e: any) {
    console.warn('[treeLayout] gameData query failed, will use heuristic categorization:', e?.message)
    return null
  }
}
