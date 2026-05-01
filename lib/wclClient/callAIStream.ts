/** Stream Claude via `/api/ai` (SSE). Parses Anthropic messages SSE events. */

export type StreamedAIMessage = { role: string; content: string }

export type AIStreamUsage = { input_tokens: number; output_tokens: number }

function parseSseBlocks(buffer: string): { blocks: string[]; rest: string } {
  const blocks: string[] = []
  let rest = buffer
  while (true) {
    const idx = rest.indexOf('\n\n')
    if (idx === -1) break
    blocks.push(rest.slice(0, idx))
    rest = rest.slice(idx + 2)
  }
  return { blocks, rest }
}

function parseBlock(block: string): { eventType: string; dataJson: string } | null {
  let eventType = ''
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  const dataJson = dataLines.join('\n')
  if (!dataJson) return null
  return { eventType, dataJson }
}

/**
 * POST streaming request; invokes onText with accumulated assistant text per delta.
 * Returns final text and token usage (when Anthropic sends it).
 */
export async function callAIStream(
  messages: StreamedAIMessage[],
  system: string,
  opts: {
    onText: (accumulated: string) => void
    onUsage?: (partial: { input_tokens?: number; output_tokens?: number }) => void
    model?: string
    maxTokens?: number
  }
): Promise<{ text: string; usage?: AIStreamUsage }> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? 'claude-sonnet-4-20250514',
      max_tokens: opts.maxTokens ?? 2000,
      system,
      messages,
      stream: true,
    }),
  })

  const ctype = res.headers.get('content-type') || ''

  if (!res.ok) {
    const text = await res.text()
    let msg = text.slice(0, 500)
    try {
      const j = JSON.parse(text) as { error?: { message?: string }; message?: string }
      msg = j.error?.message || j.message || msg
    } catch {
      /* use raw */
    }
    throw new Error(msg || `AI request failed (${res.status})`)
  }

  if (!res.body) {
    throw new Error('AI response had no body')
  }

  if (!ctype.includes('text/event-stream')) {
    // Dev proxy or misconfig — try one-shot JSON
    try {
      const data = JSON.parse(await res.clone().text()) as {
        content?: Array<{ text?: string }>
        usage?: { input_tokens: number; output_tokens: number }
      }
      const t = data.content?.[0]?.text ?? ''
      opts.onText(t)
      return { text: t, usage: data.usage }
    } catch {
      throw new Error('Expected event stream from /api/ai')
    }
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let accumulated = ''
  let inputTokens = 0
  let outputTokens = 0

  const applyUsage = (u?: { input_tokens?: number; output_tokens?: number }) => {
    if (!u) return
    if (typeof u.input_tokens === 'number') {
      inputTokens = u.input_tokens
      opts.onUsage?.({ input_tokens: inputTokens })
    }
    if (typeof u.output_tokens === 'number') {
      outputTokens = u.output_tokens
      opts.onUsage?.({ output_tokens: outputTokens })
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })

    const { blocks, rest } = parseSseBlocks(buf)
    buf = rest

    for (const block of blocks) {
      const parsed = parseBlock(block)
      if (!parsed) continue
      let obj: { type?: string; error?: { message?: string }; message?: { usage?: AIStreamUsage }; delta?: { text?: string; type?: string }; usage?: AIStreamUsage }
      try {
        obj = JSON.parse(parsed.dataJson) as typeof obj
      } catch {
        continue
      }

      if ((parsed.eventType === 'error' || obj.type === 'error') && obj.error) {
        throw new Error(obj.error.message || 'Anthropic stream error')
      }

      if (obj.type === 'message_start' && obj.message?.usage) {
        applyUsage(obj.message.usage)
      }

      if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta' && typeof obj.delta.text === 'string') {
        accumulated += obj.delta.text
        opts.onText(accumulated)
      }

      if (obj.type === 'message_delta' && obj.usage) {
        applyUsage(obj.usage)
      }
    }
  }

  const usage =
    inputTokens > 0 || outputTokens > 0
      ? { input_tokens: inputTokens, output_tokens: outputTokens }
      : undefined

  return { text: accumulated, usage }
}
