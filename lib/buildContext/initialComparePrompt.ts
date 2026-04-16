import { initialUserPromptEvidenceDiscipline } from './evidenceRules'

/** First user message for compare-mode Claude (same text as post-load auto-run). */

export type InitialComparePromptArgs = {
  name1: string
  name2: string
  spec1: string
  isKill1: boolean
  isKill2: boolean
  simcGrounded: boolean
}

export function buildInitialCompareUserPrompt(args: InitialComparePromptArgs): string {
  const { name1, name2, spec1, isKill1, isKill2, simcGrounded } = args
  const simcUserLine = simcGrounded
    ? `\n\n**Analysis mode:** I enabled **SimulationCraft default APL** comparison — use it with the log to show where my play diverges from those sim priorities when the evidence supports it.\n`
    : ''
  const wipeBlock =
    !isKill1 || !isKill2
      ? `NOTE: ${[!isKill1 && `${name1}'s fight is a wipe`, !isKill2 && `${name2}'s fight is a wipe`].filter(Boolean).join(', ')}. Account for this — the fight ended early so late-phase cooldown usage and fight-end DPS patterns are not available. Focus on opener, early rotation, and mid-fight decisions.\n\n`
      : ''
  return (
    `Analyze the fight data and respond in two parts:\n\n` +
    `**Part 1 — Priority Summary**\n` +
    `Give me a numbered list of the top 5 most impactful changes ${name1} should make, ordered by DPS impact. For each one, give a one-line description of what to change and why it matters. Keep this section tight — no more than 2 sentences per item.\n\n` +
    `**Part 2 — Full Analysis**\n` +
    `Go deep on each of the 5 items above. For each one:\n` +
    `- What exactly is happening in the data (with specific numbers and timestamps)\n` +
    `- The mechanical reason WHY it costs DPS\n` +
    `- Exactly WHEN and HOW to make the decision differently\n\n` +
    wipeBlock +
    `Link every spell name to Wowhead using this format: [Spell Name](https://www.wowhead.com/spell=SPELL_ID)\n` +
    `Use the spell IDs from the data. Both players are ${spec1} spec.` +
    initialUserPromptEvidenceDiscipline +
    simcUserLine
  )
}

export type InitialSoloPromptArgs = {
  playerName: string
  spec: string
  isKill: boolean
  simcGrounded: boolean
}

/** Full default user message for solo “full coaching read” (matches compare depth: Part 1 + Part 2, wipes, SimC opt-in line). */
export function buildInitialSoloUserPrompt(args: InitialSoloPromptArgs): string {
  const { playerName, spec, isKill, simcGrounded } = args
  const simcUserLine = simcGrounded
    ? `\n\n**Analysis mode:** I turned on **SimulationCraft default APL** in your context — use it as optional guidance where fight assumptions match this pull; otherwise prioritize what the log shows.\n`
    : ''
  const wipeBlock = !isKill
    ? `NOTE: This pull was a **wipe** — late-phase data is missing from the log. Focus on opener through whatever mid-fight window is present; do not infer full-fight pacing or end-of-fight cooldown usage.\n\n`
    : ''
  return (
    `Analyze my pull for **${playerName}** (${spec}) using the fight data already in your context.\n\n` +
    `**Part 1 — Priority summary**\n` +
    `Give me a numbered list of the **top 5** highest-impact improvements I should make, ordered by impact (DPS and/or survivability as the log supports). For each: one tight line — what to change and why it matters (no more than ~2 sentences per item).\n\n` +
    `**Part 2 — Full breakdown**\n` +
    `Go deep on each of those five. For each one:\n` +
    `- What exactly the **log** shows (spell counts, timestamps, buff/debuff windows, crit/spacing, damage taken, downtime — cite specifics)\n` +
    `- The **mechanical** reason it costs throughput or survivability\n` +
    `- **Next pull:** what to practice or watch for (concrete cues)\n\n` +
    wipeBlock +
    `Link every spell name to Wowhead using this format: [Spell Name](https://www.wowhead.com/spell=SPELL_ID)\n` +
    `Use ### headers. Stay grounded in this pull only — there is no second player in this session.` +
    initialUserPromptEvidenceDiscipline +
    simcUserLine
  )
}
