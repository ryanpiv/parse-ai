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
- **Warcraft Logs bar** (in `AppNav`, shared across pages): report/compare URL input, Load button, PKCE OAuth connect strip, load status alerts.
- **Solo | Compare view tabs** — always clickable. When nothing is loaded, each shows an instructional empty state (`AnalyzeEmptyState`) explaining what URL format to paste. Solo works from any single report (`?fight=<id|last|first>`) or a compare URL (you are player 1). Compare needs a two-player compare URL.
- **Multi-player reports** — if a single report fight has several players and no `?source=`, a roster picker appears (class icons, spec labels).
- **Charts** — spell usage bars, cast timeline, proc efficiency, cooldown timeline, compact spell timeline with sticky zoom, crit rate. Compare mode has a "trim to shorter fight" toggle windowing all charts (`compareWindowSec`).
- **AI chat** — two independent threads (solo/analyze vs compare), streaming responses with live token counts, preset question tiles, markdown rendering with Wowhead links, copy buttons.
- **Chat presets** (`lib/prompts/chatPresets.ts`) — canned prompts; some force extra knowledge context (SimC APL, Wowhead scrape, Icy Veins scrape) for that message. SimC block is otherwise opt-in via a UI toggle (`simcCompareEnabled`).
- **Load errors are loud** — red "Could not load this log" banner in both the WCL panel and the sticky view bar; `/api/wcl` fetches time out after 60s and network failures map to "is `npm run dev` running?" guidance.

### Talent compare (`/compare`)
- Paste two talent export strings (in-game `/etl`, Wowhead, Raidbots), or fetch both builds from a WCL compare URL (`action: 'compare-talents'` on `/api/wcl`).
- Decodes/encodes Blizzard talent export strings (`lib/talents/decodeTalentString.ts`), diffs builds, renders three side-by-side trees (class / hero / spec) with diff coloring.
- Shareable URL via `?b1=&b2=&n1=&n2=`.

### Talents (`/talent-preview`)
- Raidbots-style full-tree render for one player (gold = taken).
- Sources, in priority order: WCL node rows saved in session → talent export string → synthetic fills (`?preset=budget|max|none` for QA).
- `TalentSourceForm` lets the user paste an export string or load player-1 talents straight from the WCL URL bar (`lib/talents/loadTalentsFromWclUrl.ts`), including a roster picker.

### Look (`/look`)
- Visual theme ("vibe") gallery. Each card is a mini UI kit — swatches, type sample, mock nav/tabs/panel — for the five bundled themes: **Classic** (gold HUD), **Linen**, **Slate**, **Orchid**, **Harbor**.
- "Use this kit" sets `data-vibe` on `<html>` and persists to `localStorage` (`parse-analyzer-vibe`); a pre-hydration script in `pages/_document.tsx` prevents flash. Theme definitions live in `lib/vibes.ts` (data) and `styles/globals.css` (`html[data-vibe="…"]` variable overrides).

### Claude API key (BYOK)
- `AnthropicKeyPanel` in the header: user pastes a Claude **Console** key (`sk-ant-…`). Stored only in `localStorage` (`lib/anthropicUserKey.ts`), sent as `x-anthropic-api-key` header to `/api/ai`, which prefers it over the server's `ANTHROPIC_API_KEY` env fallback. **There is no "Sign in with Claude" for third-party apps** — Anthropic's policy restricts consumer OAuth to their own products; Console API keys are the supported path.

### WCL auth
- OAuth PKCE flow (`lib/pkce.ts`, `/auth/callback`) writes the resulting token to `.env.local` as `WCL_TOKEN` via `/api/auth` POST. The green "connected" badge means OAuth completed; **GraphQL calls use the server-side `WCL_TOKEN`**, which is a separate concern — both must be valid.

---

## 4. Directory map

```
pages/
  index.tsx            Analyze: view tabs, pane gating, Solo/Compare mounting
  analyze.tsx          Redirect → /
  compare.tsx          Talent string diff page
  talent-preview.tsx   Full single-player tree (Raidbots-style)
  look.tsx             Theme/UI-kit gallery
  _app.tsx             Provider stack: AppSession → AnalyzePageCache → FightAnalysis, + AppNav
  _document.tsx        Pre-hydration vibe script
  auth/callback.tsx    WCL PKCE callback
  api/
    ai.ts              Claude proxy (JSON + SSE streaming; BYOK header > env key)
    wcl.ts             WCL GraphQL proxy; also `action: 'compare-talents'`
    auth.ts            WCL token check / PKCE exchange (writes .env.local)
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
  AppNav.tsx           Fixed route tabs + WCL panel + AnthropicKeyPanel (hidden on /look)
  WclLoadStatus.tsx    Load progress/error banners ('nav' and 'viewbar' variants)
  AnthropicKeyPanel.tsx
  analyze/             SoloFightView, CompareFightView, AnalyzeEmptyState
  AIChat/              Chat list, FormatAI markdown renderer, CopyBtn
  Charts/              All Chart.js wrappers + SpellTimeline + ChartCard
  TalentCompare/       TalentCompare, TalentTree (SVG), TalentIcon, SpellTooltip,
                       TalentSourceForm

lib/
  wclClient/           gql() with timeout + formatted errors; callAI / callAIStream
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
  vibes.ts             Theme kit data for /look
  styles.ts            Shared inline styles (s.*) + pa-* class name map
  serverEnv.ts         Server-only env resolution (WCL_TOKEN, ANTHROPIC_API_KEY, Blizzard)
  blizzardClient.ts, pkce.ts, wclFightPlayers.ts, spellTooltips/

knowledge/             Source-of-truth corpora (see §6)
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
WCL_TOKEN=            # written automatically by in-app PKCE flow; server-side GraphQL
ANTHROPIC_API_KEY=    # optional server fallback; users can BYOK in the UI instead
BLIZZARD_CLIENT_ID=   # Battle.net app (talent trees)
BLIZZARD_CLIENT_SECRET=
```

- All third-party calls (WCL, Blizzard, Wowhead, Anthropic) are **server-proxied** through `pages/api/*` — no secrets or CORS on the client.
- The one deliberate exception to "no client keys": the **user's own** Anthropic Console key, which the user pastes knowingly; it lives in their browser's localStorage and transits only to our own `/api/ai` proxy as a header.
- `lib/serverEnv.ts` resolves env with aliases (`WCL_TOKEN_LOCAL`, etc.) and placeholder rejection. Use it, not raw `process.env`, in API routes.

---

## 8. Theming

- Every color/font/radius flows through CSS custom properties defined in `:root` (Classic) and overridden per theme in `html[data-vibe="linen|slate|orchid|harbor"]` blocks in `styles/globals.css`.
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
6. **Errors must be readable.** Use `formatApiError` / `formatLoadError` / `formatFetchError` (`lib/wclClient`) — never surface `[object Object]` or silently spin. `gql()` has a 60s timeout; preserve that behavior in new fetch paths.
7. **Windows dev environment.** Shell is PowerShell 5 (`&&` does not work; use `;`). Dev server webpack cache occasionally corrupts (`Cannot find module './chunks/undefined'`, 500s on every route) — fix by stopping the server and deleting `.next`, not by changing code.
8. **URL parsing gotchas:** single-report URLs require `?fight=` (id, `last`, `first`); compare URLs accept both `source` and `comparesource` params; browser-truncated URLs (ending in a bare `&compares`) still parse but lose player selection.
9. **Wowhead tooltip proxy:** do not add `?dataEnv=11` to Wowhead requests — it 404s retail spells.
10. **PII:** logs and Raidbots exports can contain player names/emails; don't echo private data into committed files or prompts unnecessarily.

### Typical contribution recipes

- **New chart:** add a component in `components/Charts/` using `chartDefaults.ts` + `ChartCard`, feed it from `p1data/p2data/spellRows`, mount in `SoloFightView`/`CompareFightView`, respect `compareWindowSec` if compare-aware.
- **New chat preset:** add to `lib/prompts/chatPresets.ts`, wire the tile in the relevant view; if it needs a knowledge block, add a prompt section in `lib/buildContext/index.ts`.
- **New spec knowledge:** follow §6 table + the READMEs in `knowledge/guides/` and `knowledge/simc/`.
- **New theme:** add a `html[data-vibe="…"]` block in `globals.css` + an entry in `lib/vibes.ts` (both must stay in sync).
- **New page:** add to `pages/`, add a nav link in `AppNav.tsx`, decide whether the WCL panel should show (see the `/look` `lookPage` gate).

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
- The `/look` themes restyle shared chrome via variables, but a few components still carry hardcoded `Rajdhani`/hex values (charts, tooltips, talent pages) — migrate opportunistically to the CSS variables when touching those files.
- WCL OAuth "connected" and `WCL_TOKEN` validity are independent; a stale token manifests as GraphQL errors despite a green badge.
```
