import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { callAI, formatApiError, formatFetchError, formatLoadError, gql } from '../../lib/wclClient'

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

function jsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}): Response {
  const status = init.status ?? 200
  const ok = init.ok ?? (status >= 200 && status < 300)
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

describe('formatApiError', () => {
  it('returns plain strings unchanged', () => {
    expect(formatApiError('boom')).toBe('boom')
  })

  it('extracts message from Anthropic-style { type, message } objects', () => {
    expect(formatApiError({ type: 'invalid_request_error', message: 'prompt is too long' })).toBe(
      'invalid_request_error: prompt is too long'
    )
  })

  it('returns just message when no type is provided', () => {
    expect(formatApiError({ message: 'oops' })).toBe('oops')
  })

  it('falls back to JSON for unknown objects (never returns "[object Object]")', () => {
    const out = formatApiError({ weird: 1 })
    expect(out).not.toContain('[object Object]')
    expect(out).toContain('weird')
  })
})

describe('callAI error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws readable message when Anthropic returns { error: { type, message } } (regression: no more "[object Object]")', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        {
          type: 'error',
          error: { type: 'invalid_request_error', message: 'prompt is too long: 213567 tokens > 200000 maximum' },
        },
        { status: 400 }
      )
    )

    await expect(callAI([{ role: 'user', content: 'hi' }], 'system text')).rejects.toThrow(
      'invalid_request_error: prompt is too long: 213567 tokens > 200000 maximum'
    )
  })

  it('throws when response is non-2xx even without an `error` field', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ something: 'unexpected' }, { status: 502 }))
    await expect(callAI([], 'sys')).rejects.toThrow(/Anthropic API 502/)
  })

  it('returns text content on success', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ content: [{ text: 'hello' }] }))
    await expect(callAI([], 'sys')).resolves.toBe('hello')
  })
})

describe('gql error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('handles GraphQL `errors` array with object entries', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ errors: [{ message: 'rate limited' }] }))
    await expect(gql('{ x }')).rejects.toThrow('rate limited')
  })

  it('handles an object `error` field from the wrapper route', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: { type: 'upstream', message: 'WCL down' } }))
    await expect(gql('{ x }')).rejects.toThrow('upstream: WCL down')
  })

  it('maps Failed to fetch to a server-down message (never hangs)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(gql('{ x }')).rejects.toThrow(/Can't reach \/api\/wcl/)
  })
})

describe('formatFetchError / formatLoadError', () => {
  it('explains AbortError as a timeout', () => {
    const e = new Error('The operation was aborted')
    e.name = 'AbortError'
    expect(formatFetchError(e)).toMatch(/timed out/)
    expect(formatLoadError(e)).toMatch(/timed out/)
  })
})
