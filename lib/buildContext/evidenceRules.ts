/**
 * Class-agnostic coaching rules for Claude system prompts (compare + solo).
 * Reduces count/spacing-only “rotation guilt” and SimC overreach.
 */

export function coachingEvidenceRulesBlock(): string {
  return (
    `=== COACHING EVIDENCE (ALL SPECS) ===\n` +
    `These rules override generic rotation intuition when they conflict.\n` +
    `- Do **not** treat cast counts, casts/min, or same-spell **spacing** alone as proof of a misplay. High frequency or tight gaps can reflect correct burst, movement, target swaps, or valid procs.\n` +
    `- Before claiming the player **misused** a spell (too many / too few / wrong filler / “spam”), cite **cast-by-cast or buff/debuff context**: timestamps and, where present, active buffs/debuffs at those casts. If that state is not in the excerpts below, say **cannot determine from this context** instead of guessing.\n` +
    `- **SimulationCraft** (when included) is **hypothesis-only**: never let APL wording override **contradicting** log evidence; never imply fault without log support.\n` +
    `- Separate **observation** (what tables and lines show) from **verdict** (what to change). Only state a verdict as confident when cited lines support it.\n\n`
  )
}

/** Appended to default Part 1/2 user prompts so the model re-reads system evidence rules. */
export const initialUserPromptEvidenceDiscipline =
  '\n**Evidence discipline:** Follow the === COACHING EVIDENCE (ALL SPECS) === rules in your system context. In Part 2, every item must tie to specific timestamps or cast-by-cast lines (including buff snapshots where available). If you cannot cite them, say you cannot determine it rather than inferring a misplay.\n'
