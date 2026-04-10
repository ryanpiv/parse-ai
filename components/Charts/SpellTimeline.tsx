import { useState, useRef, useCallback, useEffect } from 'react'

const GOLD   = 'rgba(201,162,39,0.95)'
const BLUE   = 'rgba(90,173,240,0.95)'
const BG     = '#0a0c0f'
const BG_ALT = '#0d1014'
const BORDER = '#2a3340'
const DIM    = '#4a5a6a'
const TEXT   = '#8a9bb0'

const ROW_H    = 26
const LABEL_W  = 148
const TICK_W   = 3
const TICK_H   = 9
const HEADER_H = 22

interface SpellRow {
  id: string; name: string
  ppm1: number; ppm2: number
  ts1: number[]; ts2: number[]
}

interface Props {
  spellRows: SpellRow[]
  name1: string; name2: string
  dur1: number; dur2: number
}

export function SpellTimeline({ spellRows, name1, name2, dur1, dur2 }: Props) {
  const dur = Math.min(dur1, dur2)
  const rows = spellRows.filter(r => r.ppm1 > 0.12 || r.ppm2 > 0.12).slice(0, 18)

  // Use refs for zoom/offset to avoid re-render jitter during drag/slide
  const windowSecRef = useRef(dur)
  const offsetSecRef = useRef(0)
  const [, forceRender] = useState(0)
  const redraw = useCallback(() => forceRender(n => n + 1), [])

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null)
  const [containerW, setContainerW] = useState(800)
  const [isDragging, setIsDragging] = useState(false)

  // Sync on dur change
  useEffect(() => {
    windowSecRef.current = dur
    offsetSecRef.current = 0
    redraw()
  }, [dur, redraw])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width || 800))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const windowSec = windowSecRef.current
  const offset = Math.min(offsetSecRef.current, Math.max(0, dur - windowSec))
  const chartW = containerW - LABEL_W

  function tx(t: number) {
    return LABEL_W + ((t - offset) / windowSec) * chartW
  }
  function inView(t: number) {
    return t >= offset - 1 && t <= offset + windowSec + 1
  }

  // Axis tick interval based on zoom
  const tickInterval = windowSec <= 20 ? 5 : windowSec <= 60 ? 10 : windowSec <= 150 ? 20 : 30
  const axisTicks: number[] = []
  const first = Math.ceil(offset / tickInterval) * tickInterval
  for (let t = first; t <= offset + windowSec + 0.1; t += tickInterval) axisTicks.push(+t.toFixed(1))

  // Drag to pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startOffset: offsetSecRef.current }
    setIsDragging(true)
    e.preventDefault()
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dSec = -(dx / chartW) * windowSecRef.current
    const max = Math.max(0, dur - windowSecRef.current)
    offsetSecRef.current = Math.max(0, Math.min(max, dragRef.current.startOffset + dSec))
    redraw()
  }, [chartW, dur, redraw])

  const onMouseUp = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  if (!rows.length) return null

  const totalH = HEADER_H + rows.length * ROW_H
  const zoomPct = Math.round((dur / windowSec) * 100)
  const trimmed = dur < Math.max(dur1, dur2)

  return (
    <div style={{ width: '100%' }}>
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: DIM, flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 3, background: GOLD, display: 'inline-block', borderRadius: 1 }} />{name1}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 3, background: BLUE, display: 'inline-block', borderRadius: 1 }} />{name2}
          </span>
          {trimmed && <span style={{ color: 'rgba(212,64,64,0.7)' }}>⚠ trimmed to shorter fight</span>}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Zoom controls — always on one line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: DIM, whiteSpace: 'nowrap' }}>
            {zoomPct}%
          </span>
          <input
            type="range"
            min={Math.max(5, Math.round(dur * 0.04))}
            max={dur}
            step={1}
            defaultValue={dur}
            style={{ width: 100, accentColor: GOLD, cursor: 'pointer' }}
            onInput={e => {
              const newWin = Number((e.target as HTMLInputElement).value)
              const centre = offsetSecRef.current + windowSecRef.current / 2
              windowSecRef.current = newWin
              const max = Math.max(0, dur - newWin)
              offsetSecRef.current = Math.max(0, Math.min(max, centre - newWin / 2))
              redraw()
            }}
          />
          <button
            onClick={() => { offsetSecRef.current = 0; redraw() }}
            style={{
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: 10,
              letterSpacing: '.6px', textTransform: 'uppercase', padding: '3px 8px',
              background: 'transparent', border: `1px solid ${BORDER}`,
              borderRadius: 3, color: DIM, cursor: 'pointer', whiteSpace: 'nowrap',
              opacity: offset > 0 ? 1 : 0.3,
            }}
          >
            ← Reset
          </button>
        </div>
      </div>

      {/* SVG chart */}
      <div
        ref={containerRef}
        style={{ width: '100%', cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        onMouseDown={onMouseDown}
      >
        <svg
          ref={svgRef}
          width={containerW}
          height={totalH}
          style={{ display: 'block' }}
        >
          <rect x={0} y={0} width={containerW} height={totalH} fill={BG} />
          <rect x={LABEL_W} y={0} width={chartW} height={HEADER_H} fill={BG_ALT} />

          {/* Grid lines + axis */}
          {axisTicks.map(t => {
            const x = tx(t)
            if (x < LABEL_W - 1 || x > containerW + 1) return null
            return (
              <g key={t}>
                <line x1={x} y1={HEADER_H} x2={x} y2={totalH} stroke={BORDER} strokeWidth={0.5} strokeOpacity={0.5} />
                <line x1={x} y1={HEADER_H - 5} x2={x} y2={HEADER_H} stroke={BORDER} strokeWidth={1} />
                <text x={x} y={HEADER_H - 7} textAnchor="middle" fontSize={8} fill={DIM} fontFamily="IBM Plex Mono, monospace">{t}s</text>
              </g>
            )
          })}

          {/* Rows */}
          {rows.map((row, ri) => {
            const y = HEADER_H + ri * ROW_H
            const mid = y + ROW_H / 2
            const vis1 = row.ts1.filter(t => t <= dur && inView(t))
            const vis2 = row.ts2.filter(t => t <= dur && inView(t))
            return (
              <g key={row.id}>
                <rect x={0} y={y} width={containerW} height={ROW_H} fill={ri % 2 === 0 ? BG_ALT : BG} />
                <text x={LABEL_W - 8} y={mid + 4} textAnchor="end" fontSize={10} fill={TEXT} fontFamily="IBM Plex Mono, monospace">
                  {row.name.length > 17 ? row.name.slice(0, 15) + '…' : row.name}
                </text>
                <line x1={LABEL_W} y1={mid} x2={containerW} y2={mid} stroke={BORDER} strokeWidth={0.4} strokeDasharray="4,5" />
                {vis1.map((t, ti) => (
                  <rect key={`a${ti}`} x={tx(t) - TICK_W / 2} y={mid - TICK_H - 1} width={TICK_W} height={TICK_H} fill={GOLD} rx={1}>
                    <title>{row.name} @ {t.toFixed(1)}s ({name1})</title>
                  </rect>
                ))}
                {vis2.map((t, ti) => (
                  <rect key={`b${ti}`} x={tx(t) - TICK_W / 2} y={mid + 2} width={TICK_W} height={TICK_H} fill={BLUE} rx={1}>
                    <title>{row.name} @ {t.toFixed(1)}s ({name2})</title>
                  </rect>
                ))}
              </g>
            )
          })}

          {/* Label column mask — covers ticks that drift into label area */}
          <rect x={0} y={0} width={LABEL_W - 1} height={totalH} fill={BG} />
          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={totalH} stroke={BORDER} strokeWidth={1} />
        </svg>
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: DIM, marginTop: 4, textAlign: 'right' }}>
        drag to pan · slide to zoom
      </div>
    </div>
  )
}
