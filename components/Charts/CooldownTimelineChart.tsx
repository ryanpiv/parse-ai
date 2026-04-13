import { useMemo, useRef, useState, useEffect } from 'react'
import { useChart, CHART_DEFAULTS, GOLD, BLUE } from './chartDefaults'
import {
  estimatedCooldownSec,
  isLikelyBuffUtility,
  pickCooldownChartSpells,
  type SpellRowLike,
} from '../../lib/cooldownSpells/pickCooldownChartSpells'

type SpellRow = SpellRowLike

function collectSpellIdsForApiLookup(spellRows: SpellRow[], solo?: boolean): number[] {
  const ids = new Set<number>()
  for (const r of spellRows) {
    if (isLikelyBuffUtility(r)) continue
    if (solo) {
      if (!r.count1) continue
    } else if ((r.count1 || 0) + (r.count2 || 0) === 0) continue
    const ppm = solo ? r.ppm1 : Math.max(r.ppm1, r.ppm2)
    if (ppm >= 6) continue
    const id = Number(r.id)
    if (Number.isFinite(id) && id > 0) ids.add(id)
  }
  return [...ids].slice(0, 48)
}

function CooldownBarInner({
  sorted,
  p1data,
  p2data,
  blizzardCooldownMs,
  solo,
}: {
  sorted: SpellRow[]
  p1data: { name: string; dur: number }
  p2data: { name: string; dur: number }
  blizzardCooldownMs: Record<string, number | null | undefined> | null
  solo?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const chartConfig = useMemo(() => {
    const labels = sorted.map(r => (r.name.length > 16 ? `${r.name.slice(0, 14)}…` : r.name))
    const estSec = (r: SpellRow) =>
      estimatedCooldownSec(r, p1data.dur, solo ? p1data.dur : p2data.dur)
    const apiSec = (id: string) => {
      const ms = blizzardCooldownMs?.[id]
      if (ms != null && ms > 0) return ms / 1000
      return null
    }
    const datasets = solo
      ? [
          {
            label: p1data.name,
            data: sorted.map(r => r.count1),
            backgroundColor: GOLD,
            borderRadius: 3,
          },
        ]
      : [
          {
            label: p1data.name,
            data: sorted.map(r => r.count1),
            backgroundColor: GOLD,
            borderRadius: 3,
          },
          {
            label: p2data.name,
            data: sorted.map(r => r.count2),
            backgroundColor: BLUE,
            borderRadius: 3,
          },
        ]

    return {
      type: 'bar' as const,
      data: {
        labels,
        datasets,
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          title: { display: false },
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              afterLabel: (ctx: any) => {
                const r = sorted[ctx.dataIndex]
                if (!r) return ''
                const lines: string[] = []
                const b = apiSec(r.id)
                if (b != null) {
                  const m = Math.floor(b / 60)
                  const s = Math.round(b % 60)
                  lines.push(
                    m > 0 ? `Blizzard CD ~${m}m ${s}s` : `Blizzard CD ~${Math.round(b)}s`
                  )
                }
                const sec = estSec(r)
                const m2 = Math.floor(sec / 60)
                const s2 = Math.round(sec % 60)
                lines.push(
                  m2 > 0
                    ? `Observed gap ~${m2}m ${s2}s`
                    : `Observed gap ~${Math.round(sec)}s`
                )
                return lines
              },
            },
          },
        },
        scales: {
          x: {
            ...CHART_DEFAULTS.scales.x,
            ticks: {
              ...CHART_DEFAULTS.scales.x.ticks,
              maxRotation: 55,
              minRotation: 40,
              autoSkip: true,
              maxTicksLimit: 16,
            },
          },
          y: {
            ...CHART_DEFAULTS.scales.y,
            beginAtZero: true,
            stacked: false,
            title: {
              display: true,
              text: 'total casts',
              color: '#4a5a6a',
              font: { size: 10, family: 'IBM Plex Mono' },
            },
            ticks: { precision: 0 },
          },
        },
      },
    }
  }, [sorted, p1data.name, p2data.name, p1data.dur, p2data.dur, blizzardCooldownMs, solo])

  useChart(canvasRef, chartConfig as any)

  return <canvas ref={canvasRef} />
}

export function CooldownTimelineChart(props: {
  p1data: { name: string; dur: number }
  p2data: { name: string; dur: number }
  spellRows: SpellRow[]
  solo?: boolean
}) {
  const { p1data, p2data, spellRows, solo } = props

  const idSig = useMemo(() => collectSpellIdsForApiLookup(spellRows, solo).join(','), [spellRows, solo])

  const [blizzardCooldownMs, setBlizzardCooldownMs] = useState<Record<
    string,
    number | null
  > | null>(null)

  useEffect(() => {
    const ids = idSig ? idSig.split(',').map(s => parseInt(s, 10)).filter(n => n > 0) : []
    if (!ids.length) {
      setBlizzardCooldownMs({})
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/spell-cooldowns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        const data = await res.json()
        if (cancelled) return
        setBlizzardCooldownMs(typeof data.cooldowns === 'object' && data.cooldowns ? data.cooldowns : {})
      } catch {
        if (!cancelled) setBlizzardCooldownMs({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idSig])

  const sorted = useMemo(() => {
    if (blizzardCooldownMs === null) return []
    return pickCooldownChartSpells(
      spellRows,
      blizzardCooldownMs,
      p1data.dur,
      solo ? p1data.dur : p2data.dur,
      14
    )
  }, [spellRows, blizzardCooldownMs, p1data.dur, p2data.dur, solo])

  if (blizzardCooldownMs === null) {
    return (
      <div
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          color: '#4a5a6a',
          padding: '12px 0',
        }}
      >
        Resolving spell cooldowns (Blizzard API)…
      </div>
    )
  }

  if (!sorted.length) return null

  return (
    <CooldownBarInner
      sorted={sorted}
      p1data={p1data}
      p2data={p2data}
      blizzardCooldownMs={blizzardCooldownMs}
      solo={solo}
    />
  )
}
