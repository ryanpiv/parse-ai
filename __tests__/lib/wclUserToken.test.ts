/**
 * @jest-environment jsdom
 */

const STORAGE_KEY = 'parse-analyzer-wcl-user'

const HOUR = 60 * 60 * 1000

function seed(user: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

function stored(): any {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

/** Fresh module per test — refresh dedupe/cooldown state is module-scoped. */
async function loadModule() {
  let mod: typeof import('../../lib/wclUserToken')
  jest.resetModules()
  await jest.isolateModulesAsync(async () => {
    mod = await import('../../lib/wclUserToken')
  })
  return mod!
}

describe('ensureFreshWclUser', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = jest.fn()
  })

  it('returns null when signed out', async () => {
    const { ensureFreshWclUser } = await loadModule()
    expect(await ensureFreshWclUser()).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns the stored user untouched when far from expiry', async () => {
    seed({ token: 't1', expiresAt: Date.now() + 48 * HOUR, refreshToken: 'r1' })
    const { ensureFreshWclUser } = await loadModule()
    const u = await ensureFreshWclUser()
    expect(u?.token).toBe('t1')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('renews an expired token and rotates the refresh token', async () => {
    seed({ token: 'old', expiresAt: Date.now() - HOUR, userName: 'Ryan', refreshToken: 'r1' })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new', expiresIn: 3600, refreshToken: 'r2' }),
    })
    const { ensureFreshWclUser } = await loadModule()
    const u = await ensureFreshWclUser()
    expect(u?.token).toBe('new')
    expect(u?.userName).toBe('Ryan')
    expect(u?.refreshToken).toBe('r2')
    expect(stored().token).toBe('new')
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body).toEqual({ action: 'user-refresh', refreshToken: 'r1' })
  })

  it('keeps the old refresh token when the exchange returns none', async () => {
    seed({ token: 'old', expiresAt: Date.now() - HOUR, refreshToken: 'r1' })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new', expiresIn: 3600 }),
    })
    const { ensureFreshWclUser } = await loadModule()
    const u = await ensureFreshWclUser()
    expect(u?.refreshToken).toBe('r1')
  })

  it('dedupes concurrent refresh calls into one exchange', async () => {
    seed({ token: 'old', expiresAt: Date.now() - HOUR, refreshToken: 'r1' })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new', expiresIn: 3600, refreshToken: 'r2' }),
    })
    const { ensureFreshWclUser } = await loadModule()
    const [a, b] = await Promise.all([ensureFreshWclUser(), ensureFreshWclUser()])
    expect(a?.token).toBe('new')
    expect(b?.token).toBe('new')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('signs out when the refresh token is rejected after expiry', async () => {
    seed({ token: 'old', expiresAt: Date.now() - HOUR, refreshToken: 'r1' })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
    })
    const { ensureFreshWclUser } = await loadModule()
    expect(await ensureFreshWclUser()).toBeNull()
    expect(stored()).toBeNull()
  })

  it('keeps a still-valid token but drops the rejected refresh token', async () => {
    // Within the 6h refresh margin but not yet expired.
    seed({ token: 'ok', expiresAt: Date.now() + HOUR, refreshToken: 'r1' })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
    })
    const { ensureFreshWclUser } = await loadModule()
    const u = await ensureFreshWclUser()
    expect(u?.token).toBe('ok')
    expect(stored().refreshToken).toBeUndefined()
  })

  it('leaves storage alone on network errors and keeps a valid token', async () => {
    seed({ token: 'ok', expiresAt: Date.now() + HOUR, refreshToken: 'r1' })
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('offline'))
    const { ensureFreshWclUser } = await loadModule()
    const u = await ensureFreshWclUser()
    expect(u?.token).toBe('ok')
    expect(stored().refreshToken).toBe('r1')
  })

  it('backs off after a failed attempt instead of hammering the endpoint', async () => {
    seed({ token: 'ok', expiresAt: Date.now() + HOUR, refreshToken: 'r1' })
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('offline'))
    const { ensureFreshWclUser } = await loadModule()
    await ensureFreshWclUser()
    await ensureFreshWclUser()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('signs out an expired user with no refresh token', async () => {
    seed({ token: 'old', expiresAt: Date.now() - HOUR })
    const { ensureFreshWclUser } = await loadModule()
    expect(await ensureFreshWclUser()).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
