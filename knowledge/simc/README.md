# SimulationCraft snippets (Claude reference)

Vendored **default action priority lists** from [SimulationCraft](https://github.com/simulationcraft/simc) for use in the Analyze AI system prompt. We track the **`midnight`** branch to stay aligned with current Midnight-era modeling.

## License

SimulationCraft is **GPL-3.0**. This repo includes a **copy** of upstream APL text for prompt context only; the full project and `COPYING` live at the SimC GitHub. Do not strip license headers if you paste larger upstream excerpts elsewhere.

## Updating Frost Mage APL

1. Download the latest default list (same path on `midnight`):

   ```bash
   curl -sL 'https://raw.githubusercontent.com/simulationcraft/simc/midnight/ActionPriorityLists/default/mage_frost.simc' \
     -o knowledge/simc/mage_frost.midnight.simc
   ```

2. Regenerate the bundled TypeScript (required for the Next.js client bundle):

   ```bash
   npm run embed-simc
   ```

3. Commit `knowledge/simc/mage_frost.midnight.simc` and `lib/knowledge/embeddedSimc.ts`.

## Adding other specs

- Mirror the pattern: vendor `ActionPriorityLists/default/<class>_<spec>.simc`, extend `scripts/embed-simc-frost.mjs` (or generalize the script) and `getSimcAplSupplement` with a `specId` map.

## Relationship to Wowhead corpus

- **Wowhead** (`knowledge/guides/`): human summaries + links.  
- **SimC** (this folder): machine-readable default APL.  
  In the app, the SimC block is **opt-in** on the Analyze page; when enabled, Claude is instructed to use the APL as a primary reference for divergences, but still to prefer **log data** when SimC assumptions do not match the report.
