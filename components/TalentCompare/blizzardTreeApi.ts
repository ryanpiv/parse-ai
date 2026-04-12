import type { BlizzardNode } from './TalentTree'

/** JSON body from `GET /api/blizzard-tree?specId=…` (after error check). */
export type BlizzardTreePayload = {
  nodes: BlizzardNode[]
  edges: { from: number; to: number }[]
  heroTypes?: string[]
  specId?: number
  treeId?: number
  className?: string | null
  specName?: string | null
}

export async function fetchBlizzardTree(specId: number): Promise<BlizzardTreePayload> {
  const res = await fetch(`/api/blizzard-tree?specId=${specId}`)
  const data = (await res.json()) as BlizzardTreePayload & { error?: string }
  if (data.error) throw new Error(data.error)
  return data
}
