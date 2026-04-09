/**
 * Shared Chart.js colors, defaults, and canvas lifecycle hook.
 */
import { useEffect, type RefObject } from 'react'
import { Chart } from 'chart.js/auto'

export const GOLD = 'rgba(201,162,39,0.85)'
export const GOLD_DIM = 'rgba(201,162,39,0.2)'
export const BLUE = 'rgba(90,173,240,0.85)'
export const BLUE_DIM = 'rgba(90,173,240,0.2)'
export const RED = 'rgba(212,64,64,0.85)'
export const GREEN = 'rgba(64,160,96,0.85)'
export const DIM = 'rgba(74,90,106,0.4)'

export const CHART_DEFAULTS = {
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

export function useChart(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  config: any
) {
  useEffect(() => {
    if (!canvasRef.current) return
    const existing = Chart.getChart(canvasRef.current)
    if (existing) existing.destroy()
    const chart = new Chart(canvasRef.current, config)
    return () => { chart.destroy() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)])
}
