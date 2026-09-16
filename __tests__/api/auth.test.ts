import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '../../pages/api/auth'

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

function mockReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
    return { method: 'GET', body: {}, query: {}, headers: {}, ...overrides } as NextApiRequest
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
        delete process.env.WCL_CLIENT_ID
        delete process.env.WCL_CLIENT_SECRET
    })

    it('GET returns clientId:null when the server is not configured', async () => {
        const res = mockRes()
        await handler(mockReq(), res)
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({ clientId: null })
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('GET returns the public client id when configured (no secret required — PKCE clients)', async () => {
        process.env.WCL_CLIENT_ID = 'client-123'
        const res = mockRes()
        await handler(mockReq(), res)
        expect(res.json).toHaveBeenCalledWith({ clientId: 'client-123' })
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('POST user-exchange works for a public/PKCE client (id only, no secret sent)', async () => {
        process.env.WCL_CLIENT_ID = 'client-123'

        // 1st fetch: code exchange; 2nd: currentUser name lookup
        mockFetch.mockResolvedValueOnce({
            json: async () => ({ access_token: 'user-token-789', expires_in: 1209600 }),
        } as Response)
        mockFetch.mockResolvedValueOnce({
            json: async () => ({ data: { userData: { currentUser: { name: 'Smaktat' } } } }),
        } as Response)

        const res = mockRes()
        await handler(
            mockReq({
                method: 'POST',
                body: {
                    action: 'user-exchange',
                    code: 'auth-code',
                    verifier: 'pkce-verifier',
                    redirectUri: 'http://localhost:3000/auth/callback',
                },
            }),
            res,
        )

        expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            'https://www.warcraftlogs.com/oauth/token',
            expect.objectContaining({ method: 'POST' }),
        )
        const body = String((mockFetch.mock.calls[0][1] as RequestInit).body)
        expect(body).toContain('grant_type=authorization_code')
        expect(body).toContain('client_id=client-123')
        expect(body).toContain('code_verifier=pkce-verifier')
        expect(body).not.toContain('client_secret')
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            token: 'user-token-789',
            expiresIn: 1209600,
            userName: 'Smaktat',
        })
    })

    it('POST user-exchange includes the secret when the client is confidential', async () => {
        process.env.WCL_CLIENT_ID = 'client-123'
        process.env.WCL_CLIENT_SECRET = 'secret-456'
        mockFetch.mockResolvedValueOnce({
            json: async () => ({ access_token: 't', expires_in: 3600 }),
        } as Response)
        mockFetch.mockResolvedValueOnce({ json: async () => ({}) } as Response)

        const res = mockRes()
        await handler(
            mockReq({
                method: 'POST',
                body: { action: 'user-exchange', code: 'c', verifier: 'v', redirectUri: 'r' },
            }),
            res,
        )
        const body = String((mockFetch.mock.calls[0][1] as RequestInit).body)
        expect(body).toContain('client_secret=secret-456')
        expect(res.status).toHaveBeenCalledWith(200)
    })

    it('POST user-exchange fails cleanly without server credentials', async () => {
        const res = mockRes()
        await handler(
            mockReq({ method: 'POST', body: { action: 'user-exchange', code: 'c', redirectUri: 'r' } }),
            res,
        )
        expect(res.status).toHaveBeenCalledWith(400)
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects unsupported methods', async () => {
        const res = mockRes()
        await handler(mockReq({ method: 'DELETE' }), res)
        expect(res.status).toHaveBeenCalledWith(405)
    })
})
