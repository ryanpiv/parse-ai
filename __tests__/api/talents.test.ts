import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../pages/api/talents'

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

function mockReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return { method: 'POST', body: { nodeIDs: [90269, 90270, 92536] }, ...overrides } as NextApiRequest
}

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as NextApiResponse & { status: jest.Mock; json: jest.Mock }
}

describe('/api/talents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.WCL_TOKEN = 'test-token'
  })

  it('GET returns empty nodeMap for backwards compat', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ nodeMap: {} })
  })

  it('rejects non-GET/POST methods', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'DELETE' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 when nodeIDs is empty', async () => {
    const res = mockRes()
    await handler(mockReq({ body: { nodeIDs: [] } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 500 when WCL_TOKEN is missing', async () => {
    delete process.env.WCL_TOKEN
    const res = mockRes()
    await handler(mockReq(), res)
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('batch-resolves nodeIDs via WCL ability API', async () => {
    const wclResponse = {
      data: {
        gameData: {
          n0: { id: 1459, name: 'Arcane Intellect', icon: 'spell_holy_magicalsentry' },
          n1: { id: 116011, name: 'Rune of Power', icon: 'spell_mage_runeofpower' },
          n2: { id: 30455, name: 'Ice Lance', icon: 'spell_frost_frostblast' },
        },
      },
    }
    mockFetch.mockResolvedValueOnce({ json: async () => wclResponse } as Response)

    const res = mockRes()
    await handler(mockReq(), res)

    expect(mockFetch).toHaveBeenCalledWith('https://www.warcraftlogs.com/api/v2/client', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Authorization': 'Bearer test-token' }),
    }))
    expect(res.status).toHaveBeenCalledWith(200)

    const result = res.json.mock.calls[0][0] as { nodeMap: Record<string, unknown> }
    expect(Object.keys(result.nodeMap)).toHaveLength(3)
    expect(result.nodeMap[90269]).toEqual({
      spellId: 1459,
      name: 'Arcane Intellect',
      icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_magicalsentry',
    })
  })
})
