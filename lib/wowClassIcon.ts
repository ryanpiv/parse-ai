/** Map WCL `type` / class string to Wowhead classicon slug (lowercase, no spaces). */
const WCL_CLASS_TO_SLUG: Record<string, string> = {
  DeathKnight: 'deathknight',
  DemonHunter: 'demonhunter',
  Druid: 'druid',
  Evoker: 'evoker',
  Hunter: 'hunter',
  Mage: 'mage',
  Monk: 'monk',
  Paladin: 'paladin',
  Priest: 'priest',
  Rogue: 'rogue',
  Shaman: 'shaman',
  Warlock: 'warlock',
  Warrior: 'warrior',
}

/** Small class icon URL for roster-style UI, or null if unknown. */
export function wclClassIconSmall(className: string | undefined | null): string | null {
  if (!className) return null
  const key = className.replace(/\s+/g, '')
  const slug = WCL_CLASS_TO_SLUG[className] ?? WCL_CLASS_TO_SLUG[key]
  if (!slug) return null
  return `https://wow.zamimg.com/images/wow/icons/small/classicon_${slug}.jpg`
}
