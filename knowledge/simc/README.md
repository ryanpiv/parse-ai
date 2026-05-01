# SimulationCraft snippets (Claude reference)

Vendored **default action priority lists** from [SimulationCraft](https://github.com/simulationcraft/simc) for use in the Analyze AI system prompt. We track the **`midnight`** branch to stay aligned with current Midnight-era modeling.

## License

SimulationCraft is **GPL-3.0**. This repo includes **copies** of upstream APL text for prompt context only; the full project and `COPYING` live at the SimC GitHub. Do not strip license headers if you paste larger upstream excerpts elsewhere.

## Bundled specs (Mage + Death Knight)

| File | Wow specId | Upstream (`midnight`) |
|------|------------|-------------------------|
| `mage_arcane.midnight.simc` | 62 (Arcane Mage) | `ActionPriorityLists/default/mage_arcane.simc` |
| `mage_fire.midnight.simc` | 63 (Fire Mage) | `ActionPriorityLists/default/mage_fire.simc` |
| `mage_frost.midnight.simc` | 64 (Frost Mage) | `ActionPriorityLists/default/mage_frost.simc` |
| `deathknight_blood.midnight.simc` | 250 (Blood DK) | `ActionPriorityLists/default/deathknight_blood.simc` |
| `deathknight_frost.midnight.simc` | 251 (Frost DK) | `ActionPriorityLists/default/deathknight_frost.simc` |
| `deathknight_unholy.midnight.simc` | 252 (Unholy DK) | `ActionPriorityLists/default/deathknight_unholy.simc` |

## Updating / embedding

1. Refresh mirrors from GitHub (same paths on `midnight`):

   ```bash
   base='https://raw.githubusercontent.com/simulationcraft/simc/midnight/ActionPriorityLists/default'
   curl -sL "$base/mage_arcane.simc" -o knowledge/simc/mage_arcane.midnight.simc
   curl -sL "$base/mage_fire.simc" -o knowledge/simc/mage_fire.midnight.simc
   curl -sL "$base/mage_frost.simc" -o knowledge/simc/mage_frost.midnight.simc
   curl -sL "$base/deathknight_blood.simc" -o knowledge/simc/deathknight_blood.midnight.simc
   curl -sL "$base/deathknight_frost.simc" -o knowledge/simc/deathknight_frost.midnight.simc
   curl -sL "$base/deathknight_unholy.simc" -o knowledge/simc/deathknight_unholy.midnight.simc
   ```

2. Regenerate the bundled TypeScript (required for the Next.js bundle):

   ```bash
   npm run embed-simc
   ```

3. Commit the `.simc` files and `lib/knowledge/embeddedSimc.ts`.

## Adding another class/spec

1. Vendor `ActionPriorityLists/default/<file>.simc` into `knowledge/simc/` (name it `<something>.midnight.simc`).
2. Add `SIMC_BUNDLE_BY_SPEC_ID` entry (correct **WoW `specId`**) and `APL_BY_SPEC_ID` mapping in `lib/knowledge/embeddedSimc.ts`.
3. Append `{ constName: '…', file: 'knowledge/simc/….midnight.simc' }` to `BUNDLES` in `scripts/embed-simc.mjs`.
4. Run `npm run embed-simc`.

## Relationship to Wowhead corpus

- **Wowhead** (`knowledge/guides/`): human summaries + links.
- **SimC** (this folder): machine-readable default APL.

In the app, the SimC block is **opt-in** on Analyze; when enabled, Claude uses the APL as a primary reference for divergences, but still prefers **log data** when SimC assumptions do not match the report.
