import { describe, it, expect } from '@jest/globals'
import { extractSpellCooldownMs } from '../../../lib/cooldownSpells/extractSpellCooldown'

describe('extractSpellCooldownMs', () => {
  it('reads nested cooldown.value', () => {
    expect(extractSpellCooldownMs({ cooldown: { value: 120000 } })).toBe(120000)
  })

  it('returns null when missing', () => {
    expect(extractSpellCooldownMs({ name: 'Foo' })).toBe(null)
    expect(extractSpellCooldownMs(null)).toBe(null)
  })
})
