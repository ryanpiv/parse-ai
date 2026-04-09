/**
 * Charts.js
 * Visual charts comparing two players using Chart.js
 */
import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js/auto'

const GOLD = 'rgba(201,162,39,0.85)'
const GOLD_DIM = 'rgba(201,162,39,0.2)'
const BLUE = 'rgba(90,173,240,0.85)'
const BLUE_DIM = 'rgba(90,173,240,0.2)'
const RED = 'rgba(212,64,64,0.85)'
const GREEN = 'rgba(64,160,96,0.85)'
const DIM = 'rgba(74,90,106,0.4)'

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#8a9bb0',
        font: { family: 'IBM Plex Mono', size: 11 },
        boxWidth: 12,
        padding: 14,
      }
    },
    tooltip: {
      backgroundColor: '#111418',
      borderColor: '#2a3340',
      borderWidth: 1,
      titleColor: '#e8be40',
      bodyColor: '#8a9bb0',
      titleFont: { family: 'Rajdhani', size: 13, weight: '600' },
      bodyFont: { family: 'IBM Plex Mono', size: 11 },
      padding: 10,
    }
  },
  scales: {
    x: {
      ticks: { color: '#4a5a6a', font: { family: 'IBM Plex Mono', size: 10 } },
      grid: { color: 'rgba(42,51,64,0.5)' },
    },
    y: {
      ticks: { color: '#4a5a6a', font: { family: 'IBM Plex Mono', size: 10 } },
      grid: { color: 'rgba(42,51,64,0.5)' },
    }
  }
}

function useChart(canvasRef, config) {
  useEffect(() => {
    if (!canvasRef.current) return
    // Destroy any existing chart on this canvas
    const existing = Chart.getChart(canvasRef.current)
    if (existing) existing.destroy()
    const chart = new Chart(canvasRef.current, config)
    return () => { chart.destroy() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)])
}

// ── Spell Usage Bar Chart ────────────────────────────────────────────────────
export function SpellUsageChart({ spellRows, name1, name2 }) {
  const canvasRef = useRef(null)
  const top = spellRows
    .filter(r => r.ppm1 > 0 || r.ppm2 > 0)
    .slice(0, 12)

  useChart(canvasRef, {
    type: 'bar',
    data: {
      labels: top.map(r => r.name.length > 18 ? r.name.slice(0, 16) + '…' : r.name),
      datasets: [
        { label: name1, data: top.map(r => r.ppm1), backgroundColor: GOLD, borderRadius: 3 },
        { label: name2, data: top.map(r => r.ppm2), backgroundColor: BLUE, borderRadius: 3 },
      ]
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

// ── Cast Timeline (casts per 30s window) ─────────────────────────────────────
export function CastTimelineChart({ p1data, p2data }) {
  const canvasRef = useRef(null)

  function bucketCasts(annotated, dur, bucketSize = 30) {
    const numBuckets = Math.ceil(dur / bucketSize)
    const buckets = Array(numBuckets).fill(0)
    annotated.forEach(c => {
      const b = Math.floor(c.t / bucketSize)
      if (b < numBuckets) buckets[b]++
    })
    // Convert to casts/min
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

// ── Proc Efficiency Comparison ────────────────────────────────────────────────
export function ProcEfficiencyChart({ p1data, p2data }) {
  const canvasRef = useRef(null)

  function getMetrics(d) {
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

// ── Cooldown Timeline (when key CDs were used) ─────────────────────────────
export function CooldownTimelineChart({ p1data, p2data, spellRows }) {
  const canvasRef = useRef(null)

  // Find the top cooldown spells (low ppm = likely CDs)
  const cdSpells = spellRows
    .filter(r => {
      const ppm = Math.max(r.ppm1, r.ppm2)
      return ppm > 0 && ppm < 3  // cooldowns cast < 3/min
    })
    .slice(0, 6)

  if (!cdSpells.length) return null

  // Build datasets: one point per cast at time T
  const datasets = []
  cdSpells.forEach((spell, si) => {
    const color = si % 2 === 0 ? GOLD : BLUE
    if (spell.ts1?.length) {
      datasets.push({
        label: `${p1data.name}: ${spell.name.slice(0, 16)}`,
        data: spell.ts1.map(t => ({ x: t, y: si * 2 + 1 })),
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
        data: spell.ts2.map(t => ({ x: t, y: si * 2 + 2 })),
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
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}s`,
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
            callback: (val) => {
              const spellIdx = Math.floor((val - 1) / 2)
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

// ── Wrapper with title ────────────────────────────────────────────────────────
export function ChartCard({ title, height = 220, children }) {
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ height, position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}
