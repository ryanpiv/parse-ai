/**
 * Bundled class guide snippets for Claude (client-safe). Keep in sync with
 * knowledge/guides/bodies/<specId>.md and knowledge/guides/manifest.json when editing.
 *
 * Source policy: summaries are authored from Wowhead only (see knowledge/guides/README.md).
 */

export type GuideMeta = {
  title: string
  sourceUrl: string
  asOf: string
}

export const GUIDE_META_BY_SPEC_ID: Partial<Record<number, GuideMeta>> = {
  64: {
    title: 'Frost Mage — PvE DPS (Wowhead)',
    sourceUrl: 'https://www.wowhead.com/guide/classes/mage/frost/overview-pve-dps',
    asOf: '2026-04-12',
  },
}

/** Markdown body only (no outer prompt wrapper). */
const FROST_MAGE_64 = `**Sourcing:** This block is maintained **only** from Wowhead Frost Mage PvE guides (not Icy Veins or other sites). Exact priority order and openers change by patch—reconcile with the live pages below when this file is edited.

**Canonical Wowhead pages (read these when refreshing this summary):**

- Overview: https://www.wowhead.com/guide/classes/mage/frost/overview-pve-dps
- Rotation, cooldowns, abilities: https://www.wowhead.com/guide/classes/mage/frost/rotation-cooldowns-pve-dps
- Cheat sheet: https://www.wowhead.com/guide/classes/mage/frost/cheat-sheet
- Hero talents (Frostfire vs Spellslinger): https://www.wowhead.com/guide/classes/mage/frost/hero-talents

## Overview / build focus

Midnight / current Frost Mage raid play revolves around **proc flow** (**Fingers of Frost**, **Brain Freeze** / **Flurry**) and, on live Wowhead, **Freezing** stack rules that differ by **hero talent** (**Frostfire** vs **Spellslinger**) and by ST vs AoE. **Use the player's talents and casts in the log** to infer which branch applies; do not assume one static priority list.

## Opener / priority

- **Do not hard-code a pull opener here**—use the **ST vs AoE openers** and the numbered **priority lists** from Wowhead's **Rotation, Cooldowns, and Abilities** page for the hero talent that matches the report.
- Wowhead presents separate curves for Frostfire vs Spellslinger; treat a mismatch between summary and log as a sign to trust **log + talents**.

## Major cooldowns (spell names)

- **Ray of Frost** and **Frozen Orb** are central offensive tools on current Wowhead pages; cadence and ordering vs generators are spelled out per loadout.
- **Icy Veins** (the **haste cooldown spell**) is still a major throughput button when relevant to the build; compare **timing and count per fight** in the data.

## Talent / hero caveats

- **Frostfire** vs **Spellslinger** changes rotation, fillers (e.g. **Frostfire Bolt** vs **Frostbolt** in places), and how often **Orb** / **Comet Storm** / **Glacial Spike** appear—match recommendations to **talent diff + cast list**.
- Optional nodes (cleave swaps, etc.) are listed on Wowhead's **Talents** / cheat sheet pages—only mention swaps that fit the player's actual tree.

## Common mistakes (log-shaped)

- Casting **Ice Lance** at wrong **Freezing** thresholds for the player's hero talent (Wowhead documents different breakpoints—verify on rotation page).
- **Overcapping** **Fingers of Frost** / **Brain Freeze** or delaying **Flurry** windows shown in cast timelines.
- Misaligned **Ray of Frost** / **Frozen Orb** relative to fight length or movement (see timestamps vs comparison player).
- Using **AoE priority** on true ST or vice versa; Wowhead calls out target-count breakpoints—compare to encounter.

---

Sources: **Wowhead only** — URLs above · summarized for parse-ai · as of 2026-04-12
`

export const GUIDE_BODY_BY_SPEC_ID: Partial<Record<number, string>> = {
  64: FROST_MAGE_64,
}

/** Text to append after CRITICAL RULES when a guide exists for this specId. */
export function getClassGuideSupplement(specId: number | undefined | null): string {
  if (specId == null || Number.isNaN(specId)) return ''
  const meta = GUIDE_META_BY_SPEC_ID[specId]
  const body = GUIDE_BODY_BY_SPEC_ID[specId]
  if (!meta || !body) return ''
  return (
    `=== CLASS REFERENCE (supplementary) ===\n` +
    `The following is a SHORT SUMMARY for parse-ai. It is authored from **Wowhead guides only** (see primary URL below); do **not** treat Icy Veins or other third-party guide sites as cited sources for this block.\n` +
    `Primary Wowhead URL: ${meta.sourceUrl} · title: ${meta.title} · summarized as of ${meta.asOf}.\n` +
    `RULES: Prefer fight data, talents, and casts below over this summary when they conflict. ` +
    `Do not recommend spells that never appear in the data. Cite this as "Wowhead-based guide summary" when you use it.\n\n` +
    `${body}\n\n`
  )
}
