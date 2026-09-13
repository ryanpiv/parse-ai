import { describe, it, expect } from '@jest/globals'
import { looksLikeAnthropicKey, maskAnthropicKey } from '../../lib/anthropicUserKey'

describe('looksLikeAnthropicKey', () => {
  it('accepts Console keys', () => {
    expect(looksLikeAnthropicKey('sk-ant-api03-abcdefghijklmnopqrstuv')).toBe(true)
  })

  it('rejects empty and non-Anthropic strings', () => {
    expect(looksLikeAnthropicKey('')).toBe(false)
    expect(looksLikeAnthropicKey('sk-openai-12345678901234567890')).toBe(false)
  })
})

describe('maskAnthropicKey', () => {
  it('keeps prefix and last four', () => {
    expect(maskAnthropicKey('sk-ant-api03-abcdefghijkl')).toBe('sk-ant-…ijkl')
  })
})
