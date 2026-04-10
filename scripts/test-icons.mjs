/**
 * test-icons.mjs
 * Run with: node scripts/test-icons.mjs
 *
 * Tests Wowhead icon fetching for a set of known Frost Mage spell IDs.
 * Simulates exactly what /api/tooltip does server-side.
 * Output shows which spell IDs resolve to icons and which fail.
 */

// No dataEnv param — dataEnv=11 causes 404 for most retail spells
const WOWHEAD_BASE = 'https://nether.wowhead.com/tooltip/spell'
const ZAMIMG_BASE  = 'https://wow.zamimg.com/images/wow/icons/medium'

// Known Frost Mage spells (nodeIDs from Blizzard tree) — mix of class + spec
const TEST_SPELLS = [
  { id: 116,    name: 'Frostbolt' },
  { id: 44614,  name: 'Flurry' },
  { id: 190356, name: 'Frozen Orb' },
  { id: 228358, name: "Winter's Chill" },
  { id: 12472,  name: 'Icy Veins' },
  { id: 31661,  name: 'Dragon\'s Breath' },
  { id: 235219, name: 'Cold Snap' },
  { id: 205021, name: 'Ray of Frost' },
  { id: 153595, name: 'Comet Storm' },
  { id: 198144, name: 'Ice Form' },
  { id: 414658, name: 'Frostfire Bolt' },
  { id: 257537, name: 'Ebonbolt' },
  // Some known-missing or passive IDs to test fallback:
  { id: 0,      name: '(zero id — should skip)' },
  { id: 999999, name: '(bogus id — should 404)' },
]

async function fetchIcon(spellId) {
  if (!spellId) return { ok: false, error: 'spellId is 0' }
  const url = `${WOWHEAD_BASE}/${spellId}`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const d = await r.json()
    const slug = d.icon || null
    return {
      ok: !!slug,
      icon: slug,
      name: d.name || null,
      imgUrl: slug ? `${ZAMIMG_BASE}/${slug}.jpg` : null,
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function verifyImageUrl(imgUrl) {
  if (!imgUrl) return false
  try {
    const r = await fetch(imgUrl, { method: 'HEAD' })
    return r.ok
  } catch {
    return false
  }
}

console.log('Testing Wowhead icon fetching...\n')

const results = await Promise.all(
  TEST_SPELLS.map(async ({ id, name: testName }) => {
    const result = await fetchIcon(id)
    const imgOk = result.imgUrl ? await verifyImageUrl(result.imgUrl) : false
    return { spellId: id, testName, ...result, imgOk }
  })
)

// Print results table
console.log(
  ['spellId', 'name', 'icon slug', 'img ok', 'error']
    .map(h => h.padEnd(20)).join('| ')
)
console.log('-'.repeat(100))
for (const r of results) {
  const row = [
    String(r.spellId).padEnd(20),
    (r.name || r.testName || '').slice(0, 18).padEnd(20),
    (r.icon || '').slice(0, 28).padEnd(20),
    String(r.imgOk).padEnd(20),
    (r.error || '').slice(0, 30),
  ]
  console.log(row.join('| '))
}

const passed = results.filter(r => r.ok && r.imgOk).length
const total  = results.filter(r => r.spellId > 0 && r.spellId < 900000).length
console.log(`\nResult: ${passed}/${total} valid spells returned a working icon image`)
if (passed < total) {
  console.log('\nFailed:')
  results.filter(r => !r.ok || !r.imgOk).filter(r => r.spellId > 0 && r.spellId < 900000)
    .forEach(r => console.log(`  ${r.spellId} (${r.testName}): ${r.error || 'icon slug ok but image 404'}` ))
}
