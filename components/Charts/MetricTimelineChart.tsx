/**
 * Damage done / healing done / damage taken over time, one metric visible at
 * a time via the chip filter (default damage done). Series come from WCL's
 * graph endpoint (AnalyzedFightData.metricSeries, fetched at load); each
 * report has its own point resolution, so both players are resampled into
 * common buckets before overlaying.
 */
import { useRef, useState } from 'react'
import { useChart, CHART_DEFAULTS, GOLD, GOLD_DIM, BLUE, BLUE_DIM } from './chartDefaults'
import type { MetricKey, MetricPoints } from '../../lib/metricGraphs'

const METRICS: Array<{ key: MetricKey; label: string; axis: string }> = [
  { key: 'dmg', label: 'Damage done', axis: 'dps' },
  { key: 'heal', label: 'Healing done', axis: 'hps' },
  { key: 'taken', label: 'Damage taken', axis: 'taken/s' },
]

export function hasMetricSeriesData(pdata: any): boolean {
  const ms = pdata?.metricSeries
  return Boolean(ms && (ms.dmg?.length || ms.heal?.length || ms.taken?.length))
}

function resample(points: MetricPoints, dur: number, bucketSize: number): Array<number | null> {
  const n = Math.max(1, Math.ceil(dur / bucketSize))
  const sums = new Array<number>(n).fill(0)
  const counts = new Array<number>(n).fill(0)
  for (const [t, v] of points) {
    if (t < 0 || t > dur) continue
    const b = Math.min(n - 1, Math.floor(t / bucketSize))
    sums[b] += v
    counts[b]++
  }
  return sums.map((sum, i) => (counts[i] ? Math.round(sum / counts[i]) : null))
}

export function MetricTimelineChart(props: any) {
  const { p1data, p2data, solo, compareWindowSec } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [metric, setMetric] = useState<MetricKey>('dmg')

  const defaultCompareDur = Math.max(p1data.dur, p2data.dur)
  const dur = solo
    ? p1data.dur
    : Math.max(1, Math.min(defaultCompareDur, Number(compareWindowSec) || defaultCompareDur))
  // ~90 buckets max, in 5s steps, so long fights stay readable.
  const bucketSize = Math.max(5, Math.ceil(dur / 90 / 5) * 5)
  const numBuckets = Math.max(1, Math.ceil(dur / bucketSize))
  const labels = Array.from({ length: numBuckets }, (_, i) => `${i * bucketSize}s`)

  const pts1: MetricPoints = p1data.metricSeries?.[metric] || []
  const pts2: MetricPoints = solo ? [] : p2data.metricSeries?.[metric] || []
  const b1 = resample(pts1, dur, bucketSize)
  const b2 = resample(pts2, dur, bucketSize)

  const meta = METRICS.find(m => m.key === metric)!
  const line = { fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2, spanGaps: true }
  const datasets = solo
    ? [{ label: p1data.name, data: b1, borderColor: GOLD, backgroundColor: GOLD_DIM, ...line }]
    : [
        { label: p1data.name, data: b1, borderColor: GOLD, backgroundColor: GOLD_DIM, ...line },
        { label: p2data.name, data: b2, borderColor: BLUE, backgroundColor: BLUE_DIM, ...line },
      ]

  useChart(canvasRef, {
    type: 'line',
    data: { labels, datasets },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { ...CHART_DEFAULTS.scales.x },
        y: {
          ...CHART_DEFAULTS.scales.y,
          title: { display: true, text: meta.axis, color: '#4a5a6a', font: { size: 10, family: 'IBM Plex Mono' } },
          min: 0,
        },
      },
    },
  })

  const noData = !pts1.length && !pts2.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {METRICS.map(m => {
          const active = m.key === metric
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 999,
                cursor: 'pointer',
                background: 'transparent',
                border: `1px solid ${active ? 'var(--gold2)' : 'var(--border)'}`,
                color: active ? 'var(--gold2)' : 'var(--muted)',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {noData ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--dim)', margin: '20px 0 0' }}>
            No {meta.label.toLowerCase()} recorded for this fight.
          </p>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
    </div>
  )
}
