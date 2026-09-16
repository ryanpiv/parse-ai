# Code style

How to write UI, helpers, and API routes in this app. Stack, deploy, and domain behavior live in `ARCHITECTURE.md`; session state lives in `PROGRESS.md`.

**Target, not a backlog:** UI, pages, and tests already follow this guide (component folders, CSS modules, arrow-const default exports, colocated tests). New work matches the same patterns. Formatting is **Prettier-owned** (`.prettierrc.json` — 4-space, single quotes, no semicolons, width 110; `npm run format` / `npm run format-check`).

## Layout (Next.js Pages Router)

App code lives under `src/`. Next serves routes from `src/pages/` (`public/`, `knowledge/`, and `scripts/` stay at the repo root).

| Place | What belongs there |
| --- | --- |
| `src/pages/<route>.tsx` | Thin route orchestrators — page state and wiring only. Next owns this folder's naming; no component folders here. Heavy bodies live in `src/components/`. |
| `src/pages/api/<route>.ts` | HTTP adapters only — see **Backend** below. |
| `src/components/<Area>/` | Area = product surface (`analyze`, `reports`, `Charts`, `TalentCompare`). |
| `src/components/<Area>/<ComponentName>/` | One UI unit: `ComponentName.tsx`, thin `index.tsx`, `styles.module.css`, `__tests__/`. |
| `src/lib/<concept>/` | Pure domain helpers used by more than one owner (`fightAnalysis`, `wclClient`, `buildContext`, `knowledge`, …). |
| `src/contexts/` | React context providers. |
| `src/styles/` | Shared atoms (`ui.module.css`), themes (`globals.css`), page chrome (`pages/`). |
| `src/types/` | Shared `.d.ts` / WCL shapes used across pages and lib. |

- A helper with a single owner lives in that owner's folder. Tests sit next to the file they cover (`src/lib/__tests__/`, `src/lib/<concept>/__tests__/`, `src/components/<Area>/<Name>/__tests__/`). **Exception:** API route tests live in the top-level `__tests__/api/` — Next would serve anything under `src/pages/` as a route.
- Context modules (`src/contexts/`) export a named provider + hook pair (`FightAnalysisProvider`, `useFightAnalysis`) — they are domain modules, not `src/components/<Name>` units, so the components-default-export rule does not apply.
- A component gets a folder when it has tests, styles, mocks, or children. Until then a lone `.tsx` in the area folder is fine.
- A lone `.ts` file in an existing folder is for pure logic, registries, types, or constants.
- Do **not** add `src/lib/utils.ts` (or any grab-bag "utils"/"helpers" module). Do not add a one-file folder when the helper belongs next to an existing owner.
- API route tests stay in `__tests__/api/` (Next would serve anything under `src/pages/` as a route).

## Naming

PascalCase domain phrases. The folder name is the component name.

Good: `ReportBrowser`, `TopParseSection`, `MetricTimelineChart`. Avoid: `List`, `Item`, `Wrapper`, `Helper`.

| Kind | Pattern | Example |
| --- | --- | --- |
| Local object shapes | `I` + PascalCase **interface** | `ISelectedRow`, `IFightRow` |
| Exported component props | `ComponentNameProps` **type** | `ReportBrowserProps` |
| Unions / aliases | `type` | `MetricKey`, `SimcCoachingMode` |

`interface` for object shapes. `type` for unions, `Pick`, `NonNullable`, and exported component props.

The verb is the contract (applies to FE **and** BE code):

| Prefix | Job | Example |
| --- | --- | --- |
| `build*` | assemble a structure | `buildRichContext`, `buildSoloUrl` |
| `get*` | read or compute a value (sync, in-memory) | `getSimcAplSupplement`, `getWclToken` |
| `map*` | transform one shape into another | (only when it is a mapping) |
| `fetch*` | **actual network I/O** — never in-memory reads | `fetchMetricGraphs`, `fetchFightData` |
| `handle*` | internal event handler | `handleFieldValueChange` |
| `on*` | callback **prop** | `onPlayerPick`, `onValueChange` |
| `is*` / `has*` / `should*` | booleans | `isWclCompareUrl`, `hasMetricSeriesData` |

Names are medium-long and domain-explicit. Prefer the product's vocabulary over `id`, `data`, and `item` — `reportCode`, `fightId`, `specId`, not `id`.

Booleans: `isOpen`, `hasSelection`. Visibility setters: `setIsFilterOpen`, not `setModal`.

**Comments explain why, not the next line.** Short. No emojis, no `// --- State ---` banners, no nested ternaries in JSX, no `any`, no generic `data` at component boundaries.

Indentation is **4 spaces**, no semicolons, single quotes — enforced repo-wide by Prettier (`npm run format`); don't hand-fight it.

Components are **arrow functions** assigned to a const, default-exported at the bottom:

```tsx
const ReportBrowser = (props: ReportBrowserProps) => {
    ...
}

export default ReportBrowser
```

Not `export default function ReportBrowser()`.

## Components

Injected callbacks are required at the UI boundary. Optional extras are clearly named (`onValueKindChange?`).

| Layer | Role |
| --- | --- |
| Orchestrator (page / context) | page state, wiring |
| Section | domain chunk + callbacks |
| Leaf | rendering + local interaction |
| Pure helper | unit-tested transforms in `.ts` files |

- Conditionals: early return for empty (`if (rows.length === 0) return null`), named booleans, `&&` for optional blocks.
- UI state stays in the component. `useCallback` for handlers passed down. `useMemo` for derived lists.
- Mapping, parsing, and serialization live in `.ts` files, not inside JSX.
- **Styling: CSS modules.** Shared atoms live in `src/styles/ui.module.css` (buttons, fields, alerts, chrome). Component-specific layout lives in that component's `styles.module.css`. Page chrome that isn't a component goes in `src/styles/pages/<page>.module.css`. Theme values come from CSS custom properties (`var(--gold2)` etc. from `src/lib/vibes.ts` / `src/styles/globals.css`). Computed or per-datum values (class colors, SVG coordinates, ResizeObserver widths) stay inline. Do not grow `globals.css` with component classes.
- Do not add a second stylesheet system (styled-components, Tailwind, …).
- Do not add a mobile layout fork unless the UI actually splits.

## Types

- Prop types on the component when only that component needs them; re-export public prop types from `index.tsx`.
- Domain types stay next to their domain (`WclTopRank` in `src/lib/wclReports.ts`).
- Request/response contracts for API routes live in the domain module and are pulled into client code with `import type`.
- Mirror schema or API names in constants and maps (WCL/Blizzard field names, spec ids). Do not invent shortened registry keys.

## Helpers vs JSX

Extract when the logic is unit-testable, shared, or would otherwise nest ternaries / long maps.

Keep in the component when it is one render path and under ~10 lines, or when it needs hooks.

Builders, parsers, and derived-value helpers belong in `.ts` files with their own tests.

## Tests

Top `describe` is the **exact export name**: `'ReportBrowser'`, `'pickSimilarRank'`.

`it` titles are **lowercase present-tense sentences**:

```ts
it('keeps the selected value when the form is resubmitted', () => { ... })
it('does not render when items is empty', () => { ... })
```

- Queries: `getByTestId` first. Test IDs are the component name, optionally indexed: `data-testid="ReportBrowser"`, `ResultRow--${rowId}`. Then `getByText` for user-visible copy.
- `beforeEach(() => { jest.clearAllMocks() })` when the test uses mocks.
- Collapsible UI: assert `aria-expanded` / `aria-hidden`, not `toBeVisible()`.
- Pure `src/lib/` logic gets plain unit tests; no DOM environment needed.

## Imports and exports

- Components: **default** export. Types and helpers (and everything on the BE): **named** export.
- Relative paths inside the app: `'../../lib/wclReports'`, `'./getMatchingItems'`.
- `import type { ... }` for types.
- Import by direct path. Do not force a barrel for a single consumer.

## Backend (`src/pages/api/` + server-only `src/lib/`)

Next API routes are **thin HTTP adapters**. The shape of every route:

1. Check `req.method`; anything unhandled gets `405 { error: 'Method not allowed' }`. Multi-action POST endpoints (like `/api/auth`) dispatch on a validated `action` string.
2. Validate the request (body, query, headers) **at this boundary only** — reject early with `400 { error }`. Internal `src/lib/` code trusts its callers; do not re-validate downstream.
3. Call a domain function from `src/lib/`. Business logic lives there, unit-testable without HTTP.
4. Map the result to a status + JSON. Every non-2xx response is `{ error: string }` — human-readable, actionable, no stack traces, no secrets. Upstream failures (WCL, Blizzard, Anthropic) get mapped with which upstream and its status, not passed through raw.

Server-only rules:

- Anything touching `process.env`, secrets, or `fs` lives in a clearly server-only module (`src/lib/serverEnv.ts`, `src/lib/serverWclToken.ts` pattern) and is imported **only** from `src/pages/api/**`. Never from components, contexts, or client-side `src/lib/` — prompt/context builders run in the browser and must import bundled knowledge modules instead (see `ARCHITECTURE.md`).
- One module owns each credential flow. Secrets never reach the browser (the WCL *user* token is the deliberate exception — user-scoped, localStorage-only) and never get logged.
- Upstream fetches use explicit timeouts and no unbounded retries. Cache stable game data server-side (talent trees); never cache user-scoped report data across users.
- Naming follows the same verb contract; `fetch*` is correct on the BE because it is real network I/O. The route export is `handler` (Next convention); the file name carries the resource name.

## Do / don't

| Do | Don't |
| --- | --- |
| Name after the product concept | `List`, `Item`, `Wrapper` |
| `build*` for assembled output | `makeX` / `processX` as the public API |
| `get*` for sync reads | `fetch*` for in-memory values |
| `handle*` internally, `on*` on props | bare `click` functions |
| `I` on local interfaces | `I` on exported `ComponentNameProps` |
| `data-testid="ReportBrowser"` | random or kebab test IDs |
| Test titles as plain sentences | Title Case Labels |
| Comment the non-obvious constraint | restate the next line |
| Keep mapping out of JSX | a 200-line inline submit handler |
| Put a helper next to its owner | `src/lib/utils.ts` or a one-file folder |
| CSS module classes (`src/styles/ui.module.css` + colocated modules) | inline style soup / new globals in `globals.css` |
| Thin API route → `src/lib/` domain function | business logic inside `src/pages/api/` handlers |
| `{ error: string }` on every non-2xx | raw upstream errors or stack traces to the client |
