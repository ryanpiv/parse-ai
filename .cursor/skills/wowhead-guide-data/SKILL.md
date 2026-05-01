---
name: wowhead-guide-data
description: >-
  Fetches, refreshes, and freshness-checks Wowhead retail class guide data for parse-ai.
  Use when updating knowledge/wowhead scrapes, running npm run scrape-wowhead-frost,
  troubleshooting CloudFront 403, or aligning scraped JSON with SimC/embed flows.
disable-model-invocation: true
---

# Wowhead guide data (parse-ai)

## Layout

- **Scraper scripts:** `scripts/wowhead/` — `scrape-frost-mage.mjs`, `extractGuideMarkup.mjs`, `parseTalentBbCode.mjs`, `extractWowheadChrome.mjs`, `talentExportHeader.mjs`
- **Snapshots (committed):** `knowledge/wowhead/scraped/mage-frost/*.json`
- **AI bundle:** `lib/knowledge/embeddedWowhead.ts` imports those JSON files into Claude context when the user uses the **SimC + Wowhead** preset (`PRESET_CASTS_VS_SIMC_WOWHEAD` in `lib/styles.ts`)

## Refresh workflow

1. From repo root: `npm run scrape-wowhead-frost` (runs `scripts/wowhead/scrape-frost-mage.mjs`).
2. Confirm HTTP 200 in each JSON `snapshot.fetch` — if `blockedByCdn` is true, retry from another network or save HTML in a browser and debug extraction offline.
3. Commit updated JSON under `knowledge/wowhead/scraped/`.
4. Run `npm run build` — `embeddedWowhead.ts` must compile with JSON imports.

## Freshness signals (sourced in JSON)

- **Patch label:** Wowhead sidebar `.interior-sidebar-header-text-subtitle` (e.g. `Patch 12.0.5`)
- **Guide updated:** header byline `.guide-content-byline-changed` / `.date-tip`
- **Season:** BBCode prose such as `[b]Midnight Season N[/b]`
- **Not in HTML:** Blizzard client build number — compare patch notes or in-game if needed

## Compliance

- Read `https://www.wowhead.com/robots.txt` and Wowhead Terms of Use before automated bulk fetching.
- Prefer infrequent runs and committing snapshots so production users read static files.

## Adding another spec

1. Duplicate URL list pattern in a new scrape script (or generalize `PAGES` + output dir).
2. Ensure BBCode extraction finds `[copy]` and hero headers (`wow-hero-talent-spellslinger` / `frostfire`).
3. Drop JSON under `knowledge/wowhead/scraped/<path>/`.
4. Extend `lib/knowledge/embeddedWowhead.ts`: import JSON, add spec id to `SPEC_IDS_WITH_DATA`, implement branching in `getWowheadReferenceSupplement`.
