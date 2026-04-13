import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const simcPath = path.join(root, 'knowledge/simc/mage_frost.midnight.simc')
const outPath = path.join(root, 'lib/knowledge/embeddedSimc.ts')

const simc = fs.readFileSync(simcPath, 'utf8')
const aplLiteral = JSON.stringify(simc)

const src = `/**
 * Default Frost Mage APL from SimulationCraft (bundled for Claude). Source file:
 * knowledge/simc/mage_frost.midnight.simc — regenerate: node scripts/embed-simc-frost.mjs
 * Upstream:
 * https://raw.githubusercontent.com/simulationcraft/simc/midnight/ActionPriorityLists/default/mage_frost.simc
 * License: SimulationCraft is GPL-3.0 (see upstream COPYING).
 */

export const SIMC_FROST_MAGE_META = {
  specId: 64,
  branch: 'midnight',
  upstreamPath: 'ActionPriorityLists/default/mage_frost.simc',
  upstreamUrl:
    'https://github.com/simulationcraft/simc/blob/midnight/ActionPriorityLists/default/mage_frost.simc',
  rawUrl:
    'https://raw.githubusercontent.com/simulationcraft/simc/midnight/ActionPriorityLists/default/mage_frost.simc',
} as const

export const MAGE_FROST_DEFAULT_APL: string = ${aplLiteral}

export function simcAplAvailableForSpec(specId: number | undefined | null): boolean {
  return specId === SIMC_FROST_MAGE_META.specId
}

/**
 * SimC APL text for prompts. When \`grounded\` is false, omit entirely (default analyze flow
 * stays log- and partner-first; no SimC block).
 */
export function getSimcAplSupplement(
  specId: number | undefined | null,
  grounded: boolean,
  playerName?: string
): string {
  if (!grounded || specId !== 64) return ''
  const b = SIMC_FROST_MAGE_META.branch
  const who = playerName?.trim() || 'the player seeking improvement'
  return (
    \`=== SIMULATIONCRAFT — OPT-IN COMPARISON MODE ===\\n\` +
    \`The player **turned on** comparison against SimulationCraft's default Frost Mage APL (branch \\\`\${b}\\\`). \` +
    \`Use the APL below as a **primary** reference together with the combat log to find where \${who}'s casts, timing, or conditions \` +
    \`diverge from what this default sim priority would suggest for similar talents and target counts.\\n\` +
    \`Name clear divergences when the log supports them (e.g. "vs default SimC priority: …"). \` +
    \`Still cite spell IDs and timestamps from the data. If SimC conditions clearly do not apply (movement, fight length, talents differ), say so.\\n\` +
    \`Upstream: \${SIMC_FROST_MAGE_META.upstreamUrl}\\n\` +
    \`Spell names in the APL use SimC identifiers (e.g. frostbolt vs in-game capitalization).\\n\\n\` +
    '<simc_apl>\\n' +
    MAGE_FROST_DEFAULT_APL +
    '\\n</simc_apl>\\n\\n'
  )
}
`

fs.writeFileSync(outPath, src)
console.log('Wrote', outPath)
