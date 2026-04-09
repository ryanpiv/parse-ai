let _ttEl: HTMLDivElement | null = null
let _ttTimer: ReturnType<typeof setTimeout> | null = null
let _ttActive: string | null = null

function getTT(): HTMLDivElement | null {
  if (!_ttEl && typeof document !== 'undefined') {
    _ttEl = document.createElement('div')
    _ttEl.style.cssText =
      'position:fixed;z-index:9999;pointer-events:none;background:#111418;border:1px solid #2a3340;border-radius:6px;padding:0;max-width:320px;font-size:12px;color:#e8edf2;font-family:IBM Plex Sans,sans-serif;display:none;box-shadow:0 6px 24px rgba(0,0,0,.8);overflow:hidden'
    document.body.appendChild(_ttEl)
  }
  return _ttEl
}

function positionTT(e: MouseEvent) {
  const el = getTT()
  if (!el) return
  const x = Math.min(e.clientX + 16, window.innerWidth - 336)
  const y = Math.min(e.clientY + 16, window.innerHeight - 260)
  el.style.left = x + 'px'
  el.style.top = y + 'px'
}

async function showTT(e: MouseEvent, spellId: string, knownName?: string) {
  if (_ttActive === spellId) {
    positionTT(e)
    return
  }
  if (_ttTimer) clearTimeout(_ttTimer)
  _ttActive = spellId
  const el = getTT()
  if (!el) return
  el.style.display = 'block'
  el.innerHTML =
    '<div style="padding:10px 12px;color:#4a5a6a;font-family:IBM Plex Mono,monospace;font-size:11px">Loading...</div>'
  positionTT(e)
  try {
    const res = await fetch(
      `https://nether.wowhead.com/tooltip/spell/${spellId}?dataEnv=11&locale=0`
    )
    const d = await res.json()
    if (_ttActive !== spellId) return
    const iconUrl = d.icon
      ? `https://wow.zamimg.com/images/wow/icons/medium/${d.icon}.jpg`
      : ''
    const displayName = knownName || d.name || 'Spell ' + spellId
    const header = `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #1e252e;background:#0a0c0f">
      ${iconUrl ? `<img src="${iconUrl}" style="width:36px;height:36px;border-radius:4px;border:1px solid #2a3340;flex-shrink:0" onerror="this.style.display='none'"/>` : ''}
      <div style="font-family:Rajdhani,sans-serif;font-size:15px;font-weight:600;color:#e8be40;letter-spacing:.5px">${displayName}</div>
    </div>`
    const body = (d.tooltip || '')
      .replace(/<table[^>]*>/gi, '<div>')
      .replace(/<\/table>/gi, '</div>')
      .replace(/<tr[^>]*>/gi, '<div style="margin-bottom:2px">')
      .replace(/<\/tr>/gi, '</div>')
      .replace(/<td[^>]*>/gi, '<span style="margin-right:4px">')
      .replace(/<\/td>/gi, '</span>')
      .replace(/<th[^>]*>.*?<\/th>/gi, '')
    el.innerHTML =
      header +
      `<div style="padding:10px 12px;font-size:12px;color:#8a9bb0;line-height:1.6;max-height:200px;overflow-y:auto">${body || 'Spell ID: ' + spellId}</div>`
    positionTT(e)
  } catch {
    if (_ttActive !== spellId) return
    el.innerHTML = `<div style="padding:10px 12px"><span style="color:#e8be40;font-family:Rajdhani,sans-serif">${knownName || 'Spell ' + spellId}</span></div>`
  }
}

function hideTT() {
  if (_ttTimer) clearTimeout(_ttTimer)
  _ttActive = null
  _ttTimer = setTimeout(() => {
    if (_ttEl) _ttEl.style.display = 'none'
  }, 150)
}

export function initTooltipDelegation() {
  if (typeof document === 'undefined') return

  document.addEventListener('mouseover', (e) => {
    const a = (e.target as HTMLElement).closest('a[data-wh-spell]') as HTMLElement | null
    if (a) {
      showTT(e, a.dataset.whSpell!, a.dataset.whName)
      e.stopPropagation()
    }
  })
  document.addEventListener('mousemove', (e) => {
    if ((e.target as HTMLElement).closest('a[data-wh-spell]')) positionTT(e)
  })
  document.addEventListener('mouseout', (e) => {
    const a = (e.target as HTMLElement).closest('a[data-wh-spell]') as HTMLElement | null
    if (a && !a.contains(e.relatedTarget as Node)) hideTT()
  })
}

if (typeof document !== 'undefined') {
  initTooltipDelegation()
}
