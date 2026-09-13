/** Parse JSON from a Next API route; HTML (404 page, proxy error) gives a clear message. */
import { anthropicClientHeaders } from '../anthropicUserKey'
import { wclClientHeaders } from '../wclUserToken'
import { ANTHROPIC_MODEL } from './anthropicModel'

export async function parseNextApiJson(res: Response, route: string): Promise<Record<string, any>> {
  const text = await res.text()
  const t = text.trim()
  if (t.startsWith('<') || t.startsWith('<!')) {
    throw new Error(
      `${route} returned a web page instead of JSON (status ${res.status}). ` +
        'Usually the API route is missing or the dev server is not running this app. ' +
        'Run `npm run dev` from the parse-analyzer repo and open http://localhost:3000 .'
    )
  }
  try {
    return JSON.parse(text) as Record<string, any>
  } catch {
    throw new Error(`${route} returned invalid JSON (status ${res.status}): ${text.slice(0, 160)}`)
  }
}

/**
 * Normalize an error payload from an upstream API into a readable string.
 * Handles plain strings, Anthropic's `{ type, message }` shape, and unknown objects
 * (so we never surface "[object Object]" in the chat UI).
 */
export function formatApiError(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const obj = e as { type?: unknown; message?: unknown }
    if (typeof obj.message === 'string' && obj.message.length > 0) {
      return typeof obj.type === 'string' && obj.type.length > 0
        ? `${obj.type}: ${obj.message}`
        : obj.message
    }
    try {
      return JSON.stringify(e).slice(0, 400)
    } catch {
      return String(e)
    }
  }
  return String(e)
}

/** How long a WCL proxy call may hang before we surface a timeout (ms). */
export const WCL_FETCH_TIMEOUT_MS = 60_000

function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

/** Network / timeout failures talking to this app's `/api/wcl` (not WCL GraphQL errors). */
export function formatFetchError(e: unknown, route = '/api/wcl'): string {
  const name = e instanceof Error ? e.name : ''
  const msg = e instanceof Error ? e.message : String(e)
  if (name === 'AbortError' || name === 'TimeoutError' || /aborted|timed out/i.test(msg)) {
    return (
      `${route} timed out after ${Math.round(WCL_FETCH_TIMEOUT_MS / 1000)}s. ` +
      'Warcraft Logs may be slow, or this app is not running. Restart with `npm run dev` and open http://localhost:3000 .'
    )
  }
  if (/failed to fetch|networkerror|load failed|econnrefused/i.test(msg)) {
    return (
      `Can't reach ${route} (the parse-ai server). ` +
      'The Load button will spin forever if Next.js is down. Run `npm run dev` in this repo and try again.'
    )
  }
  return formatApiError(e)
}

/** User-facing Load/fight-fetch error (never "[object Object]"). */
export function formatLoadError(e: unknown): string {
  if (e instanceof Error) {
    if (
      e.name === 'AbortError' ||
      e.name === 'TimeoutError' ||
      /failed to fetch|timed out|can't reach/i.test(e.message)
    ) {
      return formatFetchError(e)
    }
    return e.message || 'Unknown error'
  }
  return formatApiError(e)
}

export async function gql(query: string, variables: Record<string, unknown> = {}): Promise<Record<string, any>> {
  let res: Response
  try {
    res = await fetch('/api/wcl', {
      method: 'POST',
      headers: wclClientHeaders(),
      body: JSON.stringify({ query, variables }),
      signal: abortAfter(WCL_FETCH_TIMEOUT_MS),
    })
  } catch (e) {
    throw new Error(formatFetchError(e, '/api/wcl'))
  }
  const data = await parseNextApiJson(res, '/api/wcl')
  if (data.errors) throw new Error(formatApiError(data.errors[0]))
  if (data.error) throw new Error(formatApiError(data.error))
  return data.data
}

export { ANTHROPIC_MODEL } from './anthropicModel'

export async function callAI(messages: Array<{ role: string; content: string }>, system: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: anthropicClientHeaders(),
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 2000, system, messages }),
  })
  const data = await parseNextApiJson(res, '/api/ai')
  if (data.error) throw new Error(formatApiError(data.error))
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return data.content?.[0]?.text || 'No response.'
}

export { callAIStream, type AIStreamUsage } from './callAIStream'
