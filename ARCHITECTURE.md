# parse-ai — Architecture & Contributor Guide

> Audience: humans **and** AI coding agents. This document is the holistic map of the project — what it is, how it is put together, every feature area, and the rules for contributing safely. Read this before `README.md` (user-facing quickstart) if you are modifying code.

---

## 1. Purpose

**parse-ai** (package name `parse-analyzer`) is a local-first web app that turns World of Warcraft combat logs into actionable performance coaching.

A player pastes a [Warcraft Logs](https://www.warcraftlogs.com) report URL. The app pulls the full event stream for their fight, reconstructs game state (buffs, procs, cooldowns, cast sequences), renders interactive charts and talent trees, and assembles a large structured prompt for Anthropic Claude. Claude returns prioritized, log-grounded improvement advice, and the player can keep asking follow-up questions in a chat whose system prompt always contains the full fight context.

Two analysis modes exist:

- **Solo** — one player from any report (`?fight=` URL). "What should *I* fix?"
- **Compare** — two players side-by-side from a WCL compare URL. "What does the better player do differently?"

The app is a personal tool run via `npm run dev` on `localhost:3000` (deployable to Vercel). There is no database; all persistence is `.env.local`, `localStorage`, and in-memory React context.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js **14.2.3**, **Pages Router** (not App Router) |
| Language | TypeScript (strict) |
| UI | React 18, inline styles + CSS custom properties, Chart.js 4 via react-chartjs-2 |
| AI | Anthropic Claude Messages API (`claude-sonnet-4-6`, streaming SSE supported) |
| Fight data | Warcraft Logs GraphQL API v2 |
| Talent trees | Blizzard Game Data API (OAuth client credentials) |
| Icons/tooltips | Wowhead tooltip API → Zamimg CDN (server-proxied) |
| Tests | Jest 30 + ts-jest + jsdom (123+ tests in `__tests__/`) |

No CSS framework, no state library, no ORM. Keep it that way unless the user asks.

---

## 3. Feature inventory

### Analyze (`/`, the home page)
- **Flow**: page heading → **Warcraft Logs panel** (`components/analyze/WclLoadPanel.tsx`: URL input, Load, status alerts, roster picker) → view tabs + charts/chat, which stay hidden until a fight is loaded (empty state shows instead). WCL OAuth setup lives in the Settings dropdown.
- **Solo | Compare view tabs** — always clickable. When nothing is loaded, each shows an instructional empty state (`AnalyzeEmptyState`) explaining what URL format to paste. Solo works from any single report (`?fight=<id|last|first>`) or a compare URL (you are player 1). Compare needs a two-player compare URL.
- **Multi-player reports** — if a single report fight has several players and no `?source=`, a roster picker appears (class icons, spec labels).
- **Charts** — spell usage bars, cast timeline, proc efficiency, cooldown timeline, compact spell timeline with sticky zoom, crit rate. **Output over time** (`components/Charts/MetricTimelineChart.tsx`) plots damage done / healing done / damage taken (one at a time via chip filter, default damage done); series come from WCL's pre-bucketed `graph` endpoint (`lib/metricGraphs.ts`, one aliased query per player at load, stored as `AnalyzedFightData.metricSeries`) and both players are resampled into common buckets before overlaying. Compare mode has a "trim to shorter fight" toggle windowing all charts (`compareWindowSec`).
- **AI chat** — two independent threads (solo/analyze vs compare), streaming responses with live token counts, preset question tiles, markdown rendering with Wowhead links, copy buttons. The "Ask Claude" section is **gated on a saved Claude key**: without one it renders collapsed with a prompt (`ClaudeKeyPrompt`) whose button opens Settings and glows/focuses the key field (window-event bus in `lib/claudeKeyBus.ts`); saving a key unlocks and expands the chat live. The model id is the single constant in `lib/wclClient/anthropicModel.ts` — both `callAI` and `callAIStream` use it.
- **Chat presets** (`lib/prompts/chatPresets.ts`) — canned prompts; some force extra knowledge context (SimC APL, Wowhead scrape, Icy Veins scrape) for that message. SimC block is otherwise opt-in via a UI toggle (`simcCompareEnabled`).
- **Load errors are loud** — red "Could not load this log" banner in both the WCL panel and the sticky view bar; `/api/wcl` fetches time out after 60s and network failures map to "is `npm run dev` running?" guidance.

### Reports (`/reports`)
- **In-app WCL report browser** (`components/reports/ReportBrowser.tsx`, queries in `lib/wclReports.ts`) — requires sign-in (shows `WclKeyPrompt` otherwise). Drill-down: source chips (**My uploads** + each guild from `currentUser.guilds`) → paginated report list (`reportData.reports`, 20/page, Newer/Older) → boss pulls (difficulty + Kill/Wipe-% badges, durations; trash filtered by `encounterID > 0`) → player grid.
- **Player grid** — role sections (Tanks/Healers/DPS) of class-colored cards (`lib/wowClassColors.ts`, zamimg class icons via `lib/wclFightPlayers.ts`). Picking **1** player = "Analyze {name}" (solo), **2** = "Compare {a} vs {b}" (first pick is player 1). Builds the WCL URL and calls `loadCompare(url)` (accepts a URL override), then routes to Analyze.
- **Compare vs a similar top parse** — with exactly one player picked, a prominent gold-labelled section (`components/reports/TopParseSection.tsx`, shared with Analyze) offers a **one-click** compare: it fetches `worldData.encounter.characterRankings` (same class/spec/difficulty; `hps` for healers), picks the highest-ranked parse with a kill time close to this pull (`pickSimilarRank()`: 10s → 30s → 60s tolerance, then closest — the v2 API has no similar-parse search, so this approximates WCL's fight-length filter), and immediately loads the **cross-report** compare. Rankings are point-expensive → fetched only on click, cached per encounter+spec+difficulty+metric for the session. For full control (fight length / raid size / ilvl filters), `wclCompareSearchLink()` links to WCL's own compare-search modal for the exact pull (`?fight=N&view=replay&modal=compare`). The same section appears on **Analyze's Compare tab** when a solo report is loaded (`components/analyze/TopParseCompare.tsx` resolves fight + player from the loaded URL, then auto-runs the search).
- **Sticky state** — drill-down position (source, page, report, fight) survives route changes via a module-scope snapshot, so "Analyze {name}" → back to Reports lands where you left off; a "⟲ All reports" reset button in the player grid jumps back to the top. The last analyzed character's name is kept in localStorage (`parse-analyzer-last-player`) and auto-picked as player 1 when seen in a roster.
- "Open on WCL ↗" links at report and fight level for anything the browser doesn't cover.

### History (`/history`)
- **Load history** (`pages/history.tsx`, store in `lib/analysisHistory.ts`) — every successful solo/compare load is recorded to localStorage (`parse-analyzer-history`, capped at 50): canonical WCL URL + kind/names/specs/boss/timestamp, **no fight data**. Deduped by URL — re-loading bumps the entry to the top instead of duplicating. Recorded at the success points in `FightAnalysisContext` (solo URL rebuilt via `buildSoloUrl`, compare URL rebuilt canonically from resolved actor ids, so `fight=last`-style inputs collapse into the same entry). Scrollable list with Solo/Compare badges and relative timestamps; clicking re-runs `loadCompare(url)` and routes to Analyze; same-tab reactivity via a `parse-analyzer-history-changed` window event.

### Talent compare (`/compare`)
- Paste two talent export strings (in-game `/etl`, Wowhead, Raidbots), or fetch both builds from a WCL compare URL (`action: 'compare-talents'` on `/api/wcl`).
- Decodes/encodes Blizzard talent export strings (`lib/talents/decodeTalentString.ts`), diffs builds, renders three side-by-side trees (class / hero / spec) with diff coloring. The heading is the diff summary: shared count plus a wrapping "{player} only: N · talent · talent…" row per player (Wowhead-linked names); the tree columns themselves have no headers.
- **Compare vs Single tree toggle** — Single tree stacks each player's full Raidbots-style tree (`FullTalentTree`) under their name; both views render at the same node scale (constants in `TalentCompare.tsx` match `FullTalentTree.tsx`).
- Player names come from the loaded data (WCL or the Analyze snapshot); "Build 1/2" only appears for hand-pasted strings.
- Reachable from Analyze via the **Open in Talent compare** button on the talent section — links with `?b1=&b2=` when export strings exist, otherwise plain `/compare` (the page restores both builds from the in-memory Analyze snapshot's talent rows).
- Shareable URL via `?b1=&b2=&n1=&n2=`.

### Talents (`/talent-preview`)
- Raidbots-style full-tree render for one player (gold = taken).
- Sources, in priority order: WCL node rows saved in session → talent export string → synthetic fills (`?preset=budget|max|none` for QA).
- `TalentSourceForm` lets the user paste an export string or load player-1 talents straight from the WCL URL bar (`lib/talents/loadTalentsFromWclUrl.ts`), including a roster picker.

### Settings (nav dropdown)
- **Themes** — three vibes as radio buttons: **Slate** (default, `:root` palette), **Gold HUD** (`classic`), **Light**. Selection sets `data-vibe` on `<html>` and persists to `localStorage` (`parse-analyzer-vibe`); a pre-hydration script in `pages/_document.tsx` prevents flash. Definitions: `lib/vibes.ts` (data) + `styles/globals.css` (`html[data-vibe="…"]` overrides).
- **WarcraftLogs** — "Sign in with WarcraftLogs" button (or "✓ Signed in as {name}" + Sign out). Sign-in is **required** to load reports; see §WCL auth. When signed out, the Analyze empty state shows `WclKeyPrompt` (sign-in button, or operator setup steps if the server has no client id).
- **Claude API key (BYOK)** — password `KeyField` (`AnthropicKeyPanel`): a Claude **Console** key (`sk-ant-…`) stored only in `localStorage` (`lib/anthropicUserKey.ts`), sent as `x-anthropic-api-key` header to `/api/ai`, which prefers it over the server's `ANTHROPIC_API_KEY` env fallback. **There is no "Sign in with Claude" for third-party apps** — Console API keys are the supported path. Save/clear dispatch `pa:claude-key-changed`, and `pa:open-claude-key-settings` (from "Add key in Settings" buttons) opens this dropdown with the field focused and glowing (`lib/claudeKeyBus.ts`, `.paKeyGlow` in `globals.css`).

### WCL auth (per-user sign-in, required)
- **"Sign in with WarcraftLogs" is mandatory for report loading** (`lib/wclUserToken.ts`): authorization code + PKCE using the operator's client id (served by `/api/auth` GET as `{ clientId }`; `WCL_CLIENT_ID` alone is enough — WCL **public/PKCE clients have no secret**, and the exchange sends `client_secret` only when configured). `/auth/callback` POSTs the code to `/api/auth` (`action: 'user-exchange'`); the resulting **user token is returned to the browser and stored in localStorage only** (`parse-analyzer-wcl-user`, with expiry + user name) — never on the server. `wclClientHeaders()` adds `x-wcl-user-token` to `/api/wcl` calls; the route **requires it (401 otherwise)** and targets WCL's **`/api/v2/user`** endpoint — each user gets their own permissions (private logs) and rate-limit budget. Sign-out clears localStorage. The WCL client's **redirect URL must include** `http://localhost:3000/auth/callback` (plus the production origin).
- **Server client-credentials token** (`lib/serverWclToken.ts`, `getWclToken()`): now only for game-data lookups (`/api/talents`, `/api/debug-tree`) — cached in module memory, auto-refreshed. A static `WCL_TOKEN` env is a legacy fallback for those routes only.
- `FightAnalysisContext.authStatus` is 'ok' only when the user is signed in; `wclClientId` feeds the sign-in buttons (Settings row and `WclKeyPrompt`, which shows operator setup steps when no client id is configured).

### Shared UI primitives (`components/ui.tsx`)
- `PageHeader`, `Panel`, `FieldRow`, `KeyField`, `OrDivider` — every page composes these instead of hand-rolling heading/panel/field markup. New UI goes through them so themes and layout stay uniform.

---

## 4. Directory map

```
pages/
  index.tsx            Analyze: heading → WCL panel → view tabs (gated on load)
  analyze.tsx          Redirect → /
  reports.tsx          Report browser: my/guild logs → pulls → player picker → Analyze
  compare.tsx          Talent diff page (2 strings OR WCL compare URL; diff/full-tree toggle)
  talent-preview.tsx   Full single-player tree (Raidbots-style)
  _app.tsx             AppErrorBoundary → provider stack (AppSession → AnalyzePageCache →
                       FightAnalysis) + AppNav
  _document.tsx        Pre-hydration vibe script (slate default) + favicon links
  auth/callback.tsx    Sign-in landing: exchanges code, stores user token in localStorage
  api/
    ai.ts              Claude proxy (JSON + SSE streaming; BYOK header > env key)
    wcl.ts             WCL GraphQL proxy (requires x-wcl-user-token, 401 otherwise); compare-talents
    auth.ts            GET public clientId; POST user-exchange (code → user token)
    blizzard-tree.ts   Blizzard talent tree per specId (24h cache)
    talents.ts         Batch node-ID → spell info
    tooltip.ts         Wowhead icon proxy (never add ?dataEnv=11)
    spell-cooldowns.ts, debug-tree.ts

contexts/
  AppSessionContext.tsx        localStorage-backed session (talent strings, specId, URLs)
  AnalyzePageCacheContext.tsx  In-memory snapshot so Analyze survives route changes
  FightAnalysisContext.tsx     THE core: WCL URL, loadCompare/solo pipeline, chat threads,
                               analysisSubtab, auth state (~1200 lines)

components/
  AppNav.tsx           Fixed route tabs + Settings dropdown (theme radios, WCL + Claude keys;
                       listens for pa:open-claude-key-settings)
  AppErrorBoundary.tsx Last-resort catch for uncaught render errors (brief message + Reload)
  ui.tsx               Shared primitives: PageHeader, Panel, FieldRow, KeyField (highlight/
                       focus support), OrDivider, Accordion
  WclLoadStatus.tsx    Load progress/error banners ('nav' and 'viewbar' variants)
  AnthropicKeyPanel.tsx
  analyze/             SoloFightView, CompareFightView, AnalyzeEmptyState, WclLoadPanel,
                       ClaudeKeyPrompt, WclKeyPrompt
  AIChat/              Chat list, FormatAI markdown renderer, CopyBtn
  Charts/              All Chart.js wrappers + SpellTimeline + ChartCard
  TalentCompare/       TalentCompare, FullTalentTree, TalentTree (SVG), TalentIcon,
                       SpellTooltip, TalentSourceForm

lib/
  wclClient/           gql() with timeout + formatted errors; callAI / callAIStream;
                       anthropicModel.ts = the single ANTHROPIC_MODEL constant
  fightAnalysis/       fetchFullFightData, processFightData, solo partner stub
  gameState/           Buff/proc timeline tracking, cast annotation, uptimes
  buildContext/        buildRichContext / buildRichContextPlayerOne → Claude system prompt
  prompts/             Chat presets
  talents/             decode/encode export strings, fetchTalents (WCL CombatantInfo),
                       loadTalentsFromWclUrl, diff, node resolution, session row helpers
  knowledge/           embeddedGuides.ts, embeddedSimc.ts, embeddedWowhead.ts,
                       embeddedIcyVeins.ts (all bundled TS — see §6)
  wclReportUrl.ts      URL parsing (compare + single report, fight=last/first,
                       source & comparesource params)
  anthropicUserKey.ts  BYOK storage/validation/headers
  claudeKeyBus.ts      Key-changed / open-settings window events (Claude + WCL) + useClaudeKeyPresent()
  vibes.ts             Theme definitions (Settings radios)
  styles.ts            Shared inline styles (s.*) + pa-* class name map
  serverEnv.ts         Server-only env resolution (WCL/Blizzard/Anthropic keys)
  serverWclToken.ts    WCL client-credentials token cache (getWclToken)
  wclUserToken.ts      Per-user WCL sign-in (localStorage token, headers, PKCE redirect)
  wclReports.ts        Report browser queries (currentUser, reports, fights, rankings) + URL builders
  wowClassColors.ts    Blizzard class colors for the player grid
  blizzardClient.ts, pkce.ts, wclFightPlayers.ts, spellTooltips/

knowledge/             Source-of-truth corpora (see §6)
public/                favicon.svg (source) + favicon.ico + apple-touch-icon.png
scripts/               embed-simc.mjs, wowhead + icy-veins scrapers
styles/globals.css     CSS variables (:root + html[data-vibe=…]), all .pa-* classes
types/                 wcl.ts, global.d.ts
__tests__/             Jest: api routes, lib units (gameState, talents, wclClient, URL parse)
```

---

## 5. Core data flow (Analyze)

```
User pastes URL → parseWclUrl (lib/wclReportUrl.ts)
  ├─ compare URL → loadCompare in FightAnalysisContext
  │    fetch metadata (both reports) → resolve actors/fights
  │    fetchFullFightData ×2 (paginated events: casts, buffs, debuffs, damage)
  │    damage tables → DPS; resolveNames for spell IDs
  │    processFightData ×2 (lib/gameState: annotate casts with buff/proc state,
  │                          uptimes, cooldown usage, sequences)
  │    fetchTalents ×2 (WCL CombatantInfo) → talentDiff {t1, t2, specId}
  │    → setP1data/setP2data/spellRows → subtab 'compare'
  └─ single report → resolve fight (numeric | last | first)
       no ?source= → fetchFightPlayerRows → roster picker (>1 player)
       executeSoloReportFull → p1data + stub p2 (soloFromReport=true) → subtab 'solo'

Chat turn:
  buildRichContextPlayerOne / buildRichContext (BROWSER-side, lib/buildContext)
    + optional knowledge blocks (guide summary by specId, SimC APL, Wowhead/Icy scrapes)
  → system prompt → callAIStream → /api/ai → Anthropic SSE → streamed into thread
```

Key state invariants in `FightAnalysisContext`:
- `analysisSubtab: 'solo' | 'compare' | 'none'` — defaults to `'solo'`; views render even with no data (empty states).
- `soloFromReport` — true when p2 is a stub; Compare view shows instructions instead of stub data.
- Analyze state is snapshotted to `AnalyzePageCacheContext` on unmount and restored on return; a completed load also persists talent strings/specId to `AppSessionContext` (localStorage) for /compare and /talent-preview.

---

## 6. Knowledge corpora (AI grounding)

All prompt-time knowledge must be **imported from bundled TS modules** — `buildRichContext*` runs in the **browser**, so `fs` or server-only reads are forbidden in that path.

| Corpus | Source of truth | Bundled module | Update command |
|---|---|---|---|
| Wowhead summaries (human-written) | `knowledge/guides/bodies/<specId>.md` | `lib/knowledge/embeddedGuides.ts` | manual copy (Wowhead-only source policy — see `knowledge/guides/README.md`) |
| SimC default APLs (GPL-3.0, `midnight` branch) | `knowledge/simc/*.midnight.simc` | `lib/knowledge/embeddedSimc.ts` | `npm run embed-simc` after refreshing files |
| Wowhead scraped guides (JSON) | `knowledge/wowhead/scraped/` | `lib/knowledge/embeddedWowhead.ts` | `npm run scrape-wowhead-frost` / `-unholy` |
| Icy Veins scraped guides (JSON) | `knowledge/icy-veins/scraped/` | `lib/knowledge/embeddedIcyVeins.ts` | `npm run scrape-icy-veins-frost` / `-unholy` |

Coverage today: SimC for all Mage (62/63/64) + all DK (250/251/252) specs; scraped guides for Frost Mage (64) and Unholy DK (252); human summaries Frost-Mage-centric. The rest of the pipeline (charts, talents, chat) is spec-agnostic.

Prompt precedence rule baked into the prompts: **the log data always wins** over guides/APL when they conflict. SimC's vendored APLs are generated files upstream — never "fix" them here; refresh from the `midnight` branch instead.

---

## 7. Auth, keys, and env

`.env.local` (never commit):

```
WCL_CLIENT_ID=        # warcraftlogs.com/api/clients — powers required user sign-in
WCL_CLIENT_SECRET=    # optional: confidential clients only + game-data client-credentials
                      # (register redirect URL http://localhost:3000/auth/callback + prod)
ANTHROPIC_API_KEY=    # optional server fallback; users can BYOK in the UI instead
BLIZZARD_CLIENT_ID=   # Battle.net app (talent trees)
BLIZZARD_CLIENT_SECRET=
```

- All third-party calls (WCL, Blizzard, Wowhead, Anthropic) are **server-proxied** through `pages/api/*` — no secrets or CORS on the client.
- The one deliberate exception to "no client keys": the **user's own** Anthropic Console key, which the user pastes knowingly; it lives in their browser's localStorage and transits only to our own `/api/ai` proxy as a header.
- `lib/serverEnv.ts` resolves env with aliases (`WCL_TOKEN_LOCAL`, etc.) and placeholder rejection. Use it, not raw `process.env`, in API routes.

---

## 8. Theming

- Every color/font/radius flows through CSS custom properties defined in `:root` (**Slate**, the default) and overridden per theme in `html[data-vibe="classic|light"]` blocks in `styles/globals.css`. Theme choice is a Settings radio (`lib/vibes.ts`).
- Semantic variables: `--bg..--bg4`, `--border`, `--text/--muted/--dim`, `--gold/--gold2/--golddim` (the *accent*, regardless of hue), `--blue`, `--red`, `--green`, `--on-accent`, `--font-ui/--font-display/--font-mono`, `--radius/--radius-sm`, `--label-tracking/--label-transform`.
- **Rule for new UI:** never hardcode hex or font families in components — use the variables (via `lib/styles.ts` `s.*` styles or `.pa-*` classes). Then all five themes keep working.
- `--pa-sticky-app-nav-offset` couples the fixed nav height, its spacer, and the Analyze sticky view bar — change together.

---

## 9. Contributing rules (read carefully, AI agents)

1. **Small, focused diffs.** Match the existing patterns of the file you touch. No drive-by refactors, no new dependencies without need.
2. **Verify before finishing:** `npm test` (Jest) and `npm run build` must pass. Add/extend tests in `__tests__/` when changing logic (gameState, talents, wclClient, URL parsing, API routes all have suites to mirror).
3. **Never commit unless the user explicitly asks.** Leave changes unstaged for review.
4. **Client-side constraint:** anything reachable from `buildRichContext*` or React components must not use `fs`, Node APIs, or server env. Static knowledge = bundled TS imports.
5. **After editing `.simc` files:** run `npm run embed-simc`. After editing guide bodies: sync `embeddedGuides.ts` manually.
6. **Errors must be readable.** Use `formatApiError` / `formatLoadError` / `formatFetchError` (`lib/wclClient`) — never surface `[object Object]`, raw JSON bodies, or silently spin. Catch-all messages state what was being attempted ("Loading builds from Warcraft Logs failed — …"); uncaught render errors hit `AppErrorBoundary`. `gql()` has a 60s timeout; preserve that behavior in new fetch paths. Note `/api/ai` returns `{ error: "string" }` while raw Anthropic errors use `{ error: { message } }` — parse both.
7. **Windows dev environment.** Shell is PowerShell 5 (`&&` does not work; use `;`). Dev server webpack cache occasionally corrupts (`Cannot find module './chunks/undefined'`, 500s on every route) — fix by stopping the server and deleting `.next`, not by changing code.
8. **URL parsing gotchas:** single-report URLs require `?fight=` (id, `last`, `first`); compare URLs accept both `source` and `comparesource` params; browser-truncated URLs (ending in a bare `&compares`) still parse but lose player selection.
9. **Wowhead tooltip proxy:** do not add `?dataEnv=11` to Wowhead requests — it 404s retail spells.
10. **PII:** logs and Raidbots exports can contain player names/emails; don't echo private data into committed files or prompts unnecessarily.

### Typical contribution recipes

- **New chart:** add a component in `components/Charts/` using `chartDefaults.ts` + `ChartCard`, feed it from `p1data/p2data/spellRows`, mount in `SoloFightView`/`CompareFightView`, respect `compareWindowSec` if compare-aware.
- **New chat preset:** add to `lib/prompts/chatPresets.ts`, wire the tile in the relevant view; if it needs a knowledge block, add a prompt section in `lib/buildContext/index.ts`.
- **New spec knowledge:** follow §6 table + the READMEs in `knowledge/guides/` and `knowledge/simc/`.
- **New theme:** add a `html[data-vibe="…"]` block in `globals.css` + an entry in `lib/vibes.ts` (both must stay in sync); it appears as a Settings radio automatically.
- **New page:** add to `pages/`, add a nav link in `AppNav.tsx`, compose the body from `components/ui.tsx` primitives (PageHeader → Panel/FieldRow).

---

## 10. Testing & scripts

```bash
npm run dev            # localhost:3000 (.env.local loaded)
npm test               # full Jest suite; npx jest --testPathPatterns=<regex> for a subset
npm run build          # production build — required before finishing any change
npm run embed-simc     # regenerate lib/knowledge/embeddedSimc.ts from knowledge/simc/
npm run scrape-wowhead-frost | scrape-wowhead-unholy
npm run scrape-icy-veins-frost | scrape-icy-veins-unholy
```

Test layout mirrors source: `__tests__/api/*` (route handlers with mocked fetch), `__tests__/lib/*` (pure units). Jest 30 note: the CLI flag is `--testPathPatterns` (plural).

---

## 11. Known limitations / open threads

- Guide corpora cover few specs (see §6); extending them is the highest-leverage content work.
- `.cursor/rules/parse-analyzer.mdc` holds the always-on agent dev context; keep it consistent with this document when architecture changes.
- Themes restyle shared chrome via variables, but a few components still carry hardcoded `Rajdhani`/hex values (charts, tooltips, talent trees) — migrate opportunistically to the CSS variables when touching those files. The **Light** theme is most affected by leftovers.
- Anonymous visitors share the server's WCL token and rate limit; heavy shared use can exhaust the hourly points budget, and private reports need per-user sign-in. Signed-in users get their own budget and private-log access.
```
