---
name: wowhead-guide-data
description: >-
  Fetches, refreshes, and freshness-checks Wowhead retail class guide data for parse-ai.
  Use when updating knowledge/wowhead scrapes, running npm run scrape-wowhead,
  troubleshooting CloudFront 403, or aligning scraped JSON with SimC/embed flows.
disable-model-invocation: true
---

# Wowhead guide data (parse-ai)

## Layout

- **Scraper:** `scripts/wowhead/scrape-wowhead.mjs` — table-driven (`SPECS` registry maps folder → classSlug/specSlug/ChrSpecialization id); helpers `extractGuideMarkup.mjs`, `parseTalentBbCode.mjs`, `extractWowheadChrome.mjs`, `talentExportHeader.mjs`
- **Snapshots (committed):** `knowledge/wowhead/scraped/<spec-folder>/*.json` — **all 39 retail specs** (folders like `mage-frost`, `priest-holy`, `warrior-protection`). `markupBbCode` is intentionally not written (sections carry the content; halves the client bundle cost).
- **AI bundle:** `lib/knowledge/embeddedWowhead.ts` `SPEC_DOCS` registry (keyed by ChrSpecialization id) imports those JSON files into Claude context when the user uses the **SimC + Wowhead** preset (`PRESET_CASTS_VS_SIMC_WOWHEAD` in `lib/styles.ts`). Coverage is locked by `__tests__/lib/embeddedWowhead.test.ts`.

## Refresh workflow

1. From repo root: `npm run scrape-wowhead -- <spec-folder…>` or `npm run scrape-wowhead -- --all` (aliases `scrape-wowhead-frost` / `scrape-wowhead-unholy` still work).
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

1. Add one entry to `SPECS` in `scripts/wowhead/scrape-wowhead.mjs` (folder key, `classSlug`/`specSlug`, `wowSpecId` ChrSpecialization id, `urlSuffix` — dps specs use `pve-dps`; check the actual Wowhead guide URL for healers/tanks).
2. Run `npm run scrape-wowhead -- <folder>`; confirm `snapshot.fetch.ok` and that BBCode extraction found `[copy]` rows / sections.
3. Extend `lib/knowledge/embeddedWowhead.ts`: import the two JSON files and add a `SPEC_DOCS` entry (label + optional `heroBranchNote`). Nothing else branches on spec id.
