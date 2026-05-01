/**
 * Preset chat prompts and quick-question grids for Claude.
 * Keep copy here so views map over data instead of duplicating long strings.
 */

/** Compare / solo quick grid — Part 1 + Part 2 review; tile is shorthand only. */
export const COMPARE_INITIAL_QUICK_LABEL = 'Full review: top 5 problems + log-backed why'

export const SOLO_INITIAL_QUICK_LABEL = 'Full review: top 5 problems + log-backed why'

/** Caption above Wowhead / Icy / Both in solo and compare ASK CLAUDE grids. */
export const ROTATION_GUIDE_CLUSTER_LABEL = 'Compare rotation to:'
/** Readable on dark bg — avoid var(--dim) here. */
export const ROTATION_GUIDE_CLUSTER_LABEL_COLOR = 'var(--muted)'

/** Evidence-first preset (compare + solo) — full message sent on click. */
export const PRESET_SHOW_YOUR_WORK =
  'Evidence-first: (1) Observations only, each with a timestamp or cast-by-cast quote from the data. (2) Hypotheses where evidence is thin — label each low confidence. (3) At most 3 actionable verdicts; each must reuse evidence from (1). Do not claim rotation mistakes from cast counts or same-spell spacing alone without buff/proc/stack/movement context. Use ### headers.'

/** Short tile for evidence-first preset (differs from full prompt). */
export const PRESET_SHOW_YOUR_WORK_LABEL = 'Evidence first: cite the log, then verdicts'

/** Compare casts to bundled SimulationCraft APL + Wowhead rotation/talent excerpts (Frost Mage when scraped data exists; SimC for all supported SimC specs). */
export const PRESET_CASTS_VS_SIMC_WOWHEAD =
  'Compare my casts in this fight to SimulationCraft default APL and Wowhead rotation / talent guide data. Cite log timestamps; say when SimC, Wowhead, or my talents disagree; do not treat either reference as a perfect encounter script.'

/** Short tile — sends a question; solo mode’s SimC context toggle is separate. */
export const PRESET_CASTS_VS_SIMC_WOWHEAD_LABEL = 'Ask: log casts vs SimC + Wowhead'

/** Compare: both players vs SimC APL (guides via rotation rows). */
export const PRESET_COMPARE_CASTS_VS_SIMC =
  "Compare BOTH players' cast sequences and counts in these logs to the SimulationCraft default APL for this spec. For each player, cite timestamps; note where each matches or diverges from sim priorities and whether the log context (movement, timing, fight length) explains it. Do not treat SimC as a perfect script for either pull."

export const PRESET_COMPARE_CASTS_VS_SIMC_LABEL = 'Ask: both players vs SimC APL'

export const PRESET_COMPARE_ROTATION_WOWHEAD =
  "Using the bundled Wowhead rotation/talent guide excerpts in context, compare BOTH players' actual rotations in these logs to that guide. Cite timestamps for each player; say where each aligns or drifts from the guide; do not treat the guide as a perfect encounter script."

export const PRESET_COMPARE_ROTATION_ICY =
  "Using the bundled Icy Veins rotation guide excerpts in context, compare BOTH players' actual rotations in these logs to that guide. Cite timestamps for each player; say where each aligns or drifts from the guide; do not treat the guide as a perfect encounter script."

export const PRESET_COMPARE_ROTATION_BOTH =
  "Using BOTH the bundled Wowhead and Icy Veins rotation excerpts in context (when present), compare BOTH players' actual rotations in these logs to those guides. Note where the two sites agree or conflict when both are in context; ground every claim in log evidence for each player."

/** Solo: one player vs bundled guide excerpts (matches compare row behavior). */
export const PRESET_SOLO_ROTATION_WOWHEAD =
  'Using the bundled Wowhead rotation/talent guide excerpts in context, compare my actual rotation in this log to that guide. Cite timestamps; say where I align or drift from the guide; do not treat the guide as a perfect encounter script.'

export const PRESET_SOLO_ROTATION_ICY =
  'Using the bundled Icy Veins rotation guide excerpts in context, compare my actual rotation in this log to that guide. Cite timestamps; say where I align or drift from the guide; do not treat the guide as a perfect encounter script.'

export const PRESET_SOLO_ROTATION_BOTH =
  'Using BOTH the bundled Wowhead and Icy Veins rotation excerpts in context (when present), compare my actual rotation in this log to those guides. Note where the two sites agree or conflict when both are in context; ground every claim in log evidence.'

export const PRESET_SHOW_YOUR_WORK_COMPARE =
  'Evidence-first for BOTH players: (1) Observations only for each player, each with a timestamp or cast-by-cast quote from the data. (2) Hypotheses where evidence is thin — label each low confidence. (3) At most 3 actionable verdicts for how I should close the gap vs the other player; each must reuse evidence from (1). Do not claim rotation mistakes from cast counts or same-spell spacing alone without buff/proc/stack/movement context. Use ### headers.'

/** Compare mode — second slot in top quick row (replaces SimC context toggle). Log-grounded only; no SimC / guide bundles unless another preset adds them. */
export const PRESET_COMPARE_TALENT_LOG_LABEL = 'Compare talent builds'

export const PRESET_COMPARE_TALENT_LOG =
  'Compare BOTH players’ talent choices for this spec using the talent diff already in system context. This answer must be about **this fight only**: ground every claim in the supplied extracts (casts, timelines, cooldowns, procs, relevant damage taken or deaths) — not in generic rotation guides or SimulationCraft.\n\n### Summary\nIn 2–4 sentences, name the 1–3 talent differences that most plausibly mattered **in this pull** for how the two performances diverged.\n\n### Each differing talent row\nFor every row where the two builds differ:\n- State what each player took. Keep class theory short; prioritize what shows up in the log.\n- **Evidence per player**: cite concrete moments (timestamps, short cast sequences, or resource/proc context) where that talent choice could explain a visible difference. If the log cannot support a link, say so plainly and lower confidence.\n- **Confidence**: tag each inference high / medium / low for a single pull.\n\n### Rules\n- Prefer log facts over speculation. Do not invent proc rules or interactions not supported by the data or ordinary spell behavior.\n- Do not lean on Wowhead, Icy Veins, or SimC APL text unless it is already in context because the user used a guide- or sim-specific preset in this thread.\n- Cast count or spacing alone is not enough to call a talent “wrong” without buff, movement, or encounter timing context from the log.\n\n### Limitations\nIf the pull was a wipe, very short, had uneven downtime, or one player’s sample is thin, explain what we cannot conclude and what would need another pull to validate.'

export type CompareQuickTopItem =
  | {
      kind: 'initial'
      label: string
      title: string
    }
  | {
      kind: 'preset'
      label: string
      prompt: string
      title: string
    }

export const COMPARE_TOP_QUICK_ITEMS: CompareQuickTopItem[] = [
  {
    kind: 'initial',
    label: COMPARE_INITIAL_QUICK_LABEL,
    title:
      'Sends the full default compare prompt (you vs other player, Part 1 + Part 2, wipes). Uses log + talent context only — not SimulationCraft APL unless you use the “Ask: both players vs SimC APL” or rotation-guide presets.',
  },
  {
    kind: 'preset',
    label: PRESET_COMPARE_TALENT_LOG_LABEL,
    prompt: PRESET_COMPARE_TALENT_LOG,
    title:
      'Asks Claude to contrast both players’ talent picks using the diff in context, tied to this fight’s log (casts, cooldowns, procs). Does not add SimC, Wowhead, or Icy Veins.',
  },
]

export type PresetPromptItem = string | { label: string; prompt: string }

export function resolvePresetPrompt(p: PresetPromptItem): { label: string; prompt: string } {
  return typeof p === 'string' ? { label: p, prompt: p } : p
}

export const PRESET_QUESTIONS_COMPARE: PresetPromptItem[] = [
  'How do our openers compare?',
  { label: PRESET_COMPARE_CASTS_VS_SIMC_LABEL, prompt: PRESET_COMPARE_CASTS_VS_SIMC },
  { label: PRESET_SHOW_YOUR_WORK_LABEL, prompt: PRESET_SHOW_YOUR_WORK_COMPARE },
  'Where does my rotation differ from the other player and why does it matter?',
  'Am I using procs as efficiently as the other player? Where am I falling behind?',
  'How do my cooldown usage and timing compare to the other player?',
  'When should I hold cooldowns for adds vs use them immediately — compared to what the other player did?',
  'What is the other player doing in their burst windows that I am not?',
  "How do my defensive and utility cooldowns compare to the other player's?",
  'How can I improve combo or priority execution vs the other player?',
  'What is driving my downtime vs the other player and how do I fix it?',
  'Give me a priority list of what to fix first to close the gap to the other player.',
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
