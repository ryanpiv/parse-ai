export async function gql(query: string, variables: Record<string, unknown> = {}): Promise<Record<string, any>> {
  const res = await fetch('/api/wcl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json()
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
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.content?.[0]?.text || 'No response.'
}
