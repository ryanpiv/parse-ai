import { useRef } from 'react'
import { useChart, CHART_DEFAULTS, GOLD, BLUE } from './chartDefaults'

export function SpellUsageChart(props: any) {
  const { spellRows, name1, name2, solo } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const top = spellRows
    .filter((r: any) => (solo ? r.ppm1 > 0 : r.ppm1 > 0 || r.ppm2 > 0))
    .slice(0, 12)

  const datasets = solo
    ? [{ label: name1, data: top.map((r: any) => r.ppm1), backgroundColor: GOLD, borderRadius: 3 }]
    : [
        { label: name1, data: top.map((r: any) => r.ppm1), backgroundColor: GOLD, borderRadius: 3 },
        { label: name2, data: top.map((r: any) => r.ppm2), backgroundColor: BLUE, borderRadius: 3 },
      ]

  useChart(canvasRef, {
    type: 'bar',
    data: {
      labels: top.map((r: any) => r.name.length > 18 ? r.name.slice(0, 16) + '…' : r.name),
      datasets,
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, title: { display: false } },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxRotation: 35, minRotation: 20 } },
        y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'casts/min', color: '#4a5a6a', font: { size: 10, family: 'IBM Plex Mono' } } }
      }
    }
  })

  return <canvas ref={canvasRef} />
}
