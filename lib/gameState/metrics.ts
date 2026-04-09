/**
 * Compute buff uptime percentages.
 */
export function computeUptimes(buffWindows: Record<number, Array<{ start: number; end: number }>>, dur: number): Record<number, number> {
  const uptimes: Record<number, number> = {}
  Object.entries(buffWindows).forEach(([id, windows]) => {
    const totalActive = windows.reduce((s, w) => s + (Math.min(w.end, dur) - w.start), 0)
    uptimes[Number(id)] = Math.round((totalActive / dur) * 100)
  })
  return uptimes
}

/**
 * Compute average gap between casts of the same spell.
 */
export function computeCastSpacing(annotatedCasts: any[]): Record<number, { avgGap: number; minGap: number; maxGap: number }> {
  const bySpell: Record<number, number[]> = {}
  annotatedCasts.forEach((c: any) => {
    if (!bySpell[c.id]) bySpell[c.id] = []
    bySpell[c.id].push(c.t)
  })
  const spacing: Record<number, { avgGap: number; minGap: number; maxGap: number }> = {}
  Object.entries(bySpell).forEach(([id, times]) => {
    if (times.length < 2) return
    const gaps: number[] = []
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1])
    spacing[Number(id)] = {
      avgGap: parseFloat((gaps.reduce((s, g) => s + g, 0) / gaps.length).toFixed(1)),
      minGap: parseFloat(Math.min(...gaps).toFixed(1)),
      maxGap: parseFloat(Math.max(...gaps).toFixed(1)),
    }
  })
  return spacing
}
