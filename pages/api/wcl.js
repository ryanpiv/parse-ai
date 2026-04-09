export default async function handler(req, res) {
  // GET = health check / token test
  if (req.method === 'GET') {
    const token = process.env.WCL_TOKEN
    if (!token || token === 'paste_your_wcl_token_here') {
      return res.status(500).json({ error: 'WCL_TOKEN not set in .env.local' })
    }
    try {
      const response = await fetch('https://www.warcraftlogs.com/api/v2/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query: '{ rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn } }' }),
      })
      const text = await response.text()
      if (!response.ok) return res.status(response.status).json({ error: `WCL returned ${response.status}`, body: text.slice(0, 300) })
      try {
        const data = JSON.parse(text)
        return res.status(200).json({ ok: true, rateLimit: data?.data?.rateLimitData })
      } catch {
        return res.status(500).json({ error: 'WCL returned non-JSON — token likely expired', body: text.slice(0, 300) })
      }
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.WCL_TOKEN
  if (!token || token === 'paste_your_wcl_token_here') {
    return res.status(500).json({ error: 'WCL_TOKEN not set in .env.local' })
  }

  try {
    const response = await fetch('https://www.warcraftlogs.com/api/v2/client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(req.body),
    })

    const text = await response.text()
    if (!response.ok) {
      return res.status(response.status).json({ error: `WCL returned ${response.status}`, body: text.slice(0, 300) })
    }
    try {
      const data = JSON.parse(text)
      return res.status(200).json(data)
    } catch {
      return res.status(500).json({ error: 'WCL returned non-JSON — token likely expired. Get a new token from parse-analyzer-ai.html and update .env.local', body: text.slice(0, 300) })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
