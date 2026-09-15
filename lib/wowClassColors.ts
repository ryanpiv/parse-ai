/**
 * Standard Blizzard class colors, keyed by normalized class name. WCL returns
 * class names in CamelCase without spaces ("DeathKnight"); normalize before
 * lookup so display names ("Death Knight") also match.
 */
const CLASS_COLORS: Record<string, string> = {
  deathknight: '#C41E3A',
  demonhunter: '#A330C9',
  druid: '#FF7C0A',
  evoker: '#33937F',
  hunter: '#AAD372',
  mage: '#3FC7EB',
  monk: '#00FF98',
  paladin: '#F48CBA',
  priest: '#FFFFFF',
  rogue: '#FFF468',
  shaman: '#0070DD',
  warlock: '#8788EE',
  warrior: '#C69B6D',
}

export function wowClassColor(className: string | undefined | null): string {
  const key = String(className || '').replace(/[^a-z]/gi, '').toLowerCase()
  return CLASS_COLORS[key] ?? 'var(--text)'
}

/** "DeathKnight" → "Death Knight" for display. */
export function wowClassDisplayName(className: string | undefined | null): string {
  return String(className || '').replace(/([a-z])([A-Z])/g, '$1 $2')
}
