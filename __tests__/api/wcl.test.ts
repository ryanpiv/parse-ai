import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../pages/api/wcl'

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

/** Report data requires the per-user token header — there is no shared fallback. */
function mockReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
    return {
        method: 'POST',
        headers: { 'x-wcl-user-token': 'user-token-abc' },
        body: { query: '{ reportData { report(code: "abc") { title } } }' },
        ...overrides,
    } as NextApiRequest
}

function mockRes() {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    }
    return res as unknown as NextApiResponse & { status: jest.Mock; json: jest.Mock }
}

describe('/api/wcl', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('rejects unsupported methods', async () => {
        const res = mockRes()
        await handler(mockReq({ method: 'DELETE' }), res)
        expect(res.status).toHaveBeenCalledWith(405)
    })

    it('returns 401 without a signed-in user token', async () => {
        const res = mockRes()
        await handler(mockReq({ headers: {} }), res)
        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('Sign in with WarcraftLogs') }),
        )
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('GET returns rate limit data on success', async () => {
        const wclResponse = {
            data: { rateLimitData: { limitPerHour: 3600, pointsSpentThisHour: 10, pointsResetIn: 1800 } },
        }
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify(wclResponse),
        } as Response)

        const res = mockRes()
        await handler(mockReq({ method: 'GET' }), res)
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({ ok: true, rateLimit: wclResponse.data.rateLimitData })
    })

    it('POST forwards GraphQL to the user endpoint with the user token', async () => {
        const wclData = { data: { reportData: { report: { title: 'Test Report' } } } }
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify(wclData),
        } as Response)

        const res = mockRes()
        await handler(mockReq(), res)

        expect(mockFetch).toHaveBeenCalledWith(
            'https://www.warcraftlogs.com/api/v2/user',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ Authorization: 'Bearer user-token-abc' }),
            }),
        )
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(wclData)
    })

    it('POST returns error when WCL returns non-JSON (expired token)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => '<html>Login required</html>',
        } as Response)

        const res = mockRes()
        await handler(mockReq(), res)
        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('non-JSON') }),
        )
    })
})
