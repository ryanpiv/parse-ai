import { useRef } from 'react'
import { useChart, CHART_DEFAULTS, GOLD, BLUE } from './chartDefaults'

export function ProcEfficiencyChart(props: any) {
  const { p1data, p2data } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function getMetrics(d: any) {
    const il = d.sequences.iceLance
    const bf = d.sequences.bfFlurry
    const gs = d.sequences.gsCombo
    return [
      il.total > 0 ? Math.round(il.withFoF / il.total * 100) : 0,
      bf.total > 0 ? Math.round(bf.withIceLance / bf.total * 100) : 0,
      gs.total > 0 ? Math.round(gs.clean / gs.total * 100) : 0,
      100 - d.downtime.pct,
    ]
  }

  const labels = ['Ice Lance w/ FoF', 'BF → Ice Lance', 'GS Combo clean', 'Uptime']
  const m1 = getMetrics(p1data)
  const m2 = getMetrics(p2data)

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
        x: { ...CHART_DEFAULTS.scales.x },
        y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 100, title: { display: true, text: '%', color: '#4a5a6a', font: { size: 10, family: 'IBM Plex Mono' } } }
      }
    }
  })

  return <canvas ref={canvasRef} />
}
