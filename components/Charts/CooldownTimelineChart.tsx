import { useRef } from 'react'
import { useChart, CHART_DEFAULTS, GOLD, BLUE } from './chartDefaults'

export function CooldownTimelineChart(props: any) {
  const { p1data, p2data, spellRows } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const cdSpells = spellRows
    .filter((r: any) => {
      const ppm = Math.max(r.ppm1, r.ppm2)
      return ppm > 0 && ppm < 3
    })
    .slice(0, 6)

  if (!cdSpells.length) return null

  const datasets: any[] = []
  cdSpells.forEach((spell: any, si: number) => {
    const color = si % 2 === 0 ? GOLD : BLUE
    if (spell.ts1?.length) {
      datasets.push({
        label: `${p1data.name}: ${spell.name.slice(0, 16)}`,
        data: spell.ts1.map((t: number) => ({ x: t, y: si * 2 + 1 })),
        backgroundColor: GOLD,
        borderColor: GOLD,
        pointRadius: 6,
        pointStyle: 'rectRot',
        showLine: false,
      })
    }
    if (spell.ts2?.length) {
      datasets.push({
        label: `${p2data.name}: ${spell.name.slice(0, 16)}`,
        data: spell.ts2.map((t: number) => ({ x: t, y: si * 2 + 2 })),
        backgroundColor: BLUE,
        borderColor: BLUE,
        pointRadius: 6,
        pointStyle: 'rectRot',
        showLine: false,
      })
    }
  })

  const maxTime = Math.max(p1data.dur, p2data.dur)

  useChart(canvasRef, {
    type: 'scatter',
    data: { datasets },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}s`,
          }
        }
      },
      scales: {
        x: {
          ...CHART_DEFAULTS.scales.x,
          type: 'linear',
          min: 0, max: maxTime,
          title: { display: true, text: 'fight time (seconds)', color: '#4a5a6a', font: { size: 10, family: 'IBM Plex Mono' } }
        },
        y: {
          ...CHART_DEFAULTS.scales.y,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            callback: (val: string | number) => {
              const spellIdx = Math.floor((Number(val) - 1) / 2)
              const spell = cdSpells[spellIdx]
              return spell ? spell.name.slice(0, 14) : ''
            },
            stepSize: 1,
          },
          min: 0,
          max: cdSpells.length * 2 + 1,
        }
      }
    }
  })

  return <canvas ref={canvasRef} />
}
