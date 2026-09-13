# PROGRESS — where we left off

> Session checkpoint for humans and AI agents. Read this first when resuming, then
> `ARCHITECTURE.md` and `.cursor/rules/parse-analyzer.mdc` for the full picture.
> Update or prune this file as items get done.

_Last updated: 2026-09-13_

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

The full OAuth round-trip has **never been exercised with real credentials**.
This dev machine's `.env.local` only has the legacy `WCL_TOKEN` — no
`WCL_CLIENT_ID` / `WCL_CLIENT_SECRET` — so the UI currently shows the
"sign-in unavailable / server owner setup" fallback (correct behavior, but it
means the happy path is unverified).

Setup first:

1. Create a client at <https://www.warcraftlogs.com/api/clients> with redirect URL
   `http://localhost:3000/auth/callback` (add the production origin when deploying).
2. Put `WCL_CLIENT_ID=` and `WCL_CLIENT_SECRET=` in `.env.local`, restart `npm run dev`.

Then test:

- [ ] "Sign in with WarcraftLogs" from Settings → WCL consent → redirected back to
      `/auth/callback` → Settings shows "✓ Signed in as {name}".
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

## Ideas / not started

- Token refresh: WCL user tokens eventually expire and we don't use refresh
  tokens — users just re-sign-in. Fine for now; revisit if it annoys.
- Wowhead scraped corpus only covers Frost Mage (specId 64); extend when adding specs.
