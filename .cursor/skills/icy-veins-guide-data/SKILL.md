---
name: icy-veins-guide-data
description: >-
  Fetches and refreshes Icy Veins WoW guide snapshots for parse-ai (structured plain text + Midnight talent hashes).
  Use when updating knowledge/icy-veins scrapes, running npm run scrape-icy-veins-frost or scrape-icy-veins-unholy,
  or extending discovery from the class hub.
disable-model-invocation: true
---

# Icy Veins guide data (parse-ai)

## Canonical URLs per topic

For each **spec**, use the **dedicated guide page** for that topic — not the generic “spec hub” landing page.

Example — **Frost Mage** PvE DPS:

- **Talents:** [Builds and Talents](https://www.icy-veins.com/wow/frost-mage-pve-dps-spec-builds-talents)
- **Rotation:** [Rotation, Cooldowns, and Abilities](https://www.icy-veins.com/wow/frost-mage-pve-dps-rotation-cooldowns-abilities)

Example — **Unholy Death Knight** PvE DPS:

- **Talents:** [Builds and Talents](https://www.icy-veins.com/wow/unholy-death-knight-pve-dps-spec-builds-talents)
- **Rotation:** [Rotation, Cooldowns, and Abilities](https://www.icy-veins.com/wow/unholy-death-knight-pve-dps-rotation-cooldowns-abilities)

Per-spec scrapers (`scrape-frost-mage.mjs`, `scrape-unholy-dk.mjs`) fetch **only** those two URLs for that spec — not the generic spec hub landing page.

## Layout

- **Scraper scripts:** `scripts/icy-veins/` — `scrape-frost-mage.mjs`, `scrape-unholy-dk.mjs`, `extractIcyVeinsChrome.mjs`, `discover-guide-urls.mjs`
- **Snapshots (committed):** `knowledge/icy-veins/scraped/mage-frost/*.json`, `knowledge/icy-veins/scraped/death-knight-unholy/*.json` (each with `_index.json`, **`canonicalPages`**, `snapshotMetaOnly` per page)
- **Hub link manifest:** `knowledge/icy-veins/class-guides-hub-links.json` (from `npm run discover-icy-veins-urls`)

Wowhead bundles live in `lib/knowledge/embeddedWowhead.ts`; Icy Veins is **not** wired into presets by default — label explicitly if you add an embed module.

## Refresh workflow

1. From repo root: `npm run scrape-icy-veins-frost` and/or `npm run scrape-icy-veins-unholy`.
2. Confirm each page `snapshot.fetch.ok` is true in the written JSON (and optionally compare `snapshot.icyVeinsArticle.dateModified` / headline patch text to the live site).
3. Commit updated files under `knowledge/icy-veins/`.

Optional: `npm run discover-icy-veins-urls` to refresh the deduped path list from `https://www.icy-veins.com/wow/class-guides`.

## What gets scraped (shape)

Committed JSON is **structured plain text**, not raw `.page_content` HTML blobs.

### Talents page (`spec-builds-talents.json`)

- **`introPlain`** — prose before the first tab/image widget.
- **`recommendedTalentBuilds`** — one row per build tab: full tab label, title, notes with `SpellName[spellId]`, and **`midnightEmbedHash`** for IV’s embedded calculator.
- **`proseSections`** — remaining headings (Apex, Hero Talents, PvP, etc.) after stripping the talent **image_block** widget (no duplicate calculator HTML).
- **`relatedGuideUrls`** — `canonicalBuildsAndTalents` and `canonicalRotationCooldowns` (from breadcrumb TOC, both pages).
- **`specData`**, **`pageKey`**, **`pageType`** — small metadata.
- **`snapshot.howToStayCurrent.talentEmbeds`** — present on the **talents** JSON only (Midnight embed note); rotation snapshot omits that line.

### Rotation page (`rotation-cooldowns-abilities.json`)

- **`introPlain`** — short intro before tab widgets.
- **`imageBlockPanels`** — each `image_block_content` panel: **`panelId`**, **`tabLabel`** (rotation tabs only), **`panelKind`** (`rotation_tab` \| `topic_tab` \| `other`), **`bodyPlain`** with spells as `Name[spellId]`.
- **`headingSections`** — outline sections with bounded body length (very long bodies truncated with `… [truncated]`).

## Compliance

- Read `https://www.icy-veins.com/robots.txt` and site terms before automated or high-volume fetching.
- Prefer infrequent runs and committing snapshots so the app reads static JSON offline.

## Adding another spec

1. Duplicate `scrape-frost-mage.mjs` → `scrape-<spec>.mjs`: set `TALENTS_URL` / `ROTATION_URL` from the IV breadcrumb trail (`*-spec-builds-talents` and `*-rotation-cooldowns-abilities`), `outDir`, `classSlug`, `specSlug`, and `canonicalPages`.
2. Add `npm run scrape-icy-veins-<name>` in `package.json`.
3. Keep the same JSON field names so downstream tooling stays stable.
