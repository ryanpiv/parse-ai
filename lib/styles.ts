import type { CSSProperties } from 'react'

export const s: Record<string, CSSProperties> = {
  wrap:     { maxWidth: 1200, margin: '0 auto', padding: '24px 20px' },
  hdr:      { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 22 },
  logo:     { fontFamily: 'Rajdhani,sans-serif', fontSize: 23, fontWeight: 700, letterSpacing: 2, color: 'var(--gold2)' },
  logoSub:  { fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: 'var(--dim)', marginTop: 1 },
  badge:    { fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, padding: '3px 8px', borderRadius: 3, border: '1px solid rgba(168,85,247,.3)', background: 'rgba(168,85,247,.08)', color: 'var(--purple)' },
  panel:    { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px 18px', marginBottom: 12 },
  ptitle:   { fontFamily: 'Rajdhani,sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 },
  ptitleBar: { width: 3, height: 12, background: 'var(--gold)', borderRadius: 2, flexShrink: 0 },
  field:    { display: 'flex', flexDirection: 'column', gap: 4 },
  label:    { fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--dim)' },
  input:    { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '7px 10px', fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, outline: 'none', width: '100%' },
  btnGold:  { fontFamily: 'Rajdhani,sans-serif', fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', padding: '9px 22px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#0a0c0f', whiteSpace: 'nowrap' },
  btnGoldDis: { fontFamily: 'Rajdhani,sans-serif', fontWeight: 600, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', padding: '9px 22px', borderRadius: 4, border: 'none', cursor: 'not-allowed', background: 'var(--golddim)', color: 'var(--dim)', whiteSpace: 'nowrap' },
  btnGhost: { fontFamily: 'Rajdhani,sans-serif', fontWeight: 600, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', padding: '6px 14px', borderRadius: 3, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--dim)', whiteSpace: 'nowrap' },
  note:     { fontSize: 11, color: 'var(--dim)', fontFamily: 'IBM Plex Mono,monospace', marginTop: 8, lineHeight: 1.7 },
  alertInfo: { fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, padding: '9px 12px', borderRadius: 4, marginTop: 8, lineHeight: 1.7, background: 'var(--bluedim)', color: 'var(--blue)', border: '1px solid #1e4a70' },
  alertErr: { fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, padding: '9px 12px', borderRadius: 4, marginTop: 8, lineHeight: 1.7, background: '#3a1010', color: 'var(--red)', border: '1px solid #5a2020' },
  alertOk:  { fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, padding: '9px 12px', borderRadius: 4, marginTop: 8, lineHeight: 1.7, background: '#102a18', color: 'var(--green)', border: '1px solid #1a4a28' },
}

/** Compare / solo quick grid — Part 1 + Part 2 review; tile is shorthand only. */
export const COMPARE_INITIAL_QUICK_LABEL =
  'Full review: top 5 problems + log-backed why'

export const SOLO_INITIAL_QUICK_LABEL =
  'Full review: top 5 problems + log-backed why'

/** Evidence-first preset (compare + solo) — full message sent on click. */
export const PRESET_SHOW_YOUR_WORK =
  'Evidence-first: (1) Observations only, each with a timestamp or cast-by-cast quote from the data. (2) Hypotheses where evidence is thin — label each low confidence. (3) At most 3 actionable verdicts; each must reuse evidence from (1). Do not claim rotation mistakes from cast counts or same-spell spacing alone without buff/proc/stack/movement context. Use ### headers.'

/** Short tile for evidence-first preset (differs from full prompt). */
export const PRESET_SHOW_YOUR_WORK_LABEL = 'Evidence first: cite the log, then verdicts'

/** Compare casts to bundled SimulationCraft APL + Wowhead rotation/talent excerpts (Frost Mage when scraped data exists; SimC for all supported SimC specs). */
export const PRESET_CASTS_VS_SIMC_WOWHEAD =
  'Compare my casts in this fight to SimulationCraft default APL and Wowhead rotation / talent guide data. Cite log timestamps; say when SimC, Wowhead, or my talents disagree; do not treat either reference as a perfect encounter script.'

/** Short tile — sends a question; second grid control is the SimC context toggle, not this. */
export const PRESET_CASTS_VS_SIMC_WOWHEAD_LABEL = 'Ask: log casts vs SimC + Wowhead'

export type PresetPromptItem = string | { label: string; prompt: string }

export function resolvePresetPrompt(p: PresetPromptItem): { label: string; prompt: string } {
  return typeof p === 'string' ? { label: p, prompt: p } : p
}

export const PRESET_QUESTIONS: PresetPromptItem[] = [
  'How is my opener?',
  { label: PRESET_CASTS_VS_SIMC_WOWHEAD_LABEL, prompt: PRESET_CASTS_VS_SIMC_WOWHEAD },
  { label: PRESET_SHOW_YOUR_WORK_LABEL, prompt: PRESET_SHOW_YOUR_WORK },
  'Where is my rotation different and why does it matter?',
  'Am I using my procs efficiently? Where am I wasting procs?',
  'How should I be aligning my cooldowns for maximum burst?',
  'When should I hold cooldowns for adds vs use them immediately?',
  'What is the comparison player doing in their burst windows that I am not?',
  'Am I using my defensive or utility cooldowns at the right times?',
  'How can I improve my combo or priority execution?',
  'What is causing my downtime and how do I fix it?',
  'Give me a priority list of exactly what to fix first.',
]

export const PRESET_QUESTIONS_SOLO: PresetPromptItem[] = [
  'How is my opener this pull?',
  { label: PRESET_CASTS_VS_SIMC_WOWHEAD_LABEL, prompt: PRESET_CASTS_VS_SIMC_WOWHEAD },
  { label: PRESET_SHOW_YOUR_WORK_LABEL, prompt: PRESET_SHOW_YOUR_WORK },
  'Using crit %, cast spacing, damage taken, downtime, and add death times from this extract, what are the 2–3 strongest play signals in this pull — and what is probably just variance?',
  'Where am I mistiming globals around movement, add spawns, or burst windows (use npc deaths and timelines, not same-spell spacing alone)?',
  'Given my total damage taken in this log, what mistakes or missing defensives stand out?',
  'How should I line up my major cooldowns with this encounter’s timeline (add spawns / deaths in the log)?',
  'Am I wasting procs or letting buffs fall off without spending them?',
  'What is driving my downtime and what is one concrete way to press more globals?',
  'What one thing should I improve that would be most impactful for this pull?',
]
