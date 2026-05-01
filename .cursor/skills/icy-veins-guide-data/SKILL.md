---
name: icy-veins-guide-data
description: >-
  Fetches and refreshes Icy Veins WoW guide snapshots for parse-ai (structured plain text + Midnight talent hashes).
  Use when updating knowledge/icy-veins scrapes, running npm run scrape-icy-veins-frost, or extending discovery from the class hub.
disable-model-invocation: true
---

# Icy Veins guide data (parse-ai)

## Canonical URLs per topic

For each **spec**, use the **dedicated guide page** for that topic — not the generic “spec hub” landing page.

Example (Frost Mage PvE DPS):

- **Talents only:** [Builds and Talents](https://www.icy-veins.com/wow/frost-mage-pve-dps-spec-builds-talents)
- **Rotation only:** [Rotation, Cooldowns, and Abilities](https://www.icy-veins.com/wow/frost-mage-pve-dps-rotation-cooldowns-abilities)

The scraper (`scripts/icy-veins/scrape-frost-mage.mjs`) fetches **those two URLs only** for the Frost pilot. Do not mix talent content from the overview/DPS guide page into the talents snapshot.

## Layout

- **Scraper scripts:** `scripts/icy-veins/` — `scrape-frost-mage.mjs`, `extractIcyVeinsChrome.mjs`, `discover-guide-urls.mjs`
- **Snapshots (committed):** `knowledge/icy-veins/scraped/mage-frost/*.json` plus `_index.json`
- **Hub link manifest:** `knowledge/icy-veins/class-guides-hub-links.json` (from `npm run discover-icy-veins-urls`)

Wowhead bundles live in `lib/knowledge/embeddedWowhead.ts`; Icy Veins is **not** wired into presets by default — label explicitly if you add an embed module.

## Refresh workflow

1. From repo root: `npm run scrape-icy-veins-frost`.
2. Confirm each page `snapshot.fetch.ok` is true in the written JSON.
3. Commit updated files under `knowledge/icy-veins/`.

Optional: `npm run discover-icy-veins-urls` to refresh the deduped path list from `https://www.icy-veins.com/wow/class-guides`.

## What gets scraped (shape)

Committed JSON is **structured plain text**, not raw `.page_content` HTML blobs.

### Talents page (`spec-builds-talents.json`)

- **`introPlain`** — prose before the first tab/image widget.
- **`recommendedTalentBuilds`** — one row per build tab: full tab label, title, notes with `SpellName[spellId]`, and **`midnightEmbedHash`** for IV’s embedded calculator.
- **`proseSections`** — remaining headings (Apex, Hero Talents, PvP, etc.) after stripping the talent **image_block** widget (no duplicate calculator HTML).
- **`relatedGuideUrls`** — links to the sibling rotation page (from breadcrumb TOC).

### Rotation page (`rotation-cooldowns-abilities.json`)

- **`introPlain`** — short intro before tab widgets.
- **`imageBlockPanels`** — each `image_block_content` panel: `rotation_tool_block_*` rotation tabs (with tab labels), `area_*` mechanics/cooldown tabs, plain body text with spells resolved to `Name[spellId]`.
- **`headingSections`** — outline sections with bounded body length (large tab bodies truncated with `… [truncated]`).

## Compliance

- Read `https://www.icy-veins.com/robots.txt` and site terms before automated or high-volume fetching.
- Prefer infrequent runs and committing snapshots so the app reads static JSON offline.

## Adding another spec

1. Duplicate `PAGES` in `scrape-frost-mage.mjs` (or generalize) with that spec’s **spec-builds-talents** and **rotation-cooldowns-abilities** URLs from the IV breadcrumb trail.
2. Keep the same JSON field names so downstream tooling stays stable.
