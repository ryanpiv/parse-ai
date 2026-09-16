# SimulationCraft snippets (Claude reference)

Vendored **default action priority lists** from [SimulationCraft](https://github.com/simulationcraft/simc) for use in the Analyze AI system prompt. We track the **`midnight`** branch to stay aligned with current Midnight-era modeling.

## License

SimulationCraft is **GPL-3.0**. This repo includes **copies** of upstream APL text for prompt context only; the full project and `COPYING` live at the SimC GitHub. Do not strip license headers if you paste larger upstream excerpts elsewhere.

## Bundled specs (all 34 with an upstream default APL)

Every `ActionPriorityLists/default/<file>.simc` on `midnight` is mirrored here as `<file>.midnight.simc` — 34 of Midnight's 40 specs. The six without upstream APLs (SimC does not sim healing) are: Holy Paladin, Discipline Priest, Holy Priest, Restoration Shaman, Mistweaver Monk, and Preservation Evoker. Restoration Druid **does** have a (DPS) APL upstream and is included. Midnight's new Devourer Demon Hunter (specId 1480) is included.

The file → WoW specId mapping lives in the `SPECS` table in [`scripts/embed-simc.mjs`](../../scripts/embed-simc.mjs) — that table is the single source of truth.

## Updating / embedding

1. Refresh mirrors from GitHub (same basenames on `midnight`):

   ```bash
   base='https://raw.githubusercontent.com/simulationcraft/simc/midnight/ActionPriorityLists/default'
   for f in knowledge/simc/*.midnight.simc; do
     name=$(basename "$f" .midnight.simc)
     curl -sf "$base/$name.simc" -o "$f" || echo "FAILED: $name"
   done
   ```

2. Regenerate the bundled TypeScript (required for the Next.js bundle):

   ```bash
   npm run embed-simc
   ```

   This rewrites `src/lib/knowledge/embeddedSimcData.ts` in full (auto-generated — never edit by hand). The prompt-building logic stays in `src/lib/knowledge/embeddedSimc.ts`.

3. Commit the `.simc` files and `src/lib/knowledge/embeddedSimcData.ts`.

## Adding another spec (e.g. a future expansion spec)

1. Vendor `ActionPriorityLists/default/<file>.simc` into `knowledge/simc/<file>.midnight.simc`.
2. Add `{ specId, file, displayName }` to the `SPECS` table in `scripts/embed-simc.mjs` (correct **WoW `specId`** from Blizzard's playable-specialization index).
3. Run `npm run embed-simc`.

## Relationship to Wowhead corpus

- **Wowhead** (`knowledge/guides/`, `knowledge/wowhead/scraped/`): human summaries + scraped guide data.
- **SimC** (this folder): machine-readable default APL.

In the app, the SimC block is **opt-in** on Analyze; when enabled, Claude uses the APL as a primary reference for divergences, but still prefers **log data** when SimC assumptions do not match the report.
