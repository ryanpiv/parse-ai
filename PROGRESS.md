# PROGRESS — where we left off

> Session checkpoint for humans and AI agents. Read this first when resuming, then
> `ARCHITECTURE.md` and `.cursor/rules/parse-analyzer.mdc` for the full picture.
> Update or prune this file as items get done.

_Last updated: 2026-09-14_

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
- [ ] Token expiry: `readWclUser()` treats a past `expiresAt` as signed-out, but a
      token revoked/expired server-side mid-session will surface as a WCL error via
      the proxy — check that the message is sane and points at re-signing in.
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

- Token refresh: WCL user tokens eventually expire and we don't use refresh
  tokens — users just re-sign-in. Fine for now; revisit if it annoys.
- Wowhead scraped corpus only covers Frost Mage (specId 64); extend when adding specs.
