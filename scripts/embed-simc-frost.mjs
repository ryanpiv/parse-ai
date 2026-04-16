import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const simcPath = path.join(root, 'knowledge/simc/mage_frost.midnight.simc')
const outPath = path.join(root, 'lib/knowledge/embeddedSimc.ts')

const simc = fs.readFileSync(simcPath, 'utf8')
const aplLiteral = JSON.stringify(simc)

const aplExportLine = `export const MAGE_FROST_DEFAULT_APL: string = ${aplLiteral}`

if (fs.existsSync(outPath)) {
  const prev = fs.readFileSync(outPath, 'utf8')
  const re =
    /export const MAGE_FROST_DEFAULT_APL: string = [\s\S]*?\n\nexport function simcAplAvailableForSpec/
  if (!re.test(prev)) {
    console.error(
      'embed-simc-frost: could not find MAGE_FROST_DEFAULT_APL block to replace; edit embeddedSimc.ts manually or restore from git.'
    )
    process.exit(1)
  }
  const next = prev.replace(
    re,
    `${aplExportLine}\n\nexport function simcAplAvailableForSpec`
  )
  fs.writeFileSync(outPath, next)
  console.log('Updated APL constant in', outPath)
} else {
  console.error('embed-simc-frost:', outPath, 'missing; create lib/knowledge/embeddedSimc.ts from the repo first.')
  process.exit(1)
}
