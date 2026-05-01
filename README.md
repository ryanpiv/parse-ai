# parse-ai

An AI-powered WarcraftLogs comparison tool. Paste two WarcraftLogs report URLs and get a side-by-side breakdown of spell usage, proc efficiency, cooldown timing, talent differences, and an AI-generated analysis via Claude.

---

## What It Does

1. User pastes a WarcraftLogs compare URL (two players, same fight)
2. App fetches all combat events, damage tables, buff/debuff timelines, and talent data from the WarcraftLogs GraphQL API
3. Game state is processed server-side: cast sequences annotated with buff context, procs detected, uptime computed, cooldown patterns extracted
4. Talent trees for both players are fetched from the Blizzard Game Data API and diffed
5. Everything is assembled into a rich structured prompt sent to Claude (Anthropic)
6. Claude returns a prioritized list of actionable improvements + deep analysis
7. User can ask follow-up questions in a chat UI backed by the full fight context

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.3 (Pages Router) |
| Language | TypeScript (strict) |
| UI | React 18, Chart.js 4 + react-chartjs-2 |
| AI | Anthropic Claude API (`/v1/messages`) |
| Fight Data | WarcraftLogs GraphQL API v2 |
| Talent Trees | Blizzard Game Data API (OAuth client credentials) |
| Icons | Wowhead tooltip API → Zamimg CDN |
| Auth | WCL: PKCE OAuth flow; Blizzard: client credentials |

---

## Environment Variables

Create `.env.local` at the repo root:

```
WCL_TOKEN=<WarcraftLogs OAuth JWT>
BLIZZARD_CLIENT_ID=<Battle.net client ID>
BLIZZARD_CLIENT_SECRET=<Battle.net client secret>
ANTHROPIC_API_KEY=<Anthropic API key>
```

- **WCL_TOKEN** — Obtain via the in-app OAuth button (PKCE flow)
- **BLIZZARD_CLIENT_ID / SECRET** — Register an app at https://develop.battle.net
- **ANTHROPIC_API_KEY** — https://console.anthropic.com

---

## Project Structure

```
pages/
  index.tsx               # Main app — URL parsing, data fetching, charts, AI chat
  talent-preview.tsx      # Dev/QA page for testing talent tree rendering
  _app.tsx                # App wrapper, global CSS
  auth/callback.tsx       # WCL OAuth callback handler
  api/
    ai.ts                 # POST → Anthropic Claude proxy
    auth.ts               # GET (token check) / POST (PKCE token exchange)
    wcl.ts                # GraphQL proxy to WarcraftLogs
    talents.ts            # Batch resolve talent node IDs → spell info
    blizzard-tree.ts      # GET talent tree structure from Blizzard (24h cache)
    tooltip.ts            # GET spell icon from Wowhead (avoids CORS)
    debug-tree.ts         # Debug: raw hero_talent_trees + node ranks

lib/
  wclClient/              # gql() helper and callAI() helper
  fightAnalysis/          # collectNames, resolveNames, fetchFullFightData, processFightData
  gameState/
    tracking.ts           # Build buff/debuff/proc state timeline per player
    analysis.ts           # Annotate casts, detect sequences, compute uptimes, cast spacing
    constants.ts          # GCD, spec constants
    metrics.ts            # DPS/efficiency helpers
  buildContext/
    index.ts              # Assembles rich AI prompt from processed fight data
    formatters.ts         # Per-section formatters (opener, procs, cooldowns, talents)
  talents/
    fetchTalents.ts       # Fetch both players' talent picks + specID from WCL
    diffTalents.ts        # Categorize talents: both / p1-only / p2-only
    nodeResolution.ts     # Resolve node IDs → spell names via WCL API
  blizzardClient.ts       # Blizzard OAuth token cache + blizzardGet()
  pkce.ts                 # PKCE helpers (genVerifier, genChallenge)
  styles.ts               # Shared inline style constants

components/
  AIChat/
    index.tsx             # Chat message list, input, preset question buttons
    FormatAI.tsx          # Markdown → React renderer for AI responses
    CopyBtn.tsx           # Copy-to-clipboard
  Charts/
    SpellUsageChart.tsx   # Bar chart: cast counts + DPM comparison
    CastTimelineChart.tsx # Timeline: spell casts over fight duration
    ProcEfficiencyChart.tsx # Proc used vs available (e.g. Fingers of Frost)
    CooldownTimelineChart.tsx # Cooldown availability over time
    SpellTimeline.tsx     # Compact cast timeline
    ChartCard.tsx         # Shared card wrapper
    chartDefaults.ts      # Chart.js shared defaults
  TalentCompare/
    TalentCompare.tsx     # Three trees side-by-side (class + hero + spec)
    TalentTree.tsx        # SVG grid with connection lines + node rendering
    TalentIcon.tsx        # Individual node: icon, rank counter, hover tooltip
    SpellTooltip.tsx      # Context provider for hover tooltip overlay

scripts/
  check-tree.mjs          # Validate /api/blizzard-tree output (requires dev server)
  test-icons.mjs          # Test Wowhead icon fetching for known spell IDs

types/
  wcl.ts                  # WCLAbility, TalentNodeInfo
  global.d.ts
```

---

## Data Flow

```
User pastes WCL compare URL
  │
  ├─ Parse report codes, fight IDs, player names from URL
  │
  ├─ WCL GraphQL (via /api/wcl):
  │     Fight metadata → actor names, specs
  │     Raw events → casts, buffs, debuffs, damage, deaths (paginated)
  │     Damage tables → DPS, damage done/taken
  │
  ├─ lib/gameState:
  │     Build state tracker (buff/debuff/proc timeline)
  │     Annotate casts (buffs active, procs available at cast time)
  │     Detect sequences (combos, chains)
  │     Compute uptimes + cast spacing
  │
  ├─ lib/talents + /api/blizzard-tree:
  │     Fetch both players' talent picks + specID from WCL
  │     Fetch Blizzard talent tree (nodes, edges, hero trees) — cached 24h
  │     Diff builds → p1-only / p2-only / shared
  │
  ├─ lib/buildContext:
  │     Assemble structured prompt: overall stats, opener, procs,
  │     cooldowns, talent diff, fight notes
  │
  ├─ /api/ai → Claude:
  │     System prompt + rich context + user request
  │     Returns: top 5 improvements + deep analysis with Wowhead links
  │
  └─ Render: charts + talent tree diff + AI analysis + chat UI
```

---

## Talent Tree Rendering

Talent trees are fetched from the Blizzard Game Data API and rendered using raw node positions (`raw_position_x` / `raw_position_y`) for accurate in-game layout. Falls back to `display_row` / `display_col` grid if raw values are absent.

- **Three tree sections** always shown: Class, Hero (filtered to trees either player picked into), Spec
- **Diff coloring**: gold border = player 1 only, blue border = player 2 only, neutral = both, dimmed = neither
- **Node shapes**: square = active talent, octagon via `clip-path` = CHOICE node (two icons split half-and-half)
- **Connection lines**: SVG lines between prerequisite nodes, colored by most-specific endpoint state
- **Icons**: fetched via `/api/tooltip` proxy (Wowhead → Zamimg CDN), cached in module-level map per session

Hero talent trees are embedded directly in the Blizzard API response at `hero_talent_trees[].hero_talent_nodes[]` — no separate fetch needed. Only hero trees where at least one player has a node selected are displayed.

CHOICE nodes use `ranks[0].choice_of_tooltips[]` in the Blizzard API (not the standard `tooltip` field used by regular nodes).

---

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/ai` | POST | Proxy to Anthropic `/v1/messages` |
| `/api/auth` | GET | Check if WCL_TOKEN is valid |
| `/api/auth` | POST | Exchange PKCE code for WCL OAuth token; writes to `.env.local` |
| `/api/wcl` | POST | GraphQL proxy to WarcraftLogs v2 API |
| `/api/wcl` | GET | WCL rate limit info |
| `/api/talents` | POST | Batch resolve talent node IDs → spell names/icons |
| `/api/blizzard-tree` | GET | Talent tree nodes + edges for a specId (24h cache). `?nocache=1` busts cache. `?debug=hero` dumps raw hero tree shape |
| `/api/tooltip` | GET | Fetch spell icon slug from Wowhead (server-side, avoids CORS). Do NOT add `?dataEnv=11` — causes 404s for retail spells |

---

## Dev Scripts

```bash
npm run dev          # Start dev server on :3000
npm run build        # Production build
npm run test         # Jest test suite

# Requires dev server running on :3000
node scripts/check-tree.mjs [specId]   # Validate blizzard-tree API output (node counts, missing spellIds, bounds)
node scripts/test-icons.mjs            # Test Wowhead icon fetching for known Frost Mage spell IDs
```

---

## Key Design Decisions

- **All external API calls are server-side** — WCL, Blizzard, Wowhead, and Anthropic are all proxied through Next.js API routes. No secrets or CORS issues on the client.
- **Talent tree layout uses raw Blizzard positions** — `raw_position_x` / `raw_position_y` give accurate in-game node placement matching what Raidbots shows.
- **WCL token is persisted to `.env.local`** — The PKCE OAuth flow writes the token directly to the file so it survives server restarts without a separate database.
- **Fight context is built once, reused for all chat turns** — The structured prompt is assembled after initial analysis and prepended to every subsequent AI message.
- **Icon cache is module-level** — `iconCache` in `TalentTree.tsx` persists across renders within a session so Wowhead is only hit once per spell ID per page load.
- **Never auto-commit** — File edits are made and left unstaged so the developer can review diffs in their IDE before committing.

---

## Spec Coverage

**SimulationCraft default APLs** (opt-in on Analyze) are bundled for **all Mage specs** (62 Arcane, 63 Fire, 64 Frost) and **all Death Knight specs** (250 Blood, 251 Frost, 252 Unholy); see `lib/knowledge/embeddedSimc.ts` and `knowledge/simc/`. The talent tree system, data pipeline, charts, and AI chat work for any spec; Wowhead guide snippets are still Frost-only in `lib/knowledge/embeddedGuides.ts`.
