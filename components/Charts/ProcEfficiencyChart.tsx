import { useRef } from 'react'
import { useChart, CHART_DEFAULTS, GOLD, BLUE } from './chartDefaults'

export function ProcEfficiencyChart(props: any) {
  const { p1data, p2data } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const allBuffIds = new Set([
    ...Object.keys(p1data.uptimes || {}),
    ...Object.keys(p2data.uptimes || {}),
  ])

  const buffEntries = [...allBuffIds]
    .map(id => {
      const numId = Number(id)
      const name = p1data.nameMap?.[numId] || p2data.nameMap?.[numId] || `Buff ${numId}`
      const u1 = (p1data.uptimes?.[numId] as number) || 0
      const u2 = (p2data.uptimes?.[numId] as number) || 0
      return { name, u1, u2 }
    })
    .filter(e => (e.u1 > 0 || e.u2 > 0) && !e.name.startsWith('Buff '))
    .sort((a, b) => Math.max(b.u1, b.u2) - Math.max(a.u1, a.u2))
    .slice(0, 6)

  const labels = [
    ...buffEntries.map(e => e.name.length > 18 ? e.name.slice(0, 16) + '…' : e.name),
    'Uptime',
  ]
  const m1 = [...buffEntries.map(e => e.u1), 100 - p1data.downtime.pct]
  const m2 = [...buffEntries.map(e => e.u2), 100 - p2data.downtime.pct]

  useChart(canvasRef, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: p1data.name, data: m1, backgroundColor: GOLD, borderRadius: 3 },
        { label: p2data.name, data: m2, backgroundColor: BLUE, borderRadius: 3 },
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxRotation: 35, minRotation: 20 } },
        y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 100, title: { display: true, text: '%', color: '#4a5a6a', font: { size: 10, family: 'IBM Plex Mono' } } }
      }
    }
  })

  return <canvas ref={canvasRef} />
}
