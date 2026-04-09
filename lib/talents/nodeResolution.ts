export const _nodeMap: Record<string, any> = {}
let _pendingNodeIDs = new Set<any>()
let _fetchTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleNodeFetch(nodeIds: any[]) {
  nodeIds.forEach((id) => {
    if (!_nodeMap[id]) _pendingNodeIDs.add(id)
  })
  if (_fetchTimer) clearTimeout(_fetchTimer)
  _fetchTimer = setTimeout(async () => {
    const ids = [..._pendingNodeIDs]
    _pendingNodeIDs.clear()
    if (!ids.length) return
    try {
      const r = await fetch('/api/talents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIDs: ids }),
      })
      const d = await r.json()
      Object.assign(_nodeMap, d.nodeMap || {})
    } catch {}
  }, 100)
}

export async function getNodeMap(nodeIds?: (number | string)[]): Promise<Record<string, any>> {
  if (nodeIds?.length) scheduleNodeFetch(nodeIds)
  await new Promise((r) => setTimeout(r, 200))
  return _nodeMap
}

const _cache: Record<string, any> = {}

export async function fetchTalentInfo(nodeId: number | string | undefined, defId: number): Promise<any> {
  const key = `n${nodeId}`
  if (_cache[key] !== undefined) return _cache[key]

  const nodeMap = await getNodeMap()
  const mapped = nodeMap[nodeId as any] || nodeMap[String(nodeId)]
  if (mapped?.name && mapped?.icon) {
    _cache[key] = { name: mapped.name, icon: mapped.icon }
    return _cache[key]
  }
  if (mapped?.spellId) {
    try {
      const r = await fetch(`/api/tooltip?id=${mapped.spellId}&type=spell`)
      if (r.ok) {
        const d = await r.json()
        if (d.icon) {
          const result = {
            name: mapped.name || d.name || `Spell ${mapped.spellId}`,
            icon: `https://wow.zamimg.com/images/wow/icons/medium/${d.icon}`,
          }
          _cache[key] = result
          return result
        }
      }
    } catch {}
  }

  try {
    const r2 = await fetch(`/api/tooltip?id=${defId}&type=spell`)
    if (r2.ok) {
      const d2 = await r2.json()
      if (d2.name && d2.icon) {
        const result = {
          name: d2.name,
          icon: `https://wow.zamimg.com/images/wow/icons/medium/${d2.icon}`,
        }
        _cache[key] = result
        return result
      }
    }
  } catch {}

  _cache[key] = null
  return null
}

export async function fetchIcon(spellId: number): Promise<string | null> {
  if (_cache[spellId] !== undefined) return _cache[spellId]
  try {
    const res = await fetch(`/api/tooltip?id=${spellId}&type=spell`)
    if (!res.ok) throw new Error('not ok')
    const d = await res.json()
    const url = d.icon ? `https://wow.zamimg.com/images/wow/icons/medium/${d.icon}` : null
    _cache[spellId] = url
    return url
  } catch {
    _cache[spellId] = null
    return null
  }
}
