import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../pages/api/ai'

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

function mockReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return { method: 'POST', body: { model: 'claude-sonnet-4-20250514', messages: [] }, ...overrides } as NextApiRequest
}

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as NextApiResponse & { status: jest.Mock; json: jest.Mock }
}

describe('/api/ai', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
  })

  it('rejects non-POST requests', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 500 when API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = mockRes()
    await handler(mockReq(), res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('ANTHROPIC_API_KEY') }))
  })

  it('forwards request to Anthropic and returns response', async () => {
    const anthropicResponse = { content: [{ text: 'Hello' }] }
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => anthropicResponse } as Response)

    const res = mockRes()
    await handler(mockReq(), res)

    expect(mockFetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-api-key': 'sk-test-key' }),
    }))
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(anthropicResponse)
  })

  it('returns 500 on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const res = mockRes()
    await handler(mockReq(), res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Network error' })
  })
})
