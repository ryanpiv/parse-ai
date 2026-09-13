/**
 * Anthropic model id used by every AI call (JSON + streaming). Sonnet 4.6 is a
 * pinned snapshot id (the 4.6 generation uses dateless ids per Anthropic's
 * naming convention) and provides a 1M-token context window, which matters for
 * the SimC + Wowhead preset that ships a large grounded-reference system prompt.
 */
export const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
