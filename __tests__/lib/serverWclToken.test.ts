import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { getWclToken, _resetWclTokenCache } from '../../lib/serverWclToken'

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

describe('getWclToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    _resetWclTokenCache()
    delete process.env.WCL_CLIENT_ID
    delete process.env.WCL_CLIENT_SECRET
    delete process.env.WCL_TOKEN
  })

  it('returns undefined when nothing is configured', async () => {
    expect(await getWclToken()).toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns the static WCL_TOKEN when no client credentials are set', async () => {
    process.env.WCL_TOKEN = 'static-token'
    expect(await getWclToken()).toBe('static-token')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('exchanges client credentials once and caches the token', async () => {
    process.env.WCL_CLIENT_ID = 'id'
    process.env.WCL_CLIENT_SECRET = 'secret'
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ access_token: 'cc-token', expires_in: 3600 }),
    } as Response)

    expect(await getWclToken()).toBe('cc-token')
    expect(await getWclToken()).toBe('cc-token')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const init = mockFetch.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('id:secret').toString('base64')}`
    )
    expect(String(init.body)).toContain('grant_type=client_credentials')
  })

  it('falls back to static WCL_TOKEN when the exchange fails', async () => {
    process.env.WCL_CLIENT_ID = 'id'
    process.env.WCL_CLIENT_SECRET = 'secret'
    process.env.WCL_TOKEN = 'static-fallback'
    mockFetch.mockResolvedValue({ status: 401, json: async () => ({ error: 'nope' }) } as Response)

    expect(await getWclToken()).toBe('static-fallback')
  })
})
