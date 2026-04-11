import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/* ---------- Wowhead tooltip fetcher + cache ---------- */

interface WowheadTooltipData {
  name: string
  icon: string
  tooltip: string
}

const cache = new Map<number, WowheadTooltipData | null>()
const inflight = new Map<number, Promise<WowheadTooltipData | null>>()

async function fetchTooltip(spellId: number): Promise<WowheadTooltipData | null> {
  if (cache.has(spellId)) return cache.get(spellId)!

  if (inflight.has(spellId)) return inflight.get(spellId)!

  const p = (async () => {
    try {
      const res = await fetch(
        `https://nether.wowhead.com/tooltip/spell/${spellId}?dataEnv=1&locale=0`
      )
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      const data: WowheadTooltipData = {
        name: json.name ?? '',
        icon: json.icon ?? '',
        tooltip: json.tooltip ?? '',
      }
      cache.set(spellId, data)
      return data
    } catch {
      cache.set(spellId, null)
      return null
    } finally {
      inflight.delete(spellId)
    }
  })()

  inflight.set(spellId, p)
  return p
}

/* ---------- Context ---------- */

interface TooltipCtx {
  show: (spellId: number, rect: DOMRect) => void
  hide: () => void
}

const Ctx = createContext<TooltipCtx>({ show: () => {}, hide: () => {} })

export const useSpellTooltip = () => useContext(Ctx)

/* ---------- Provider + floating tooltip ---------- */

export function SpellTooltipProvider({ children }: { children: ReactNode }) {
  const [html, setHtml] = useState<string | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const activeSpell = useRef<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((spellId: number, rect: DOMRect) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    activeSpell.current = spellId

    setPos({ x: rect.right + 12, y: rect.top })
    setHtml(null) // clear previous while loading

    void fetchTooltip(spellId).then(data => {
      if (activeSpell.current !== spellId) return
      if (data) {
        setHtml(data.tooltip)
      } else {
        setHtml(null)
        setPos(null)
      }
    })
  }, [])

  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => {
      activeSpell.current = null
      setHtml(null)
      setPos(null)
    }, 80)
  }, [])

  return (
    <Ctx.Provider value={{ show, hide }}>
      {children}
      {pos && (
        <TooltipPopup html={html} x={pos.x} y={pos.y} />
      )}
    </Ctx.Provider>
  )
}

/* ---------- Popup renderer ---------- */

function TooltipPopup({ html, x, y }: { html: string | null; x: number; y: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [adj, setAdj] = useState({ x, y })

  useEffect(() => {
    const el = ref.current
    if (!el) { setAdj({ x, y }); return }
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let ax = x, ay = y
    if (ax + rect.width > vw - 8) ax = x - rect.width - 24
    if (ay + rect.height > vh - 8) ay = vh - rect.height - 8
    if (ax < 4) ax = 4
    if (ay < 4) ay = 4
    setAdj({ x: ax, y: ay })
  }, [x, y, html])

  return (
    <div ref={ref} style={{
      position: 'fixed',
      left: adj.x,
      top: adj.y,
      zIndex: 9999,
      pointerEvents: 'none',
      maxWidth: 340,
      minWidth: 220,
    }}>
      <div className="wh-tooltip-wrapper">
        {html ? (
          <div
            className="wh-tooltip-inner"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="wh-tooltip-loading">Loading…</div>
        )}
      </div>
    </div>
  )
}

/* ---------- Inline styles injected once ---------- */

const TOOLTIP_CSS = `
.wh-tooltip-wrapper {
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 8px 10px;
  font-family: Verdana, Arial, sans-serif;
  font-size: 12px;
  line-height: 1.45;
  color: #fff;
  box-shadow: 0 4px 20px rgba(0,0,0,0.7);
}
.wh-tooltip-loading {
  color: #888;
  font-size: 11px;
  font-style: italic;
  padding: 4px 0;
}
/* Wowhead tooltip class overrides */
.wh-tooltip-inner table { border-collapse: collapse; width: 100%; }
.wh-tooltip-inner td, .wh-tooltip-inner th {
  padding: 1px 0;
  vertical-align: top;
  font-weight: normal;
}
.wh-tooltip-inner th { text-align: right; color: #aaa; }
.wh-tooltip-inner .whtt-name { font-size: 13px; }
.wh-tooltip-inner a { color: #fff; text-decoration: none; pointer-events: none; }
.wh-tooltip-inner b { font-weight: 700; }
.wh-tooltip-inner .q { color: #ffd100; }
.wh-tooltip-inner .q0 { color: #9d9d9d; font-size: 11px; }
.wh-tooltip-inner .q1 { color: #fff; }
.wh-tooltip-inner .q2 { color: #1eff00; }
.wh-tooltip-inner .q3 { color: #0070dd; }
.wh-tooltip-inner .q4 { color: #a335ee; }
.wh-tooltip-inner .q5 { color: #ff8000; }
.wh-tooltip-inner .wowhead-tooltip-requirements { color: #888; font-size: 11px; margin-top: 2px; }
`

if (typeof document !== 'undefined') {
  const id = '__wh-tooltip-css'
  if (!document.getElementById(id)) {
    const el = document.createElement('style')
    el.id = id
    el.textContent = TOOLTIP_CSS
    document.head.appendChild(el)
  }
}
