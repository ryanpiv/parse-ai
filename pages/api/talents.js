/**
 * /api/talents
 * Returns nodeID → { spellId, name, icon } mapping for a spec.
 * 
 * Strategy: use WCL's gameData.ability API which works perfectly for real WoW spell IDs.
 * We maintain a static nodeID→spellID map derived from the known talent trees.
 * Wowhead's talent calc page is a SPA and doesn't embed data in HTML.
 */

// Frost Mage (specID 71) nodeID → WoW spellID mapping
// nodeIDs from CombatantInfo talentTree, spellIDs from WoW talent data
// Class tree nodes (Mage shared) + Spec tree nodes (Frost) + Hero tree (Spellslinger/Frostfire)
const FROST_MAGE_NODES = {
  // ── Class tree (Mage) ──
  90269: 1459,   // Arcane Intellect
  90270: 116011, // Rune of Power / Spellsteal area
  90271: 2139,   // Counterspell
  90274: 235219, // Cold Front / Shimmer
  90276: 212653, // Shimmer
  90279: 80353,  // Time Warp
  90282: 110909, // Alter Time
  90283: 116014, // Temporal Shield / Arcane Familiar
  90285: 198111, // Temporal Flux
  90290: 55342,  // Mirror Image
  90292: 12042,  // Arcane Power / presence
  90293: 235450, // Prismatic Barrier
  90322: 110960, // Greater Invisibility
  90326: 235450, // Prismatic Barrier
  90327: 342246, // Alter Time (rank 2)
  90328: 198114, // Tome of Antonidas
  90331: 235711, // Temporal Warp
  90332: 198062, // Displacement
  90337: 31687,  // Summon Water Elemental
  90344: 236522, // Incanter's Flow
  90346: 205025, // Presence of Mind
  90347: 44425,  // Arcane Barrage
  90348: 30451,  // Arcane Blast
  90352: 153626, // Arcane Orb
  90353: 11129,  // Combustion (hero)
  90355: 116267, // Spellsteal
  90360: 236528, // Chronomatic Anomaly
  90366: 12654,  // Ignite
  90368: 543,    // Fire Ward
  90371: 1953,   // Blink
  90374: 108978, // Alter Time
  90375: 31661,  // Dragon's Breath
  90381: 235313, // Blazing Barrier
  90382: 235450, // Prismatic Barrier
  90385: 235219, // Cold Front
  90438: 190446, // Fingers of Frost
  90441: 205473, // Winter's Chill
  90445: 12472,  // Icy Veins
  90447: 44614,  // Flurry
  // ── Spec tree (Frost) ──
  92536: 30455,  // Ice Lance
  92537: 84714,  // Frozen Orb
  92615: 199786, // Glacial Spike
  94789: 228358, // Brain Freeze
  94793: 44572,  // Deep Freeze
  94794: 205021, // Ray of Frost
  94796: 257537, // Ebonbolt
  94799: 212792, // Splitting Ice
  94806: 235219, // Cold Front
  94811: 205473, // Winter's Chill
  94812: 236662, // Hailstones
  94815: 235236, // Freezing Rain
  94818: 382252, // Thermal Void
  94819: 281711, // Glacial Spike (rank 2)
  99853: 365265, // Slick Ice
  // ── Hero tree ──
  108543: 383972, // Spellslinger's Malice
  108544: 383970, // Spellfrost Teachings
  108686: 384682, // Splinterstorm
  108705: 384620, // Piercing Cold
  109391: 400640, // Controlled Instincts
  109682: 413983, // Frostfire Bolt (Midnight rework)
  109683: 414659, // Frostfire Infusion
  109685: 414660, // Thermal Void (Midnight)
  109686: 414680, // Excess Fire
  109687: 414658, // Excess Frost
  109812: 461288, // Spellslinger
  109813: 461275, // Splintering Orbs
  109814: 461457, // Volatile Magic
  110118: 461488, // Unerring Proficiency
  110119: 461490, // Arcane Soul
  110175: 461464, // Augury Abounds
  110176: 461466, // Leydrinker
  110407: 461462, // Signature Spell
}

const _cache = {}

export default async function handler(req, res) {
  const { class: cls = 'mage', spec = 'frost', wcl_token } = req.query
  const cacheKey = `${cls}-${spec}`

  if (_cache[cacheKey]) {
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json(_cache[cacheKey])
  }

  // Use static map for Frost Mage
  if (cls === 'mage' && spec === 'frost') {
    // Enrich with names/icons from WCL ability API
    const token = process.env.WCL_TOKEN
    const nodeMap = {}

    if (token) {
      // Batch lookup all spell IDs
      const spellIds = [...new Set(Object.values(FROST_MAGE_NODES))]
      const batches = []
      for (let i = 0; i < spellIds.length; i += 20) batches.push(spellIds.slice(i, i + 20))

      const spellData = {}
      for (const batch of batches) {
        try {
          const fields = batch.map((id, i) => `s${i}: ability(id: ${id}) { id name icon }`).join(' ')
          const r = await fetch('https://www.warcraftlogs.com/api/v2/client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ query: `{ gameData { ${fields} } }` })
          })
          const d = await r.json()
          batch.forEach((id, i) => {
            const ab = d?.data?.gameData?.[`s${i}`]
            if (ab?.name) spellData[id] = ab
          })
        } catch {}
      }

      // Build nodeMap
      Object.entries(FROST_MAGE_NODES).forEach(([nodeId, spellId]) => {
        const ab = spellData[spellId]
        nodeMap[nodeId] = {
          spellId,
          name: ab?.name || `Spell ${spellId}`,
          icon: ab?.icon ? `https://wow.zamimg.com/images/wow/icons/medium/${ab.icon}` : null,
        }
      })
    } else {
      // No token — return bare map, icons will load via tooltip API
      Object.entries(FROST_MAGE_NODES).forEach(([nodeId, spellId]) => {
        nodeMap[nodeId] = { spellId, name: `Spell ${spellId}`, icon: null }
      })
    }

    console.log(`[talents] Built ${Object.keys(nodeMap).length} node mappings for frost mage`)
    _cache[cacheKey] = { nodeMap }
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json({ nodeMap })
  }

  // For other specs — return empty for now, will expand later
  return res.status(200).json({ nodeMap: {} })
}
