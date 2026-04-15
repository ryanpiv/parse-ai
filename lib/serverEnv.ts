/**
 * Server-only environment resolution for API routes.
 *
 * On Vercel, variables from Project → Settings → Environment Variables are
 * injected into `process.env` at build and runtime (same keys you use locally).
 * Locally, Next.js loads `.env`, `.env.local`, etc. into the same `process.env`.
 * There is no runtime “fetch from Vercel”; precedence is: first non-empty value
 * among the listed keys (put your Vercel primary name first, optional local-only
 * aliases after, e.g. `WCL_TOKEN_LOCAL` only in `.env.local`).
 */

function usable(value: string | undefined): value is string {
  if (value == null) return false
  const t = value.trim()
  if (!t) return false
  if (t === 'paste_your_wcl_token_here') return false
  return true
}

/** First defined, non-placeholder value among `primary` then `aliases`. */
export function serverEnv(primary: string, ...aliases: string[]): string | undefined {
  for (const key of [primary, ...aliases]) {
    const v = process.env[key]
    if (usable(v)) return v.trim()
  }
  return undefined
}

export function wclToken(): string | undefined {
  return serverEnv('WCL_TOKEN', 'WCL_TOKEN_LOCAL', 'WARCRAFTLOGS_TOKEN')
}

export function anthropicApiKey(): string | undefined {
  const k = serverEnv('ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY_LOCAL', 'ANTHROPIC_KEY')
  if (k && k.includes('paste_your_key')) return undefined
  return k
}

export function blizzardClientId(): string | undefined {
  return serverEnv('BLIZZARD_CLIENT_ID', 'BLIZZARD_CLIENT_ID_LOCAL')
}

export function blizzardClientSecret(): string | undefined {
  return serverEnv('BLIZZARD_CLIENT_SECRET', 'BLIZZARD_CLIENT_SECRET_LOCAL')
}
