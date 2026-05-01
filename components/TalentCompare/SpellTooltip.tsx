import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/* ---------- Wowhead tooltip fetcher + cache (spell + talent) ---------- */

interface WowheadTooltipData {
  name: string
  icon: string
  tooltip: string
}

const cache = new Map<string, WowheadTooltipData | null>()
const inflight = new Map<string, Promise<WowheadTooltipData | null>>()

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cacheKey(type: 'spell' | 'talent', id: number): string {
  return `${type}:${id}`
}

async function fetchTooltipRemote(id: number, type: 'spell' | 'talent'): Promise<WowheadTooltipData | null> {
  const k = cacheKey(type, id)
  if (cache.has(k)) return cache.get(k)!

  if (inflight.has(k)) return inflight.get(k)!

  const p = (async () => {
    try {
      const q = type === 'spell' ? `/api/tooltip?id=${id}` : `/api/tooltip?id=${id}&type=talent`
      const res = await fetch(q)
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      const data: WowheadTooltipData = {
        name: json.name ?? '',
        icon: json.icon ?? '',
        tooltip: json.tooltip ?? '',
      }
      cache.set(k, data)
      return data
    } catch {
      cache.set(k, null)
      return null
    } finally {
      inflight.delete(k)
    }
  })()

  inflight.set(k, p)
  return p
}

/** Prefer spell HTML; if empty, use talent HTML (Wowhead often omits spell tooltip for passives). */
async function resolveTooltipHtml(
  spellId: number,
  talentId: number | undefined,
  blizzardDesc: string | undefined,
  fallbackName: string | undefined
): Promise<string | null> {
  let spell: WowheadTooltipData | null = null
  let talent: WowheadTooltipData | null = null

  if (spellId > 0) spell = await fetchTooltipRemote(spellId, 'spell')
  if (talentId && talentId > 0) talent = await fetchTooltipRemote(talentId, 'talent')

  const spellTip = spell?.tooltip?.trim() || ''
  const talentTip = talent?.tooltip?.trim() || ''

  if (spellTip) return spell!.tooltip
  if (talentTip) return talent!.tooltip

  const name = spell?.name || talent?.name || fallbackName || ''
  const icon = spell?.icon || talent?.icon || ''
  const bDesc = (blizzardDesc || '').trim()
  if (name || icon || bDesc) {
    return buildNameFallback({ name, icon, tooltip: '' }, bDesc || undefined)
  }
  return null
}

/* ---------- Context ---------- */

interface TooltipBlizzardMeta {
  description?: string
  talentId?: number
}

interface TooltipCtx {
  show: (spellId: number, rect: DOMRect, fallbackName?: string, blizzard?: TooltipBlizzardMeta) => void
  hide: () => void
}

const Ctx = createContext<TooltipCtx>({ show: () => {}, hide: () => {} })

function buildNameFallback(data: WowheadTooltipData, blizzardDesc?: string): string {
  const iconPart = data.icon
    ? `<img src="https://wow.zamimg.com/images/wow/icons/small/${data.icon}.jpg" alt="" width="36" height="36" style="float:left;margin-right:8px;border-radius:3px;vertical-align:top"/>`
    : ''
  const desc = (blizzardDesc || '').trim()
  const descPart = desc
    ? `<div style="color:#bbb;font-size:11px;margin-top:8px;line-height:1.45;clear:both">${escapeHtml(desc)}</div>`
    : ''
  const title = data.name || 'Talent'
  return `<div class="wh-tooltip-inner" style="overflow:auto">${iconPart}<div class="q q3" style="overflow:hidden">${escapeHtml(title)}</div>${descPart}</div>`
}

export const useSpellTooltip = () => useContext(Ctx)

/* ---------- Provider + floating tooltip ---------- */

export function SpellTooltipProvider({ children }: { children: ReactNode }) {
  const [html, setHtml] = useState<string | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchGeneration = useRef(0)

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    cancelHide()
    hideTimer.current = setTimeout(() => {
      setHtml(null)
      setPos(null)
      hideTimer.current = null
    }, 280)
  }, [cancelHide])

  const show = useCallback(
    (spellId: number, rect: DOMRect, fallbackName?: string, blizzard?: TooltipBlizzardMeta) => {
      cancelHide()
      const gen = ++fetchGeneration.current

      setPos({ x: rect.right + 12, y: rect.top })
      setHtml(null)

      const talentId = blizzard?.talentId
      const bDesc = blizzard?.description

      if (spellId <= 0 && (!talentId || talentId <= 0)) {
        if (fallbackName) {
          setHtml(buildNameFallback({ name: fallbackName, icon: '', tooltip: '' }, bDesc))
        } else {
          setPos(null)
        }
        return
      }

      void resolveTooltipHtml(spellId, talentId, bDesc, fallbackName).then(result => {
        if (gen !== fetchGeneration.current) return
        if (result) setHtml(result)
        else {
          setHtml(null)
          setPos(null)
        }
      })
    },
    [cancelHide]
  )

  const hide = useCallback(() => {
    fetchGeneration.current += 1
    scheduleHide()
  }, [scheduleHide])

  return (
    <Ctx.Provider value={{ show, hide }}>
      {children}
      {pos && (
        <TooltipPopup
          html={html}
          x={pos.x}
          y={pos.y}
          onPopupEnter={cancelHide}
          onPopupLeave={scheduleHide}
        />
      )}
    </Ctx.Provider>
  )
}

/* ---------- Popup renderer ---------- */

function TooltipPopup({
  html,
  x,
  y,
  onPopupEnter,
  onPopupLeave,
}: {
  html: string | null
  x: number
  y: number
  onPopupEnter: () => void
  onPopupLeave: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [adj, setAdj] = useState({ x, y })

  useEffect(() => {
    const el = ref.current
    if (!el) {
      setAdj({ x, y })
      return
    }
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let ax = x,
      ay = y
    if (ax + rect.width > vw - 8) ax = x - rect.width - 24
    if (ay + rect.height > vh - 8) ay = vh - rect.height - 8
    if (ax < 4) ax = 4
    if (ay < 4) ay = 4
    setAdj({ x: ax, y: ay })
  }, [x, y, html])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: adj.x,
        top: adj.y,
        zIndex: 9999,
        pointerEvents: 'auto',
        maxWidth: 340,
        minWidth: 220,
      }}
      onMouseEnter={onPopupEnter}
      onMouseLeave={onPopupLeave}
    >
      <div
        className="wh-tooltip-wrapper"
        style={{
          maxHeight: 'min(70vh, 420px)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
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
