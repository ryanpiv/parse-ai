import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../pages/api/auth'

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('WCL_TOKEN=old_token\nANTHROPIC_API_KEY=sk-test'),
  writeFileSync: jest.fn(),
}))

function mockReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return { method: 'GET', body: {}, query: {}, ...overrides } as NextApiRequest
}

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as NextApiResponse & { status: jest.Mock; json: jest.Mock }
}

describe('/api/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.WCL_TOKEN = 'valid-token'
  })

  it('GET returns authenticated:false when no token', async () => {
    delete process.env.WCL_TOKEN
    const res = mockRes()
    await handler(mockReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ authenticated: false })
  })

  it('GET returns authenticated:true when WCL responds with rate limit data', async () => {
    mockFetch.mockResolvedValueOnce({
      text: async () => JSON.stringify({ data: { rateLimitData: { limitPerHour: 3600 } } }),
    } as Response)

    const res = mockRes()
    await handler(mockReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ authenticated: true })
  })

  it('GET returns authenticated:false with reason when token is invalid', async () => {
    mockFetch.mockResolvedValueOnce({
      text: async () => JSON.stringify({ errors: [{ message: 'Unauthenticated' }] }),
    } as Response)

    const res = mockRes()
    await handler(mockReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ authenticated: false, reason: 'invalid_token' })
  })

  it('POST exchange forwards code and stores token', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ access_token: 'new-token-123' }),
    } as Response)

    const res = mockRes()
    await handler(mockReq({
      method: 'POST',
      body: { action: 'exchange', code: 'auth-code', verifier: 'pkce-verifier', clientId: 'client-123' },
    }), res)

    expect(mockFetch).toHaveBeenCalledWith('https://www.warcraftlogs.com/oauth/token', expect.objectContaining({
      method: 'POST',
    }))
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
    expect(process.env.WCL_TOKEN).toBe('new-token-123')
  })

  it('POST exchange returns error when token exchange fails', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ error_description: 'Invalid grant' }),
    } as Response)

    const res = mockRes()
    await handler(mockReq({
      method: 'POST',
      body: { action: 'exchange', code: 'bad-code', verifier: 'v', clientId: 'c' },
    }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid grant' })
  })

  it('rejects unsupported methods', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'DELETE' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
