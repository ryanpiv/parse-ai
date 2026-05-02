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
  note:     { fontSize: 11, color: 'var(--dim)', fontFamily: 'IBM Plex Mono,monospace', marginTop: 8, lineHeight: 1.7 },
  alertInfo: { fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, padding: '9px 12px', borderRadius: 4, marginTop: 8, lineHeight: 1.7, background: 'var(--bluedim)', color: 'var(--blue)', border: '1px solid #1e4a70' },
  alertErr: { fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, padding: '9px 12px', borderRadius: 4, marginTop: 8, lineHeight: 1.7, background: '#3a1010', color: 'var(--red)', border: '1px solid #5a2020' },
  alertOk:  { fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, padding: '9px 12px', borderRadius: 4, marginTop: 8, lineHeight: 1.7, background: '#102a18', color: 'var(--green)', border: '1px solid #1a4a28' },
}

/** Global utility class names — rules in `styles/globals.css` (`.pa-*`). */
export const pa = {
  viewTab: 'pa-view-tab',
  viewTabActive: 'pa-view-tab--active',
  viewTabSub: 'pa-view-tab__sub',
  btnGhost: 'pa-btn-ghost',
  btnGhostSm: 'pa-btn-ghost--sm',
  btnGhostLink: 'pa-btn-ghost--link',
  btnGhostPrimaryRow: 'pa-btn-ghost--primary-row',
  btnGold: 'pa-btn-gold',
  quickTile: 'pa-quick-tile',
  quickTileActive: 'pa-quick-tile--active',
  quickTileUnavailable: 'pa-quick-tile--unavailable',
  guideChip: 'pa-guide-chip',
  collapsibleTrigger: 'pa-collapsible-trigger',
  collapsibleTriggerChev: 'pa-collapsible-trigger__chev',
  btnCopy: 'pa-btn-copy',
  btnCopyCopied: 'pa-btn-copy--copied',
  btnTimeline: 'pa-btn-timeline',
  rosterPick: 'pa-roster-pick',
  rosterPickActive: 'pa-roster-pick--active',
  appNavTabs: 'pa-app-nav-tabs',
  appNavTabsSpacer: 'pa-app-nav-tabs-spacer',
  btnGhostViewBar: 'pa-btn-ghost--view-bar',
} as const

export * from './prompts/chatPresets'
