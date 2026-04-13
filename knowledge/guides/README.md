# Class guide corpus (Claude reference)

Short, **human-summarized** notes injected into the Analyze AI system prompt when `talentDiff.specId` matches an entry we ship.

## Source policy: Wowhead only

- Summaries must be written **only** from **Wowhead** class guides (reading the pages in a normal browser).
- **Do not** use Icy Veins, Wow.gg, YouTube, Discord pins, or other sites as the basis for text in this folder—even if they are accurate. If Wowhead disagrees with elsewhere, **Wowhead wins for this corpus**.
- Automated fetch of Wowhead often fails in CI/tools; treat **manual review of the live Wowhead URLs** in `manifest.json` as part of each update.

## Adding a spec

1. Add a row to `manifest.json` with Blizzard `specId`, `title`, primary `sourceUrl` (Wowhead), optional `additionalWowheadUrls[]`, and `as_of` (date you re-read the pages).
2. Add `bodies/<specId>.md` using the section template below (summarize in your own words—no long paste of Wowhead HTML).
3. Copy the finalized body into `lib/knowledge/embeddedGuides.ts` (`GUIDE_BODY_BY_SPEC_ID` and `GUIDE_META_BY_SPEC_ID`). The app bundles TS only (no runtime `fs` on the client).
4. Run `npm run build` to verify types.

## Section template (each `.md`)

- Overview / build focus (raid ST vs cleave if relevant)
- Opener / priority rules (bullets) — or explicitly defer to Wowhead rotation URL if you only verify structure
- Major cooldown alignment (bullets)
- Talent / hero caveats (“if you play X…”)
- Common mistakes visible in logs (bullets)
- **Canonical Wowhead links** (same class, PvE section)
- Footer: `Sources: Wowhead only · summarized for parse-ai · as of YYYY-MM-DD`

## Attribution

Keep URLs and `as_of` accurate. When guide advice conflicts with **this log or talents**, the model is instructed to prefer the data.

## SimulationCraft (separate corpus)

Default APLs from the SimC **`midnight`** branch are vendored under [`knowledge/simc/`](../simc/README.md) and bundled via `lib/knowledge/embeddedSimc.ts`. Wowhead summaries and SimC APLs are both optional references; fight logs still win on conflicts.
