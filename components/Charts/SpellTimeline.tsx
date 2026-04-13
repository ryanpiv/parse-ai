import { useState, useRef, useCallback, useEffect, useMemo, useId } from 'react'
import type { CastTimelineSegment } from '../../lib/gameState/castTimeline'

const GOLD = 'rgba(201,162,39,0.95)'
const BLUE = 'rgba(90,173,240,0.95)'
const BG = '#0a0c0f'
const BG_ALT = '#0d1014'
const BORDER = '#2a3340'
const DIM = '#4a5a6a'
const TEXT = '#8a9bb0'
const CANCEL_STROKE = 'rgba(212,72,72,0.95)'

const ROW_PLAYER = 22
const SPELL_LABEL_H = 14
const GROUP_GAP = 8
const LABEL_W = 168
const HEADER_H = 22
const ICON_SZ = 14

export type SpellTimelineGroup = {
  spellId: number
  name: string
  segments1: CastTimelineSegment[]
  segments2: CastTimelineSegment[]
}

interface Props {
  groups: SpellTimelineGroup[]
  name1: string
  name2: string
  dur1: number
  dur2: number
  color1?: string
  color2?: string
  /** Single-player row per spell (player 1 only). */
  solo?: boolean
}

function segmentIntersectsView(s: CastTimelineSegment, dur: number, offset: number, windowSec: number): boolean {
  const pad = 1
  return s.tEnd >= offset - pad && s.tStart <= offset + windowSec + pad && s.tStart <= dur + pad
}

export function SpellTimeline({ groups, name1, name2, dur1, dur2, color1 = GOLD, color2 = BLUE, solo }: Props) {
  const dur = solo ? dur1 : Math.min(dur1, dur2)
  const c1 = color1
  const c2 = color2

  const windowSecRef = useRef(dur)
  const offsetSecRef = useRef(0)
  const [, forceRender] = useState(0)
  const redraw = useCallback(() => forceRender(n => n + 1), [])

  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null)
  const [containerW, setContainerW] = useState(800)
  const [isDragging, setIsDragging] = useState(false)

  const clipUid = useId().replace(/:/g, '')
  const clipPathId = `spellTlClip-${clipUid}`

  const spellIdsSig = useMemo(() => groups.map(g => g.spellId).join(','), [groups])
  const [icons, setIcons] = useState<Record<number, string>>({})

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

  useEffect(() => {
    if (!spellIdsSig) return
    const ids = spellIdsSig.split(',').map(s => parseInt(s, 10)).filter(n => n > 0)
    let cancelled = false
    ;(async () => {
      const next: Record<number, string> = {}
      const batch = ids.slice(0, 48)
      for (const id of batch) {
        try {
          const res = await fetch(`/api/tooltip?id=${id}`)
          if (!res.ok) continue
          const d = await res.json()
          if (d.icon) next[id] = `https://wow.zamimg.com/images/wow/icons/small/${d.icon}.jpg`
        } catch {
          /* ignore */
        }
        if (cancelled) return
      }
      if (!cancelled) setIcons(prev => ({ ...prev, ...next }))
    })()
    return () => {
      cancelled = true
    }
  }, [spellIdsSig])

  const windowSec = windowSecRef.current
  const offset = Math.min(offsetSecRef.current, Math.max(0, dur - windowSec))
  const chartW = Math.max(120, containerW - LABEL_W)

  function tx(t: number) {
    return LABEL_W + ((t - offset) / windowSec) * chartW
  }

  function inViewSeg(s: CastTimelineSegment) {
    return segmentIntersectsView(s, dur, offset, windowSec)
  }

  const tickInterval = windowSec <= 20 ? 5 : windowSec <= 60 ? 10 : windowSec <= 150 ? 20 : 30
  const axisTicks: number[] = []
  const first = Math.ceil(offset / tickInterval) * tickInterval
  for (let t = first; t <= offset + windowSec + 0.1; t += tickInterval) axisTicks.push(+t.toFixed(1))

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startX: e.clientX, startOffset: offsetSecRef.current }
      setIsDragging(true)
      e.preventDefault()
    },
    []
  )

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const w = windowSecRef.current
      const cw = Math.max(120, containerW - LABEL_W)
      const dSec = -(dx / cw) * w
      const max = Math.max(0, dur - w)
      offsetSecRef.current = Math.max(0, Math.min(max, dragRef.current.startOffset + dSec))
      redraw()
    },
    [containerW, dur, redraw]
  )

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

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const zoomMod = e.metaKey || e.ctrlKey
      if (zoomMod) {
        e.preventDefault()
        const dy = e.deltaY
        const factor = dy > 0 ? 1.08 : 0.92
        let newW = windowSecRef.current * factor
        const minW = Math.max(5, Math.round(dur * 0.04))
        newW = Math.min(dur, Math.max(minW, newW))
        const center = offsetSecRef.current + windowSecRef.current / 2
        windowSecRef.current = newW
        const maxOff = Math.max(0, dur - newW)
        offsetSecRef.current = Math.max(0, Math.min(maxOff, center - newW / 2))
        redraw()
        return
      }
      const panX =
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.shiftKey
            ? e.deltaY
            : 0
      if (Math.abs(panX) > 1) {
        e.preventDefault()
        const cw = Math.max(120, containerW - LABEL_W)
        const maxOff = Math.max(0, dur - windowSecRef.current)
        offsetSecRef.current += (panX / cw) * windowSecRef.current
        offsetSecRef.current = Math.max(0, Math.min(maxOff, offsetSecRef.current))
        redraw()
      }
    },
    [containerW, dur, redraw]
  )

  if (!groups.length) return null

  const rowsPerSpell = solo ? 1 : 2
  const blockH = SPELL_LABEL_H + rowsPerSpell * ROW_PLAYER
  const totalH = HEADER_H + groups.length * blockH + Math.max(0, groups.length - 1) * GROUP_GAP
  const zoomPct = Math.round((dur / windowSec) * 100)
  const trimmed = !solo && dur < Math.max(dur1, dur2)

  const minWin = Math.max(5, Math.round(dur * 0.04))

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: DIM, flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: c1, borderRadius: 2, display: 'inline-block' }} />
            {name1}
          </span>
          {!solo && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, background: c2, borderRadius: 2, display: 'inline-block' }} />
              {name2}
            </span>
          )}
          {trimmed && <span style={{ color: 'rgba(212,64,64,0.75)' }}>trimmed to shorter fight</span>}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: DIM, whiteSpace: 'nowrap' }}>{zoomPct}%</span>
          <input
            type="range"
            min={minWin}
            max={dur}
            step={1}
            value={windowSec}
            style={{ width: 100, accentColor: GOLD, cursor: 'pointer' }}
            onChange={e => {
              const newWin = Number(e.target.value)
              const centre = offsetSecRef.current + windowSecRef.current / 2
              windowSecRef.current = newWin
              const max = Math.max(0, dur - newWin)
              offsetSecRef.current = Math.max(0, Math.min(max, centre - newWin / 2))
              redraw()
            }}
          />
          <button
            type="button"
            onClick={() => {
              windowSecRef.current = dur
              offsetSecRef.current = 0
              redraw()
            }}
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: '.6px',
              textTransform: 'uppercase',
              padding: '3px 8px',
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: 3,
              color: DIM,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'pan-y',
        }}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
      >
        <svg width={containerW} height={totalH} style={{ display: 'block' }}>
          <defs>
            <clipPath id={clipPathId}>
              <rect x={LABEL_W} y={HEADER_H} width={chartW} height={totalH - HEADER_H} />
            </clipPath>
          </defs>
          <rect x={0} y={0} width={containerW} height={totalH} fill={BG} />
          <rect x={LABEL_W} y={0} width={chartW} height={HEADER_H} fill={BG_ALT} />

          {axisTicks.map(t => {
            const x = tx(t)
            if (x < LABEL_W - 1 || x > containerW + 1) return null
            return (
              <g key={t}>
                <line x1={x} y1={HEADER_H} x2={x} y2={totalH} stroke={BORDER} strokeWidth={0.5} strokeOpacity={0.5} />
                <line x1={x} y1={HEADER_H - 5} x2={x} y2={HEADER_H} stroke={BORDER} strokeWidth={1} />
                <text x={x} y={HEADER_H - 7} textAnchor="middle" fontSize={8} fill={DIM} fontFamily="IBM Plex Mono, monospace">
                  {t}s
                </text>
              </g>
            )
          })}

          {groups.map((g, gi) => {
            const yBase = HEADER_H + gi * (blockH + GROUP_GAP)
            const yRows = yBase + SPELL_LABEL_H

            const renderPlayerRow = (
              playerIdx: 0 | 1,
              segments: CastTimelineSegment[],
              fill: string,
              pName: string
            ) => {
              const y = yRows + playerIdx * ROW_PLAYER
              const mid = y + ROW_PLAYER / 2
              const vis = segments.filter(s => s.tEnd <= dur + 0.01 && inViewSeg(s))
              return (
                <g key={playerIdx}>
                  <rect x={0} y={y} width={containerW} height={ROW_PLAYER} fill={(gi + playerIdx) % 2 === 0 ? BG_ALT : BG} />
                  <line x1={LABEL_W} y1={mid} x2={containerW} y2={mid} stroke={BORDER} strokeWidth={0.35} strokeDasharray="3,4" />
                  <g clipPath={`url(#${clipPathId})`}>
                    {vis.map((seg, si) => {
                      const x0 = tx(seg.tStart)
                      const x1 = tx(Math.min(seg.tEnd, dur))
                      const rawW = x1 - x0
                      const iconHref = icons[g.spellId]
                      const iconW = iconHref ? ICON_SZ + 4 : 0
                      const w = Math.max(seg.instant ? 5 : 3, rawW)
                      const barX = x0
                      const barH = ROW_PLAYER - 10
                      const barY = y + 5
                      const stroke = seg.cancelled ? CANCEL_STROKE : 'none'
                      const strokeW = seg.cancelled ? 1.5 : 0
                      const fillOp = seg.cancelled ? 0.35 : 0.55
                      return (
                        <g key={`${playerIdx}-${si}-${seg.tStart}`}>
                          {iconHref ? (
                            <image
                              href={iconHref}
                              x={barX - 1}
                              y={barY - 1}
                              width={ICON_SZ + 2}
                              height={ICON_SZ + 2}
                              preserveAspectRatio="xMidYMid slice"
                              style={{ opacity: 0.95 }}
                            />
                          ) : null}
                          <rect
                            x={barX + iconW}
                            y={barY}
                            width={Math.max(2, w - iconW)}
                            height={barH}
                            fill={fill}
                            fillOpacity={fillOp}
                            stroke={stroke}
                            strokeWidth={strokeW}
                            rx={2}
                          >
                            <title>
                              {seg.name} — {pName}
                              {seg.instant ? ' (instant)' : ''}
                              {seg.cancelled ? ' (cancelled / clipped)' : ''} · {seg.tStart.toFixed(2)}s → {seg.tEnd.toFixed(2)}s
                            </title>
                          </rect>
                        </g>
                      )
                    })}
                  </g>
                </g>
              )
            }

            return (
              <g key={g.spellId}>
                <rect x={0} y={yBase} width={containerW} height={SPELL_LABEL_H} fill={BG_ALT} opacity={0.85} />
                {renderPlayerRow(0, g.segments1, c1, name1)}
                {!solo && renderPlayerRow(1, g.segments2, c2, name2)}
              </g>
            )
          })}

          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={totalH} stroke={BORDER} strokeWidth={1} />

          {groups.map((g, gi) => {
            const yBase = HEADER_H + gi * (blockH + GROUP_GAP)
            const yRows = yBase + SPELL_LABEL_H
            const spellLabel =
              g.name.length > 22 ? `${g.name.slice(0, 20)}…` : g.name
            return (
              <g key={`lab-${g.spellId}`}>
                <rect x={0} y={yBase} width={LABEL_W - 2} height={blockH} fill={BG} />
                <text
                  x={LABEL_W - 10}
                  y={yBase + 11}
                  textAnchor="end"
                  fontSize={9}
                  fill={TEXT}
                  fontFamily="IBM Plex Mono, monospace"
                  fontWeight={600}
                  letterSpacing="0.04em"
                  style={{ textTransform: 'uppercase' }}
                >
                  {spellLabel}
                </text>
                <text
                  x={LABEL_W - 10}
                  y={yRows + ROW_PLAYER / 2 + 4}
                  textAnchor="end"
                  fontSize={9}
                  fill={DIM}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {name1.length > 14 ? `${name1.slice(0, 12)}…` : name1}
                </text>
                {!solo && (
                  <>
                    <text
                      x={LABEL_W - 10}
                      y={yRows + ROW_PLAYER + ROW_PLAYER / 2 + 4}
                      textAnchor="end"
                      fontSize={9}
                      fill={DIM}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {name2.length > 14 ? `${name2.slice(0, 12)}…` : name2}
                    </text>
                    <rect x={LABEL_W - 12} y={yRows + ROW_PLAYER + 5} width={3} height={ROW_PLAYER - 10} fill={c2} rx={1} opacity={0.9} />
                  </>
                )}
                <rect x={LABEL_W - 12} y={yRows + 5} width={3} height={ROW_PLAYER - 10} fill={c1} rx={1} opacity={0.9} />
              </g>
            )
          })}
        </svg>
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: DIM, marginTop: 4, textAlign: 'right' }}>
        drag to pan · horizontal scroll (trackpad) or Shift + mouse wheel · ⌘/Ctrl + scroll to zoom · slider to zoom
      </div>
    </div>
  )
}
