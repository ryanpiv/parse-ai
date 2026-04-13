import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../pages/api/tooltip'

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

function mockReq(query: Record<string, string> = {}): NextApiRequest {
  return { method: 'GET', query } as unknown as NextApiRequest
}

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  }
  return res as unknown as NextApiResponse & { status: jest.Mock; json: jest.Mock; setHeader: jest.Mock }
}

describe('/api/tooltip', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 when id is missing', async () => {
    const res = mockRes()
    await handler(mockReq(), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('fetches spell tooltip from Wowhead and returns data', async () => {
    const tooltipData = { name: 'Test Spell', icon: 'spell_nature_lightning', tooltip: '<div>...</div>' }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => tooltipData } as Response)

    const res = mockRes()
    await handler(mockReq({ id: '30455' }), res)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://nether.wowhead.com/tooltip/spell/30455',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        }),
      }),
    )
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(tooltipData)
  })

  it('supports talent type parameter', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)

    const res = mockRes()
    await handler(mockReq({ id: '12345', type: 'talent' }), res)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://nether.wowhead.com/tooltip/talent/12345',
      expect.anything(),
    )
  })

  it('returns upstream error status on Wowhead failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as Response)

    const res = mockRes()
    await handler(mockReq({ id: '99999' }), res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
