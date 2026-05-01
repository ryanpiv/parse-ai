/**
 * Embeds vendored knowledge/simc/*.midnight.simc files into lib/knowledge/embeddedSimc.ts
 * as string constants. Run after updating any .simc mirror from SimulationCraft midnight.
 *
 *   npm run embed-simc
 *
 * License: bundled APL text is from SimulationCraft (GPL-3.0).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

/** Order must match export const order in embeddedSimc.ts */
const BUNDLES = [
  { constName: 'MAGE_ARCANE_DEFAULT_APL', file: 'knowledge/simc/mage_arcane.midnight.simc' },
  { constName: 'MAGE_FIRE_DEFAULT_APL', file: 'knowledge/simc/mage_fire.midnight.simc' },
  { constName: 'MAGE_FROST_DEFAULT_APL', file: 'knowledge/simc/mage_frost.midnight.simc' },
  { constName: 'DEATH_KNIGHT_BLOOD_DEFAULT_APL', file: 'knowledge/simc/deathknight_blood.midnight.simc' },
  { constName: 'DEATH_KNIGHT_FROST_DEFAULT_APL', file: 'knowledge/simc/deathknight_frost.midnight.simc' },
  { constName: 'DEATH_KNIGHT_UNHOLY_DEFAULT_APL', file: 'knowledge/simc/deathknight_unholy.midnight.simc' },
]

const outPath = path.join(root, 'lib/knowledge/embeddedSimc.ts')

let content = fs.readFileSync(outPath, 'utf8')
content = content.replace(/\r\n/g, '\n')

for (const { constName, file } of BUNDLES) {
  const fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath)) {
    console.error(`embed-simc: missing ${fullPath}`)
    process.exit(1)
  }
  const simc = fs.readFileSync(fullPath, 'utf8')
  const aplLiteral = JSON.stringify(simc)
  const aplExportLine = `export const ${constName}: string = ${aplLiteral}`
  const re = new RegExp(
    `export const ${constName}: string = [\\s\\S]*?(?=\\n\\n(?:export const|const ))`,
    'm'
  )
  if (!re.test(content)) {
    console.error(`embed-simc: could not find export block for ${constName} in embeddedSimc.ts`)
    process.exit(1)
  }
  content = content.replace(re, aplExportLine)
}

fs.writeFileSync(outPath, content.endsWith('\n') ? content : content + '\n')
console.log(`embed-simc: updated ${BUNDLES.length} APL constants → ${path.relative(root, outPath)}`)
