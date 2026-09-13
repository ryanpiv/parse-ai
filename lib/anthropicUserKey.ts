/** Browser-only Claude Console API key. Never persist this on the server. */

export const ANTHROPIC_KEY_STORAGE = 'parse-analyzer-anthropic-api-key'

export function looksLikeAnthropicKey(raw: string): boolean {
  const t = raw.trim()
  return t.startsWith('sk-ant-') && t.length >= 24
}

export function readAnthropicUserKey(): string {
  if (typeof window === 'undefined') return ''
  try {
    return (localStorage.getItem(ANTHROPIC_KEY_STORAGE) || '').trim()
  } catch {
    return ''
  }
}

export function writeAnthropicUserKey(raw: string): void {
  if (typeof window === 'undefined') return
  const t = raw.trim()
  try {
    if (!t) localStorage.removeItem(ANTHROPIC_KEY_STORAGE)
    else localStorage.setItem(ANTHROPIC_KEY_STORAGE, t)
  } catch {
    /* ignore quota / private mode */
  }
}

export function maskAnthropicKey(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (t.length < 8) return '••••'
  return `${t.slice(0, 7)}…${t.slice(-4)}`
}

/** Headers for `/api/ai`. User key is sent only from the browser. */
export function anthropicClientHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const k = readAnthropicUserKey()
  if (k) headers['x-anthropic-api-key'] = k
  return headers
}
