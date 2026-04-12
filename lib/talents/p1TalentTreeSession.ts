/**
 * Minimal rows stored in app session for /talent-preview (WCL CombatantInfo + variants).
 * `spellId` is used when WCL omits node id so we can match Blizzard tree nodes.
 */
export type P1TalentRow = { nodeID: number; rank: number; spellId?: number }

export function talentDataToP1RowsJson(talentTree: unknown): string {
  if (!Array.isArray(talentTree) || talentTree.length === 0) return ''
  const rows: P1TalentRow[] = []
  for (const t of talentTree as any[]) {
    const rawNode =
      t.nodeID ?? t.nodeId ?? t.talentID ?? t.talentId ?? t.traitNodeID ?? t.traitNodeId
    const nodeID = rawNode != null ? Number(rawNode) : 0
    const rank = Number(t.rank ?? 0) || 0
    const sidRaw = t.spellId ?? t.spellID
    const spellId = sidRaw != null && !Number.isNaN(Number(sidRaw)) ? Number(sidRaw) : undefined
    if (nodeID > 0) {
      const row: P1TalentRow = { nodeID, rank }
      if (spellId && spellId > 0) row.spellId = spellId
      rows.push(row)
    } else if (spellId && spellId > 0 && rank > 0) {
      rows.push({ nodeID: 0, rank, spellId })
    }
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
      .map((x: any) => {
        const rawNode =
          x.nodeID ?? x.nodeId ?? x.talentID ?? x.talentId ?? x.traitNodeID ?? x.traitNodeId
        const nodeID = rawNode != null ? Number(rawNode) : 0
        const sidRaw = x.spellId ?? x.spellID
        const spellId = sidRaw != null && !Number.isNaN(Number(sidRaw)) ? Number(sidRaw) : undefined
        return {
          nodeID,
          rank: Number(x.rank) || 0,
          ...(spellId && spellId > 0 ? { spellId } : {}),
        } as P1TalentRow
      })
      .filter((x: P1TalentRow) => x.nodeID > 0 || (x.spellId != null && x.spellId > 0))
  } catch {
    return []
  }
}

type NodeForWclRow = {
  nodeId: number
  type: string
  entries?: Array<{ spellId: number }>
}

/**
 * Merge decoded export nodes into a flat nodeId→rank map (same keys as /compare’s decodedToTalentTree).
 */
export function mergeDecodedNodesIntoSelectionMap(
  decoded: Map<number, { rank: number }>,
  sel: Map<number, number>
): void {
  for (const [id, node] of decoded) {
    if (node.rank > 0) sel.set(id, node.rank)
  }
}

/**
 * Overlay WCL rows onto nodeId→rank exactly like TalentCompare builds `sel1`:
 * `talentTree.forEach(t => sel1.set(t.nodeID, t.rank))` — no `all.find` gate on nodeID.
 * Rows win over decode when both set the same id (call this after mergeDecoded).
 * Spell-only rows (nodeID 0) resolve via `all` when provided.
 */
export function mergeP1RowsIntoSelectionMap(
  rows: P1TalentRow[],
  sel: Map<number, number>,
  all?: Array<{ nodeId: number; entries?: Array<{ spellId: number }> }>
): void {
  for (const r of rows) {
    if (r.rank <= 0) continue
    if (r.nodeID > 0) {
      sel.set(r.nodeID, r.rank)
      continue
    }
    if (r.spellId && r.spellId > 0 && all) {
      const b = all.find(n => n.entries?.some(e => e.spellId === r.spellId))
      if (b) sel.set(b.nodeId, r.rank)
    }
  }
}

/** @deprecated Prefer mergeP1RowsIntoSelectionMap + per-partition maps — old path gated rows on all.find/type. */
export function applyWclRowsToRankMaps(
  rows: P1TalentRow[],
  all: NodeForWclRow[],
  heroNodeIds: Set<number>,
  classR: Map<number, number>,
  specR: Map<number, number>,
  heroRs: Record<string, Map<number, number>>
): void {
  for (const r of rows) {
    if (r.rank <= 0) continue
    let blizz: NodeForWclRow | undefined =
      r.nodeID > 0 ? all.find(n => n.nodeId === r.nodeID) : undefined
    if (!blizz && r.spellId && r.spellId > 0) {
      blizz = all.find(n => n.entries?.some(e => e.spellId === r.spellId))
    }
    if (!blizz) continue
    const id = blizz.nodeId
    if (blizz.type === 'class' && !heroNodeIds.has(id)) classR.set(id, r.rank)
    else if (blizz.type === 'spec' && !heroNodeIds.has(id)) specR.set(id, r.rank)
    else if (blizz.type.startsWith('hero_')) {
      if (!heroRs[blizz.type]) heroRs[blizz.type] = new Map()
      heroRs[blizz.type]!.set(id, r.rank)
    }
  }
}
