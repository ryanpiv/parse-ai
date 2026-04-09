import { useRef } from 'react'
import { useChart, CHART_DEFAULTS, GOLD, GOLD_DIM, BLUE, BLUE_DIM } from './chartDefaults'

export function CastTimelineChart(props: any) {
  const { p1data, p2data } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function bucketCasts(annotated: { t: number }[], dur: number, bucketSize = 30) {
    const numBuckets = Math.ceil(dur / bucketSize)
    const buckets = Array(numBuckets).fill(0)
    annotated.forEach(c => {
      const b = Math.floor(c.t / bucketSize)
      if (b < numBuckets) buckets[b]++
    })
    return buckets.map(count => Math.round(count / (bucketSize / 60)))
  }

  const bucketSize = 30
  const dur = Math.max(p1data.dur, p2data.dur)
  const numBuckets = Math.ceil(dur / bucketSize)
  const labels = Array.from({ length: numBuckets }, (_, i) => `${i * bucketSize}s`)
  const b1 = bucketCasts(p1data.annotated || [], p1data.dur, bucketSize)
  const b2 = bucketCasts(p2data.annotated || [], p2data.dur, bucketSize)

  useChart(canvasRef, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: p1data.name, data: b1, borderColor: GOLD, backgroundColor: GOLD_DIM, fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2 },
        { label: p2data.name, data: b2, borderColor: BLUE, backgroundColor: BLUE_DIM, fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2 },
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { ...CHART_DEFAULTS.scales.x },
        y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'casts/min', color: '#4a5a6a', font: { size: 10, family: 'IBM Plex Mono' } }, min: 0 }
      }
    }
  })

  return <canvas ref={canvasRef} />
}
