# PROGRESS — where we left off

> Session checkpoint for humans and AI agents. Read this first when resuming, then
> `ARCHITECTURE.md` and `.cursor/rules/parse-analyzer.mdc` for the full picture.
> Update or prune this file as items get done.

_Last updated: 2026-09-16_

## History: per-device copy + row delete (2026-09-16)

History is localStorage-only. The page now says so (header + note), and each
row has **Remove** in addition to **Clear history**.

## Reports list cache (2026-09-16)

Clicking **Reports** remounts the page but no longer re-hits WCL for the same
list, account, fights, or roster. Data lives in a tab-session cache
(`reportsBrowserCache.ts`) and is cleared on sign-out or the new **Refresh**
button. Switching My uploads / guild / page still fetches once, then reuses.

## Code style retrofit complete (2026-09-16)

- **`CODE_STYLE.md`** + `.cursor/rules/code-style.mdc` define the rules. Existing
  UI now matches: arrow-const default exports, `ComponentNameProps` / `I*` types,
  component folders with CSS modules, tests colocated next to subjects (API
  route tests stay in `__tests__/api/`).
- Shared atoms live in **`src/styles/ui.module.css`**. `lib/styles.ts` and the
  `.pa-*` globals are gone; `src/styles/globals.css` is themes + resets only.
  Page chrome is in `src/styles/pages/`. Computed values (class colors, SVG tree
  edges, ResizeObserver widths) stay inline on purpose.
- App code lives under **`src/`** (`src/pages`, `src/components`, `src/lib`,
  `src/contexts`, `src/styles`, `src/types`). `public/`, `knowledge/`, and
  `scripts/` stay at the repo root (Next + vendored corpora).
- Ask Claude chat UI that was duplicated in both fight views is now
  `components/AIChat/AIChat.tsx`.
- Visual sweep (2026-09-16): empty pages + Settings + all three themes, then a
  loaded solo fight (stats, metric timeline chip filter, spell timeline, Ask
  Claude key prompt, Compare empty-state / similar-parse button) looked correct.

## Latest session (2026-09-16): SimC APL parity + WCL token refresh

- **SimC APLs now cover all 34 specs with an upstream default APL** (everything
  except the six healer specs SimC doesn't sim: Holy Paladin, Disc/Holy Priest,
  Resto Shaman, Mistweaver, Preservation Evoker; Resto Druid *does* have a DPS
  APL and is included). `scripts/embed-simc.mjs` is now a table-driven generator
  (`SPECS` table = single source of truth) that writes the **generated**
  `lib/knowledge/embeddedSimcData.ts` in full; prompt logic stays in
  `embeddedSimc.ts`. Coverage locked by `__tests__/lib/embeddedSimc.test.ts`.
- **Discovered Midnight's 40th spec: Devourer Demon Hunter (specId 1480)** — the
  earlier "all 39 specs" pass missed it. Added to the Wowhead scraper registry,
  scraped (patch 12.1.0 guides exist), embedded, and to the SimC corpus
  (`demonhunter_devourer.simc` exists upstream). Tests updated to 40/34.
- **WCL token refresh implemented**: `user-exchange` now returns WCL's
  `refresh_token`; new `/api/auth` `action: 'user-refresh'` exchanges it
  (rotates). `ensureFreshWclUser()` in `lib/wclUserToken.ts` silently renews
  when the access token is expired or within 6h of expiry — wired into
  `useWclUser` mount and the start of every `gql()`. Concurrent calls share one
  exchange; failures back off 60s; a rejected refresh token (invalid_grant)
  drops to the sign-in prompt (or keeps a still-valid access token, minus the
  dead refresh token). 10 jsdom tests in `__tests__/lib/wclUserToken.test.ts`.
  _Not yet verified against real WCL end-to-end (needs a fresh sign-in to get a
  refresh token stored; existing sessions won't have one until they re-auth)._

## Current state

**WCL sign-in is now mandatory for everyone.** The auth model went through three
iterations this session and landed on the last one:

1. ~~Per-user client ID pasted into Settings~~ (removed)
2. ~~Hybrid: shared server token for public logs + optional user sign-in~~ (removed)
3. **Final: every user must "Sign in with WarcraftLogs"** (OAuth authorization-code
   + PKCE). No shared-token fallback for report data.

How it works now:

- `/api/wcl` **requires** the `x-wcl-user-token` header → 401 with a "Sign in"
  message otherwise. All report queries hit WCL's `/api/v2/user` endpoint, so each
  user gets their own permissions (private logs) and rate-limit budget.
- `/api/auth` GET returns `{ clientId }` (public, for the sign-in redirect);
  POST `action: 'user-exchange'` swaps the OAuth code for a token that is returned
  to the browser and stored in **localStorage only** (`parse-analyzer-wcl-user`).
- `lib/wclUserToken.ts` — token read/write/expiry, `useWclUser`, `wclClientHeaders()`,
  `startWclSignIn()`. `lib/pkce.ts` — verifier/challenge helpers.
- `pages/auth/callback.tsx` — finishes the exchange, stores the token, redirects.
- `lib/serverWclToken.ts` (client-credentials from `WCL_CLIENT_ID`/`WCL_CLIENT_SECRET`)
  is now **only** for game-data routes: `/api/talents`, `/api/debug-tree`.
- `FightAnalysisContext.authStatus` = `ok` only when signed in; `wclClientId`
  feeds the sign-in buttons (Settings `WclAccountRow`, `WclKeyPrompt`).

## Verified this session

- **Site-wide font softening (2026-09-15, uncommitted)**: the mono "terminal"
  font (IBM Plex Mono) is no longer used for prose/status/labels anywhere —
  `s.note`/`s.alert*`/`s.input`/`s.badge`/`s.logoSub`, the `pa-*` chrome
  classes in `globals.css`, all hardcoded `IBM Plex Mono` inline styles
  (Solo/CompareFightView, TalentCompare/Tree/Icon, SpellTimeline,
  spellTooltips), and every Chart.js legend/tick/axis font (now `'DM Sans'` —
  canvas can't read CSS vars) use the UI font. `--font-mono` still exists and
  is kept only for genuinely code-like content: the example compare URL in
  `AnalyzeEmptyState` and inline `<code>` elements (browser default mono).
  The Analyze empty-state directions were also shortened to two lines split
  by the shared `OrDivider` primitive. Verified live on the compare view
  (tables + charts) and empty state.

- **Sign-in prompt overhaul (2026-09-15, uncommitted)**: `WclKeyPrompt` is now a
  prominent gold-bordered panel ("WarcraftLogs sign-in required" label, large
  centered sign-in button) when the server has a client id; the operator
  "Server setup steps" help only renders when `WCL_CLIENT_ID` is genuinely
  missing. `wclClientId` in `FightAnalysisContext` is tri-state
  (`undefined` = fetching, `null` = server unconfigured) so the prompt and the
  Settings `WclAccountRow` no longer flash "server not set up / sign-in
  unavailable" while `/api/auth` is in flight. Verified live signed-out via
  `127.0.0.1:3000` (separate origin → empty localStorage) on Analyze and
  Reports; tests 18 suites / 97 pass; build clean.

- **Talent compare tree fixes (2026-09-15, uncommitted)**: (1) edge tinting in
  `TalentTree.tsx` no longer requires `rank > 0` on both ends — WCL reports
  rank 0 for many taken single-rank talents, which was erasing nearly all
  gold/blue/gray connections (state p1/p2/both is the taken signal; the
  both-ends rule still blocks paths through untaken nodes). (2)
  `TalentCompare.tsx` now measures its container (ResizeObserver) and sizes the
  three trees to fit without horizontal scroll on desktop; budget accounts for
  container/section padding, flex gaps, per-tree LAYOUT_PAD and scrollbar
  slack. Verified live at 1440/1200px emulated widths (no h-scroll, 0 edge
  color mismatches via DOM audit). (3) Edge strokes brightened — shared 'both'
  lines 2.25px @0.85, untaken skeleton 1.5px @0.5 — because in dense spec trees
  (1-unit column steps) icons hide most of each line and the old faint strokes
  read as "missing connections". Data itself verified complete: Blizzard
  unlocks edges match wago.tools TraitEdge DBC exactly for spec 62 (72 class /
  53 spec); only Prismatic Bolt is genuinely standalone. Prod env vars fixed same night: Blizzard
  keys were scoped "pre-production" in Vercel → moved to Production +
  redeploy; `/api/blizzard-tree` healthy in prod.

- `npm test` — 16 suites / 86 tests pass (includes new `/api/auth`, `/api/wcl`
  401 + user-endpoint routing, and `serverWclToken` cache tests).
- `npm run build` — clean.
- Browser (signed out): Analyze empty state shows the sign-in prompt,
  `POST /api/wcl` returns 401 with the sign-in message, Settings shows the
  WarcraftLogs row.

## NOT yet tested — do this next

Sign-in itself now works locally (`WCL_CLIENT_ID` is in `.env.local`; the
`*_VERCEL` variables there are the production client — copy those into Vercel's
env settings as `WCL_CLIENT_ID`/`WCL_CLIENT_SECRET` when deploying, since the
`_VERCEL` names aren't read by code). Remaining items below.

Setup first:

1. Create a client at <https://www.warcraftlogs.com/api/clients> with redirect URL
   `http://localhost:3000/auth/callback` (add the production origin when deploying).
2. Put `WCL_CLIENT_ID=` in `.env.local`, restart `npm run dev`. Public/PKCE
   clients have no secret — the ID alone enables sign-in. Add `WCL_CLIENT_SECRET=`
   only if the client is confidential (also enables client-credentials game data,
   though legacy `WCL_TOKEN` covers that too).

Then test:

- [x] "Sign in with WarcraftLogs" → WCL consent → `/auth/callback` exchange → signed in.
      _Verified 2026-09-14 with a public/PKCE client (id only, no secret). Gotcha found:
      a stray character in `WCL_CLIENT_ID` makes WCL's authorize page render blank
      (`invalid_client`) — first UUID block must be 8 chars._
- [ ] Load a report on Analyze while signed in (solo + compare URLs).
- [ ] Load a **private** log from the signed-in account (the whole point of user auth).
- [ ] Sign out → prompt returns, loads blocked again.
- [ ] Token expiry: `ensureFreshWclUser()` now silently renews via the stored
      refresh token (on mount + before every `gql()`); a token revoked
      server-side mid-session still surfaces as a WCL error via the proxy —
      check that the message is sane and points at re-signing in. Needs a fresh
      sign-in first (older sessions have no stored refresh token).
- [ ] Talent compare page (`/compare`) "Load from logs" while signed in
      (it sends `wclClientHeaders()` too).
- [ ] Talents page spell-name resolution still works (`/api/talents` uses the
      server client-credentials token — same env vars, different flow).
- [ ] State-mismatch / denied-consent paths on `/auth/callback`.
- [ ] Deployment: set both env vars in Vercel, register the production redirect URL.

## Known quirks

- Running `npm run build` while `npm run dev` is up corrupts `.next`; kill dev,
  build, then `rm -rf .next && npm run dev`.
- Pre-existing `tsc --noEmit` warnings live only under `__tests__/` and are
  unrelated; `npm test` and the build are the gates.
- `WCL_TOKEN` (static legacy env) is still honored by `lib/serverWclToken.ts` as a
  fallback for game-data routes only — it no longer enables report loading.

## Reports browser (added 2026-09-14, phase 1 done)

New **Reports** nav tab (`pages/reports.tsx` → `components/reports/ReportBrowser.tsx`):
source chips (My uploads / each guild from `currentUser.guilds`) → paginated report
list (`reportData.reports`, 20/page) → boss pulls (difficulty + kill/wipe% badges)
→ WoWAnalyzer-style player grid (role sections, class-colored cards — colors in
`lib/wowClassColors.ts`, queries in `lib/wclReports.ts`). Picking 1 player = solo,
2 = compare (first pick is player 1); it builds the WCL URL and calls
`fa.loadCompare(url)` (now accepts a URL override) then routes to Analyze.
Verified end-to-end in-browser against live data (compare of two mages loaded).

Also fixed: `lib/wclFightPlayers.ts` now unwraps the nested
`playerDetails.data.playerDetails` shape (was silently falling back to ranking
tables → everyone showed as DPS with class-name specs).

Phase ideas, in order:
- [x] "Compare vs a top parse" — done 2026-09-14. With exactly one player picked,
      a section fetches `worldData.encounter.characterRankings`
      (same class/spec/difficulty, dps or hps by role, cached per key in
      `lib/wclReports.ts`) and lists the top 10; clicking loads a cross-report
      compare (me vs their ranked pull). Verified live incl. a CJK player name
      (encodeURIComponent + name-based source resolution both fine).
- [x] Top-parse polish round — done 2026-09-14 (all verified live in-browser):
      - Extracted **`components/reports/TopParseSection.tsx`** — prominent
        gold-labelled panel (was a tiny ghost toggle).
      - **Analyze Compare tab entry** — when a solo report is loaded, the Compare
        empty state shows the same section
        (`components/analyze/TopParseCompare.tsx` resolves fight/roster from the
        loaded URL first).
      - **Reports tab state survives navigation** — module-scope `remembered`
        snapshot (source/page/report/fight) + effect-driven refetch; "⟲ All
        reports" reset button in the player grid header.
      - **Last character auto-pick** — name stored in localStorage
        (`parse-analyzer-last-player`) on analyze/compare, auto-picked as P1 when
        present in a roster (with an "Auto-picked …" note; any manual click clears it).
- [x] "Similar" instead of "top 10 list" — done 2026-09-14 after user feedback
      (they wanted WCL's find-similar-parses behavior, not a literal top-10):
      - `TopParseSection` is now **one click**: fetch rankings →
        `pickSimilarRank()` (`lib/wclReports.ts`) picks the highest-ranked parse
        with a kill time within 10s → 30s → 60s of the pull (else closest) and
        the cross-report compare loads immediately. The v2 API has no
        similar-parse search endpoint, so this approximates WCL's fight-length
        filter over the top rankings page. Verified live: 23:34 pull matched a
        23:33 ranked kill.
      - "More options" now links to **WCL's compare-search modal for the exact
        pull** (`wclCompareSearchLink()`: `?fight=N&view=replay&modal=compare`)
        instead of the zone rankings page (`wclRankingsLink` removed).
      - Fixed the Reports source chips: the active chip was getting only the
        `--active` modifier class without the `pa-roster-pick` base → rendered
        as an unstyled browser button.
      - Fixed cramped spacing around the Analyze Compare-tab button.
      - Unit tests for `pickSimilarRank` + `wclCompareSearchLink`
        (`__tests__/lib/wclReports.test.ts`); 92 tests total.
- [x] **History tab** — done 2026-09-14, verified live. `lib/analysisHistory.ts`
      keeps a localStorage list (`parse-analyzer-history`, cap 50) of every
      successful solo/compare load: canonical URL (dedupe key — reload bumps to
      top, no duplicates) + names/specs/boss/timestamp. Recorded at the success
      points in `FightAnalysisContext`; `pages/history.tsx` renders a scrollable
      list (Solo/Compare badges, relative timestamps, Clear button); click →
      `loadCompare(url)` → Analyze. Nav tab sits between Reports and Talent compare.
- [x] **Output over time chart** — done 2026-09-14, verified live. New
      `components/Charts/MetricTimelineChart.tsx` on both Solo and Compare views
      ("Spell usage & cast rate" section): damage done / healing done / damage
      taken, one visible at a time via chip filter (default damage done).
      Data from WCL's pre-bucketed `graph` endpoint — `lib/metricGraphs.ts`
      fetches all three metrics in one aliased query per player at load
      (failure-tolerant, chart hides if absent) and stores them as
      `AnalyzedFightData.metricSeries`; players are resampled into common
      buckets, and `compareWindowSec` (trim toggle) is honored.
- [x] **Duplicate-load skip** — done 2026-09-15, verified live. `loadCompare`
      keeps `loadedUrlKeysRef` (raw input + canonical URL of the current
      session); re-requesting either form returns "✓ Already loaded" instantly
      (~100ms), still bumps the history entry, and switches to the Compare view
      for compare sessions. A full page reload clears the in-memory session, so
      the next request after a reload correctly does a real load.
- [x] Analyze "No fight loaded" empty state now leads with a link to the
      Reports browser ("easiest way in"), pasting a URL is the fallback.
- [ ] Character portraits on player cards (Blizzard character-media API) — only
      if the grid feels flat without them.

## Ideas / not started

- ~~Token refresh~~ — done 2026-09-16 (see latest session at top).
- Wowhead corpus (2026-09-15): now covers **all 40 retail specs** (Devourer DH
  added 2026-09-16). Scraper
  consolidated into table-driven `scripts/wowhead/scrape-wowhead.mjs`
  (`npm run scrape-wowhead -- <folder…|--all>`; per-spec scripts deleted, old
  npm aliases still work; role-based URL suffixes pve-dps/-healer/-tank; 400ms
  page / 500ms spec pacing). `embeddedWowhead.ts` is a `SPEC_DOCS` registry
  with all 40 imports; coverage locked by `__tests__/lib/embeddedWowhead.test.ts`
  (every spec has fetch ok + talent copies + rotation sections; all snapshots
  patch 12.1.0). `markupBbCode` no longer written (redundant with `sections`,
  halves bundled size — corpus is ~1.9MB pretty-printed on disk). SimC APLs
  now cover all 34 specs with an upstream default APL (2026-09-16).
