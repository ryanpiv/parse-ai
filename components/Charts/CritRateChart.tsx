import { useMemo, useRef } from 'react'
import { useChart, CHART_DEFAULTS, GOLD } from './chartDefaults'

function topCritSeries(p1data: any) {
  const critRates: Record<string, number> = p1data?.critRates || {}
  const spellMap: Record<string, { name: string; count: number }> = p1data?.spellMap || {}
  return Object.entries(spellMap)
    .map(([id, v]) => ({
      id,
      name: v.name,
      count: v.count,
      crit: critRates[id],
    }))
    .filter((x) => x.crit != null && x.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export function hasCritRateChartData(p1data: any): boolean {
  return topCritSeries(p1data).length > 0
}

export function CritRateChart(props: { p1data: any }) {
  const { p1data } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const top = useMemo(() => topCritSeries(p1data), [p1data])

  useChart(canvasRef, {
    type: 'bar',
    data: {
      labels: top.map((r) => (r.name.length > 18 ? r.name.slice(0, 16) + '…' : r.name)),
      datasets: [
        {
          label: 'Crit %',
          data: top.map((r) => r.crit as number),
          backgroundColor: GOLD,
          borderRadius: 3,
        },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, title: { display: false } },
      scales: {
        x: {
          ...CHART_DEFAULTS.scales.x,
          ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxRotation: 35, minRotation: 20 },
        },
        y: {
          ...CHART_DEFAULTS.scales.y,
          max: 100,
          title: {
            display: true,
            text: 'crit %',
            color: '#4a5a6a',
            font: { size: 10, family: 'IBM Plex Mono' },
          },
        },
      },
    },
  })

  return <canvas ref={canvasRef} />
}
