import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Return current auth status
    const token = process.env.WCL_TOKEN
    if (!token || token === 'paste_your_wcl_token_here') {
      return res.status(200).json({ authenticated: false })
    }
    // Quick validation ping
    try {
      const r = await fetch('https://www.warcraftlogs.com/api/v2/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query: '{ rateLimitData { limitPerHour } }' }),
      })
      const text = await r.text()
      try {
        const data = JSON.parse(text)
        if (data.data?.rateLimitData) return res.status(200).json({ authenticated: true })
        return res.status(200).json({ authenticated: false, reason: 'invalid_token' })
      } catch {
        return res.status(200).json({ authenticated: false, reason: 'token_expired' })
      }
    } catch (e) {
      return res.status(200).json({ authenticated: false, reason: e.message })
    }
  }

  if (req.method === 'POST') {
    const { action, code, verifier, clientId } = req.body

    if (action === 'exchange') {
      // Exchange PKCE code for token server-side
      try {
        const response = await fetch('https://www.warcraftlogs.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code,
            redirect_uri: 'http://localhost:3000/auth/callback',
            code_verifier: verifier,
          }).toString(),
        })

        const data = await response.json()
        if (!data.access_token) {
          return res.status(400).json({ error: data.error_description || 'Token exchange failed' })
        }

        // Save token to .env.local
        const envPath = path.join(process.cwd(), '.env.local')
        let envContent = ''
        try {
          envContent = fs.readFileSync(envPath, 'utf8')
        } catch {
          envContent = ''
        }

        // Replace or add WCL_TOKEN
        if (envContent.includes('WCL_TOKEN=')) {
          envContent = envContent.replace(/WCL_TOKEN=.*/m, `WCL_TOKEN=${data.access_token}`)
        } else {
          envContent += `\nWCL_TOKEN=${data.access_token}`
        }
        fs.writeFileSync(envPath, envContent)

        // Also set it in current process so it works without restart
        process.env.WCL_TOKEN = data.access_token

        return res.status(200).json({ ok: true })
      } catch (e) {
        return res.status(500).json({ error: e.message })
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
