/** `hero_spellslinger` → UI label (Compare column headers). */
export function heroTreeShortLabel(heroType: string): string {
  return heroType.replace(/^hero_/, '').replace(/_/g, ' ')
}

/** Title case for preview headers (e.g. "Spellslinger"). */
export function heroTreeTitleLabel(heroType: string): string {
  return heroTreeShortLabel(heroType).replace(/\b\w/g, c => c.toUpperCase())
}
