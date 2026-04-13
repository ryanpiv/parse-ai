/**
 * Pair WCL Cast events (begincast → cast) into timeline segments for generic spell charts.
 * Instant casts (cast without begincast) are marked instant. Unfinished begins → cancelled.
 */

export type CastTimelineSegment = {
  spellId: number
  name: string
  /** Seconds from fight start */
  tStart: number
  /** Seconds from fight start (>= tStart) */
  tEnd: number
  /** Began casting but no matching cast (interrupted, clipped begin, or fight ended) */
  cancelled: boolean
  /** No begincast before this cast event */
  instant: boolean
}

function normEventType(type: unknown): string {
  return String(type ?? '').toLowerCase()
}

function isBeginCast(type: unknown): boolean {
  const s = normEventType(type)
  return s === 'begincast' || s === 'begin_cast'
}

function isCastSuccess(type: unknown): boolean {
  return normEventType(type) === 'cast'
}

function spellName(spellId: number, nameMap: Record<number, string>, ev?: any): string {
  return nameMap[spellId] || ev?.ability?.name || `Spell ${spellId}`
}

/**
 * Build segments from raw report `Casts` events for one player.
 * Overlapping same-spell begins cancel the previous open begin (new begin ends the old bar).
 */
export function buildCastTimelineSegments(
  casts: any[],
  fightStart: number,
  playerId: number,
  nameMap: Record<number, string>
): CastTimelineSegment[] {
  const segments: CastTimelineSegment[] = []
  /** FIFO queue of cast-start times (sec) per spell id */
  const pending = new Map<number, number[]>()

  const events = casts
    .filter((e: any) => {
      if (e.sourceID !== playerId) return false
      return isBeginCast(e.type) || isCastSuccess(e.type)
    })
    .sort((a: any, b: any) => a.timestamp - b.timestamp)

  for (const ev of events) {
    const spellId = Number(ev.abilityGameID)
    if (!spellId) continue
    const t = (ev.timestamp - fightStart) / 1000
    const name = spellName(spellId, nameMap, ev)

    if (isBeginCast(ev.type)) {
      let q = pending.get(spellId)
      if (!q) {
        q = []
        pending.set(spellId, q)
      }
      if (q.length > 0) {
        const prevStart = q.shift()!
        segments.push({
          spellId,
          name,
          tStart: prevStart,
          tEnd: t,
          cancelled: true,
          instant: false,
        })
      }
      q.push(t)
      pending.set(spellId, q)
    } else if (isCastSuccess(ev.type)) {
      const q = pending.get(spellId) ?? []
      if (q.length > 0) {
        const t0 = q.shift()!
        pending.set(spellId, q)
        segments.push({
          spellId,
          name,
          tStart: t0,
          tEnd: t,
          cancelled: false,
          instant: false,
        })
      } else {
        segments.push({
          spellId,
          name,
          tStart: t,
          tEnd: t,
          cancelled: false,
          instant: true,
        })
      }
    }
  }

  const tailCancelledWidth = 0.25
  for (const [spellId, q] of pending) {
    for (const t0 of q) {
      segments.push({
        spellId,
        name: spellName(spellId, nameMap),
        tStart: t0,
        tEnd: t0 + tailCancelledWidth,
        cancelled: true,
        instant: false,
      })
    }
  }

  return segments.sort((a, b) => a.tStart - b.tStart || a.spellId - b.spellId)
}
