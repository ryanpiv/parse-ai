import { useState } from 'react'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { useAppSession } from '../../contexts/AppSessionContext'
import { gql } from '../../lib/wclClient'
import { parseTalentStringHeader } from '../../lib/talents/decodeTalentString'
import { talentDataToP1RowsJson } from '../../lib/talents/p1TalentTreeSession'
import {
  confirmTalentPlayer,
  loadTalentsFromWclUrl,
  type TalentLoadPick,
} from '../../lib/talents/loadTalentsFromWclUrl'
import { pa, s } from '../../lib/styles'
import type { FightPlayerRow } from '../../lib/wclFightPlayers'

export function TalentSourceForm() {
  const fa = useFightAnalysis()
  const { patchSession } = useAppSession()
  const [stringDraft, setStringDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [pick, setPick] = useState<TalentLoadPick | null>(null)

  function applyLoaded(name: string, specId: number, talentString: string, talentTree: unknown[]) {
    let sid = specId
    if (!sid && talentString) {
      try {
        sid = parseTalentStringHeader(talentString).specId
      } catch {
        /* keep 0 */
      }
    }
    patchSession({
      compareStr1: talentString,
      specId: sid || null,
      p1TalentTreeJson: talentDataToP1RowsJson(talentTree),
      compareName1: name,
    })
    setOk(`${name}${sid ? ` · spec ${sid}` : ''} loaded`)
    setPick(null)
  }

  async function applyString() {
    setError(null)
    setOk(null)
    const trimmed = stringDraft.trim()
    if (!trimmed) {
      setError('Paste a talent export string, or load a report from the Warcraft Logs URL above.')
      return
    }
    try {
      const header = parseTalentStringHeader(trimmed)
      patchSession({
        compareStr1: trimmed,
        specId: header.specId,
        p1TalentTreeJson: '',
        compareName1: 'Export',
      })
      setOk(`Export string applied · spec ${header.specId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid talent string.')
    }
  }

  async function loadFromUrl() {
    setError(null)
    setOk(null)
    const url = fa.compareUrl.trim()
    if (!url) {
      setError('Paste a Warcraft Logs report or compare URL in the Warcraft Logs box above, then Load talents.')
      return
    }
    setBusy(true)
    try {
      const result = await loadTalentsFromWclUrl(url, gql)
      if (result.kind === 'pick-player') {
        setPick(result)
        setOk(null)
        return
      }
      applyLoaded(result.name, result.specId, result.talentString, result.talentTree)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load talents from that URL.')
    } finally {
      setBusy(false)
    }
  }

  async function pickPlayer(p: FightPlayerRow) {
    if (!pick) return
    setBusy(true)
    setError(null)
    try {
      const result = await confirmTalentPlayer(gql, pick, p.id, p.name)
      applyLoaded(result.name, result.specId, result.talentString, result.talentTree)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load that character.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...s.panel, marginBottom: 16 }}>
      <div style={s.ptitle}>
        <div style={s.ptitleBar} />
        Load talents
      </div>
      <p style={{ ...s.note, marginTop: 0, marginBottom: 12 }}>
        Paste an export string (<code>/etl</code>, Wowhead, Raidbots) or use the report URL in the Warcraft Logs bar
        (single report with <code>?fight=</code>, or a compare URL — player 1).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12 }}>
        <div style={s.field}>
          <label style={s.label}>Talent export string</label>
          <textarea
            style={{ ...s.input, resize: 'vertical', minHeight: 56 }}
            rows={2}
            value={stringDraft}
            onChange={e => setStringDraft(e.target.value)}
            placeholder="Paste talent export string…"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className={pa.btnGold} disabled={busy} onClick={() => void applyString()}>
            Apply string
          </button>
          <button
            type="button"
            className={`${pa.btnGhost} ${pa.btnGhostPrimaryRow}`}
            disabled={busy || !fa.compareUrl.trim()}
            onClick={() => void loadFromUrl()}
          >
            {busy ? 'Loading…' : 'Load talents from URL'}
          </button>
        </div>
      </div>
      {pick && pick.players.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...s.label, marginBottom: 8 }}>Select character</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pick.players.map(p => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => void pickPlayer(p)}
                className={pa.rosterPick}
                title={`${p.role} · ${p.className}`}
              >
                {p.iconUrl ? (
                  <img src={p.iconUrl} alt="" width={24} height={24} style={{ borderRadius: 3, flexShrink: 0 }} />
                ) : (
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 3,
                      background: 'var(--bg4)',
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                )}
                <span>
                  <span style={{ color: 'var(--gold2)', fontWeight: 600 }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                    {p.specLabel}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <div style={s.alertErr}>{error}</div>}
      {ok && <div style={s.alertOk}>{ok}</div>}
    </div>
  )
}
