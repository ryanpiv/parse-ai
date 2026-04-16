/**
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

export const MAGE_FROST_DEFAULT_APL: string = "\n# This default action priority list is automatically created based on your character.\n# It is a attempt to provide you with a action list that is both simple and practicable,\n# while resulting in a meaningful and good simulation. It may not result in the absolutely highest possible dps.\n# Feel free to edit, adapt and improve it to your own needs.\n# SimulationCraft is always looking for updates and improvements to the default action lists.\n\n# Executed before combat begins. Accepts non-harmful actions only.\nactions.precombat=arcane_intellect\nactions.precombat+=/snapshot_stats\nactions.precombat+=/variable,name=target_swapping,op=reset,default=0\nactions.precombat+=/summon_water_elemental\n# Frostfire can open with a precast Blizzard against all target counts. Spellslinger AoE starts at 4+, but Blizzard is only cast with any of the Blizzard talents.\nactions.precombat+=/blizzard,if=talent.frostfire_bolt|active_enemies>=4&(talent.freezing_rain|talent.freezing_winds)\nactions.precombat+=/glacial_spike\nactions.precombat+=/frostbolt\n\n# Executed every time the actor is available.\nactions=call_action_list,name=cds\n# Frostfire AoE starts at 3+ targets.\nactions+=/run_action_list,name=ff_aoe,if=talent.frostfire_bolt&active_enemies>=3\nactions+=/run_action_list,name=ff_st,if=talent.frostfire_bolt\nactions+=/run_action_list,name=ss_tarswap,if=variable.target_swapping\n# Spellslinger AoE starts at 4+ targets\nactions+=/run_action_list,name=ss_aoe,if=active_enemies>=4\nactions+=/run_action_list,name=ss_st\n\n# Potion, Items and Racials are used on cd for Frostfire and paired with either Orb or Ray as Spellslinger.\nactions.cds=variable,name=ff_trinket_timing,value=talent.frostfire_bolt\nactions.cds+=/variable,name=ss_trinket_timing,value=talent.splinterstorm&(time=0|fight_remains<15|prev_gcd.1.frozen_orb|cooldown.ray_of_frost.charges>=1&debuff.freezing.react<6&!buff.fingers_of_frost.react&(icicles<3|time-action.potion.last_used<25))\n# Use Haste trinkets always after pot, Crit trinkets always before pot, and Mastery trinkets after pot if Crit is your highest stat and before pot otherwise.\nactions.cds+=/use_item,name=nevermelting_ice_crystal,if=variable.ff_trinket_timing|variable.ss_trinket_timing\nactions.cds+=/use_item,name=freightrunners_flask,if=variable.ff_trinket_timing|variable.ss_trinket_timing\nactions.cds+=/use_item,name=vaelgors_final_stare,if=(variable.ff_trinket_timing|variable.ss_trinket_timing)&(stat.haste_rating>stat.crit_rating|stat.versatility_rating>stat.crit_rating)\nactions.cds+=/potion,if=variable.ff_trinket_timing|variable.ss_trinket_timing|fight_remains<35\nactions.cds+=/use_item,name=vaelgors_final_stare,if=variable.ff_trinket_timing|variable.ss_trinket_timing\nactions.cds+=/use_items\nactions.cds+=/blood_fury,if=variable.ff_trinket_timing|variable.ss_trinket_timing\nactions.cds+=/berserking,if=variable.ff_trinket_timing|variable.ss_trinket_timing\nactions.cds+=/fireblood,if=variable.ff_trinket_timing|variable.ss_trinket_timing\nactions.cds+=/ancestral_call,if=variable.ff_trinket_timing|variable.ss_trinket_timing\n# Opener Frostfire\nactions.cds+=/flurry,if=talent.frostfire_bolt,line_cd=9999\nactions.cds+=/glacial_spike,if=talent.frostfire_bolt,line_cd=9999\nactions.cds+=/flurry,if=talent.frostfire_bolt,line_cd=9999\nactions.cds+=/ray_of_frost,if=talent.frostfire_bolt,line_cd=9999\nactions.cds+=/frozen_orb,if=talent.frostfire_bolt,line_cd=9999\n# Opener Spellslinger ST\nactions.cds+=/ice_lance,if=active_enemies<=3&talent.flash_freeze&talent.splinterstorm,line_cd=9999\nactions.cds+=/ray_of_frost,if=active_enemies<=3&talent.splinterstorm&!variable.target_swapping,line_cd=9999\nactions.cds+=/ray_of_frost,target_if=min:debuff.freezing.react,if=active_enemies<=3&talent.splinterstorm&variable.target_swapping,line_cd=9999\n# Opener Spellslinger AoE\nactions.cds+=/flurry,if=active_enemies>=4&talent.wintertide&talent.splinterstorm&!variable.target_swapping,line_cd=9999\nactions.cds+=/flurry,target_if=min:debuff.freezing.react,if=active_enemies>=4&talent.wintertide&talent.splinterstorm&variable.target_swapping,line_cd=9999\nactions.cds+=/frozen_orb,if=active_enemies>=4&talent.splinterstorm,line_cd=9999\nactions.cds+=/ray_of_frost,if=active_enemies>=4&talent.splinterstorm&!variable.target_swapping,line_cd=9999\nactions.cds+=/ray_of_frost,target_if=min:debuff.freezing.react,if=active_enemies>=4&talent.splinterstorm&variable.target_swapping,line_cd=9999\n# End-Of-Fight Actions\nactions.cds+=/ray_of_frost,if=fight_remains<12&!variable.target_swapping\nactions.cds+=/ray_of_frost,target_if=min:debuff.freezing.react,if=fight_remains<12&variable.target_swapping\n# Externals\nactions.cds+=/invoke_external_buff,name=power_infusion,if=buff.power_infusion.down\n\nactions.ff_aoe=blizzard,if=buff.freezing_rain.up\nactions.ff_aoe+=/flurry,if=buff.brain_freeze.react&buff.thermal_void.down\nactions.ff_aoe+=/frozen_orb\nactions.ff_aoe+=/glacial_spike\nactions.ff_aoe+=/comet_storm\nactions.ff_aoe+=/blizzard,if=active_enemies>=(5-talent.freezing_rain-talent.freezing_winds)&(cooldown.frozen_orb.remains>12*spell_haste|!talent.freezing_rain)\nactions.ff_aoe+=/ice_lance,if=buff.fingers_of_frost.react\nactions.ff_aoe+=/ice_lance,if=debuff.freezing.stack>=10\nactions.ff_aoe+=/flurry,if=cooldown_react\nactions.ff_aoe+=/ray_of_frost,if=!buff.frostfire_empowerment.react\nactions.ff_aoe+=/frostbolt\nactions.ff_aoe+=/call_action_list,name=movement\n\nactions.ff_st=flurry,if=buff.brain_freeze.react&buff.thermal_void.down\nactions.ff_st+=/frozen_orb\nactions.ff_st+=/glacial_spike\nactions.ff_st+=/comet_storm\nactions.ff_st+=/ice_lance,if=buff.fingers_of_frost.react\nactions.ff_st+=/ice_lance,if=debuff.freezing.stack>=10\nactions.ff_st+=/flurry,if=cooldown_react\nactions.ff_st+=/ray_of_frost,if=active_enemies=1|!buff.frostfire_empowerment.react\nactions.ff_st+=/frostbolt\nactions.ff_st+=/call_action_list,name=movement\n\nactions.movement=any_blink,if=movement.distance>5\nactions.movement+=/blizzard,if=buff.freezing_rain.up\nactions.movement+=/ice_nova,if=talent.cone_of_frost\nactions.movement+=/cone_of_cold,if=talent.cone_of_frost\nactions.movement+=/ice_lance\n\nactions.ss_aoe=comet_storm\nactions.ss_aoe+=/blizzard,if=buff.freezing_rain.up\nactions.ss_aoe+=/flurry,if=buff.brain_freeze.react&buff.thermal_void.down\nactions.ss_aoe+=/ice_lance,if=buff.fingers_of_frost.react=2\nactions.ss_aoe+=/frozen_orb\nactions.ss_aoe+=/glacial_spike\nactions.ss_aoe+=/ice_lance,if=buff.fingers_of_frost.react\nactions.ss_aoe+=/ice_lance,if=debuff.freezing.react>=6\nactions.ss_aoe+=/ice_nova,if=talent.cone_of_frost\nactions.ss_aoe+=/cone_of_cold,if=talent.cone_of_frost\nactions.ss_aoe+=/blizzard,if=talent.freezing_winds\nactions.ss_aoe+=/ray_of_frost,if=icicles<3|time-action.potion.last_used<25\nactions.ss_aoe+=/flurry,if=cooldown_react\nactions.ss_aoe+=/frostbolt\nactions.ss_aoe+=/call_action_list,name=movement\n\nactions.ss_st=comet_storm\nactions.ss_st+=/flurry,if=buff.brain_freeze.react&buff.thermal_void.down\nactions.ss_st+=/ice_lance,if=buff.fingers_of_frost.react=2\nactions.ss_st+=/frozen_orb\nactions.ss_st+=/glacial_spike\nactions.ss_st+=/ice_lance,if=buff.fingers_of_frost.react\nactions.ss_st+=/ice_lance,if=debuff.freezing.react>=6\nactions.ss_st+=/ray_of_frost,if=icicles<3|time-action.potion.last_used<25\nactions.ss_st+=/flurry,if=cooldown_react\nactions.ss_st+=/frostbolt\nactions.ss_st+=/call_action_list,name=movement\n\n# Played when the variable target_swapping=1. It's the ST/AoE rotation but always targets the enemy with the lowest Freezing stacks when casting a spell that generates Freezing.\nactions.ss_tarswap=comet_storm\nactions.ss_tarswap+=/blizzard,target_if=active_enemies>=4&buff.freezing_rain.up\nactions.ss_tarswap+=/flurry,target_if=min:debuff.freezing.react,if=buff.brain_freeze.react&buff.thermal_void.down\nactions.ss_tarswap+=/ice_lance,if=buff.fingers_of_frost.react=2\nactions.ss_tarswap+=/frozen_orb\nactions.ss_tarswap+=/glacial_spike,target_if=min:debuff.freezing.react\nactions.ss_tarswap+=/ice_lance,if=buff.fingers_of_frost.react\n# Against 2 targets, wait for both to have 6+ freezing stacks before casting IL. Against 3+ targets cast IL as soon as any one target has 6+ stacks.\nactions.ss_tarswap+=/ice_lance,target_if=min:debuff.freezing.react>=6,if=active_enemies<=2&debuff.freezing.react>=6\nactions.ss_tarswap+=/ice_lance,target_if=debuff.freezing.react>=6,if=active_enemies>=3\nactions.ss_tarswap+=/ice_nova,if=active_enemies>=4&talent.cone_of_frost\nactions.ss_tarswap+=/cone_of_cold,if=active_enemies>=4&talent.cone_of_frost\nactions.ss_tarswap+=/blizzard,if=active_enemies>=4&talent.freezing_winds\nactions.ss_tarswap+=/ray_of_frost,target_if=min:debuff.freezing.react,if=icicles<3|time-action.potion.last_used<25\nactions.ss_tarswap+=/flurry,target_if=min:debuff.freezing.react,if=cooldown_react\nactions.ss_tarswap+=/frostbolt,target_if=min:debuff.freezing.react\nactions.ss_tarswap+=/call_action_list,name=movement\n"

export function simcAplAvailableForSpec(specId: number | undefined | null): boolean {
  return specId === SIMC_FROST_MAGE_META.specId
}

export type SimcCoachingMode = 'compare' | 'solo'

/**
 * SimC APL text for prompts. When `grounded` is false, omit entirely (default analyze flow
 * stays log- and partner-first; no SimC block).
 */
export function getSimcAplSupplement(
  specId: number | undefined | null,
  grounded: boolean,
  playerName?: string,
  coachingMode: SimcCoachingMode = 'compare'
): string {
  if (!grounded || specId !== 64) return ''
  const b = SIMC_FROST_MAGE_META.branch
  const who = playerName?.trim() || 'the player seeking improvement'

  const header =
    coachingMode === 'solo'
      ? `=== SIMULATIONCRAFT — OPT-IN (SOLO COACHING) ===\n`
      : `=== SIMULATIONCRAFT — OPT-IN COMPARISON MODE ===\n`

  const bodyCompare =
    `The player **turned on** comparison against SimulationCraft's default Frost Mage APL (branch \`${b}\`). ` +
    `Use the APL below as a **primary** reference together with the combat log to find where ${who}'s casts, timing, or conditions ` +
    `diverge from what this default sim priority would suggest for similar talents and target counts.\n` +
    `Name clear divergences when the log supports them (e.g. "vs default SimC priority: …"). ` +
    `Still cite spell IDs and timestamps from the data. If SimC conditions clearly do not apply (movement, fight length, talents differ), say so.\n`

  const bodySolo =
    `The player **turned on** SimulationCraft's default Frost Mage APL (branch \`${b}\`) as an **optional heuristic**, not a Patchwerk verdict on this pull.\n\n` +
    `How to use it like an expert:\n` +
    `- **One log ≠ sim distribution.** Sims average many idealized pulls; this encounter is one RNG and mechanics sample — do not treat every APL difference as proof of a mistake.\n` +
    `- **Assumptions differ.** Default APLs simplify reality (target counts, movement, fight length, averaged procs). Boss scripts, adds, Bloodlust timing, or wipes can invalidate **literal** APL ordering without bad play.\n` +
    `- **Hypothesis then verify.** Use the APL to guess what might be efficient under *similar* conditions; then **confirm or reject** with buffs, timestamps, spacing/crit data, and encounter timing in this prompt. If sim conditions clearly do not apply, say so plainly rather than implying fault.\n` +
    `- **Opener / precombat** lines are **sim conventions** (scripted CDs, precombat actions). Many bosses need a different opener — judge the first ~20s against **this pull's** constraints, not a generic sim pull.\n\n` +
    `Still cite spell IDs and timestamps from the log for every concrete claim about ${who}.\n`

  const footer =
    `Upstream: ${SIMC_FROST_MAGE_META.upstreamUrl}\n` +
    `Spell names in the APL use SimC identifiers (e.g. frostbolt vs in-game capitalization).\n\n` +
    '<simc_apl>\n' +
    MAGE_FROST_DEFAULT_APL +
    '\n</simc_apl>\n\n'

  return header + (coachingMode === 'solo' ? bodySolo : bodyCompare) + footer
}
