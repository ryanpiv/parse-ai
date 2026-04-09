export default async function handler(req, res) {
  const { id, type = 'spell' } = req.query
  if (!id) return res.status(400).json({ error: 'id required' })

  const url = `https://nether.wowhead.com/tooltip/${type}/${id}?dataEnv=11&locale=0`

  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } })
    if (!r.ok) return res.status(r.status).json({ error: `Wowhead returned ${r.status}` })
    const data = await r.json()
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
