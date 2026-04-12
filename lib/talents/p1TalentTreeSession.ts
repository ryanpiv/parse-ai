/** Minimal rows stored in app session for /talent-preview (matches WCL CombatantInfo shape). */
export type P1TalentRow = { nodeID: number; rank: number }

export function talentDataToP1RowsJson(talentTree: unknown): string {
  if (!Array.isArray(talentTree) || talentTree.length === 0) return ''
  const rows: P1TalentRow[] = []
  for (const t of talentTree as any[]) {
    const nodeID = t.nodeID ?? t.nodeId
    const rank = t.rank ?? 0
    if (nodeID == null || Number(nodeID) <= 0) continue
    rows.push({ nodeID: Number(nodeID), rank: Number(rank) || 0 })
  }
  return rows.length ? JSON.stringify(rows) : ''
}

export function parseP1TalentRowsJson(raw: string | undefined | null): P1TalentRow[] {
  const s = raw?.trim()
  if (!s) return []
  try {
    const p = JSON.parse(s)
    if (!Array.isArray(p)) return []
    return p
      .map((x: any) => ({
        nodeID: Number(x.nodeID ?? x.nodeId),
        rank: Number(x.rank) || 0,
      }))
      .filter((x: P1TalentRow) => x.nodeID > 0)
  } catch {
    return []
  }
}
