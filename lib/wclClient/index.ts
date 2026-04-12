/** Parse JSON from a Next API route; HTML (404 page, proxy error) gives a clear message. */
export async function parseNextApiJson(res: Response, route: string): Promise<Record<string, any>> {
  const text = await res.text()
  const t = text.trim()
  if (t.startsWith('<') || t.startsWith('<!')) {
    throw new Error(
      `${route} returned a web page instead of JSON (status ${res.status}). ` +
        'Usually the API route is missing or the dev server is not running this app. ' +
        'Run `npm run dev` from the parse-analyzer repo and open http://localhost:3000 .'
    )
  }
  try {
    return JSON.parse(text) as Record<string, any>
  } catch {
    throw new Error(`${route} returned invalid JSON (status ${res.status}): ${text.slice(0, 160)}`)
  }
}

export async function gql(query: string, variables: Record<string, unknown> = {}): Promise<Record<string, any>> {
  const res = await fetch('/api/wcl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = await parseNextApiJson(res, '/api/wcl')
  if (data.errors) throw new Error(data.errors[0].message)
  if (data.error) throw new Error(data.error)
  return data.data
}

export async function callAI(messages: Array<{ role: string; content: string }>, system: string): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system, messages }),
  })
  const data = await parseNextApiJson(res, '/api/ai')
  if (data.error) throw new Error(data.error)
  return data.content?.[0]?.text || 'No response.'
}
