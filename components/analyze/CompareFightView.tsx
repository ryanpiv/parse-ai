import { useEffect, useMemo, useRef } from 'react'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { simcAplAvailableForSpec } from '../../lib/knowledge/embeddedSimc'
import { TalentCompare } from '../TalentCompare'
import { SpellUsageChart, CastTimelineChart, ProcEfficiencyChart, CooldownTimelineChart, ChartCard } from '../Charts'
import { SpellTimeline, type SpellTimelineGroup } from '../Charts/SpellTimeline'
import { FormatAI, CopyBtn } from '../AIChat'
import { CollapsibleSection } from '../CollapsibleSection'
import { s, PRESET_QUESTIONS, COMPARE_INITIAL_QUICK_LABEL, resolvePresetPrompt } from '../../lib/styles'

export function CompareFightView() {
  const fa = useFightAnalysis()
  const {
    p1data,
    p2data,
    spellRows,
    talentDiff,
    messagesCompare,
    inputCompare,
    setInputCompare,
    aiLoading,
    simcCompareEnabled,
    setSimcCompareEnabled,
    autoRunCompareAiAfterLoad,
    setAutoRunCompareAiAfterLoad,
    startInitialCompareAnalysis,
    bossName,
    fightKill1,
    fightKill2,
    sendCompareQuestion,
    downloadDataCompare,
  } = fa

  const chatRef = useRef<HTMLDivElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = chatRef.current
    if (!el || !lastUserMsgRef.current) return
    const msgTop = lastUserMsgRef.current.offsetTop
    el.scrollTo({ top: Math.max(0, msgTop - 12), behavior: aiLoading ? 'smooth' : 'auto' })
  }, [messagesCompare, aiLoading])

  const dur1Fmt = p1data ? `${Math.floor(p1data.dur / 60)}:${String(Math.round(p1data.dur % 60)).padStart(2, '0')}` : ''
  const dur2Fmt = p2data ? `${Math.floor(p2data.dur / 60)}:${String(Math.round(p2data.dur % 60)).padStart(2, '0')}` : ''

  const spellTimelineGroups: SpellTimelineGroup[] = useMemo(() => {
    if (!p1data || !p2data) return []
    const ids = new Set<number>()
    for (const seg of p1data.castTimeline || []) ids.add(seg.spellId)
    for (const seg of p2data.castTimeline || []) ids.add(seg.spellId)
    const resolveName = (spellId: number) =>
      p1data.spellMap[String(spellId)]?.name ||
      p2data.spellMap[String(spellId)]?.name ||
      p1data.nameMap[spellId] ||
      `Spell ${spellId}`

    return [...ids]
      .map(spellId => ({
        spellId,
        name: resolveName(spellId),
        segments1: (p1data.castTimeline || []).filter(s => s.spellId === spellId),
        segments2: (p2data.castTimeline || []).filter(s => s.spellId === spellId),
      }))
      .sort((a, b) => {
        const na = a.segments1.length + a.segments2.length
        const nb = b.segments1.length + b.segments2.length
        return nb - na
      })
      .slice(0, 22)
  }, [p1data, p2data])

  if (!p1data || !p2data) {
    return (
      <div style={s.panel}>
        <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Paste a Warcraft Logs compare URL above and click <strong style={{ color: 'var(--text)' }}>Load</strong> to see
          side-by-side stats, talents, and compare-mode chat.
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={s.panel}>
            <CollapsibleSection
              title={
                <>
                  <div style={s.ptitleBar} />
                  {bossName}
                </>
              }
              rightSlot={
                <button type="button" style={s.btnGhost} onClick={downloadDataCompare}>
                  Download Data
                </button>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { data: p1data, dur: dur1Fmt, color: 'var(--gold2)', label: 'you', isKill: fightKill1 },
                  { data: p2data, dur: dur2Fmt, color: 'var(--blue)', label: 'comparison', isKill: fightKill2 },
                ].map((p, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--bg3)',
                      border: `1px solid ${p.isKill ? 'var(--border)' : 'rgba(212,64,64,0.3)'}`,
                      borderRadius: 4,
                      padding: '10px 13px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'Rajdhani,sans-serif',
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '.8px',
                        textTransform: 'uppercase',
                        color: p.color,
                        marginBottom: 4,
                      }}
                    >
                      {p.data.name} — {p.label}
                      {!p.isKill && (
                        <span style={{ marginLeft: 8, color: 'var(--red)', fontSize: 9 }}>WIPE</span>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: 'Rajdhani,sans-serif',
                        fontSize: 22,
                        fontWeight: 700,
                        color: p.color,
                        lineHeight: 1.2,
                      }}
                    >
                      {p.data.dps?.toLocaleString() || '?'}{' '}
                      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--dim)' }}>dps</span>
                    </div>
                    <div
                      style={{
                        fontFamily: 'IBM Plex Mono,monospace',
                        fontSize: 11,
                        color: 'var(--dim)',
                        marginTop: 3,
                      }}
                    >
                      {p.dur} · {p.data.downtime.cpm}/min · {p.data.downtime.pct}% downtime · {p.data.spec}
                    </div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      {(() => {
                        const topBuffs = Object.entries(p.data.uptimes || {})
                          .map(([id, pct]) => ({
                            name: p.data.nameMap?.[Number(id)] || `Buff ${id}`,
                            pct: pct as number,
                          }))
                          .filter(b => b.pct > 0 && !b.name.startsWith('Buff '))
                          .sort((a, b) => b.pct - a.pct)
                          .slice(0, 3)
                        return topBuffs.length > 0 ? (
                          <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: 'var(--dim)' }}>
                            {topBuffs.map((b, bi) => (
                              <span key={bi}>
                                {bi > 0 && ' · '}
                                {b.name}: <span style={{ color: p.color }}>{b.pct}%</span>
                              </span>
                            ))}
                          </div>
                        ) : null
                      })()}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  fontFamily: 'Rajdhani,sans-serif',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '.8px',
                  textTransform: 'uppercase',
                  color: 'var(--dim)',
                  marginBottom: 6,
                }}
              >
                Spell breakdown — total casts
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {['Spell', p1data.name, p2data.name, 'Diff', 'First cast'].map((h, i) => (
                        <th
                          key={i}
                          style={{
                            fontFamily: 'Rajdhani,sans-serif',
                            fontSize: 10,
                            letterSpacing: '.8px',
                            textTransform: 'uppercase',
                            color: i === 1 ? 'var(--gold2)' : i === 2 ? 'var(--blue)' : 'var(--dim)',
                            padding: '5px 8px',
                            textAlign: i > 0 ? 'right' : 'left',
                            borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spellRows
                      .filter(r => r.count1 > 0 || r.count2 > 0)
                      .map((r, i) => {
                        const diff = r.count2 > 0 ? Math.round(((r.count1 - r.count2) / r.count2) * 100) : null
                        const dc =
                          diff === null ? 'var(--dim)' : diff > 5 ? 'var(--green)' : diff < -5 ? 'var(--red)' : 'var(--dim)'
                        const ft = r.first1 !== null && r.first2 !== null && Math.abs(r.first1 - r.first2) > 1.5
                        return (
                          <tr
                            key={i}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td
                              style={{
                                padding: '5px 8px',
                                borderBottom: '1px solid var(--bg4)',
                                fontFamily: 'IBM Plex Mono,monospace',
                                color: 'var(--muted)',
                              }}
                            >
                              <a
                                href={`https://www.wowhead.com/spell=${r.id}`}
                                target="_blank"
                                rel="noreferrer"
                                data-wh-spell={r.id}
                                data-wh-name={r.name}
                                style={{
                                  color: 'var(--muted)',
                                  textDecoration: 'none',
                                  borderBottom: '1px dotted var(--dim)',
                                  cursor: 'help',
                                }}
                              >
                                {r.name}
                              </a>
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                borderBottom: '1px solid var(--bg4)',
                                fontFamily: 'IBM Plex Mono,monospace',
                                color: 'var(--gold2)',
                                textAlign: 'right',
                              }}
                            >
                              {r.count1}
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                borderBottom: '1px solid var(--bg4)',
                                fontFamily: 'IBM Plex Mono,monospace',
                                color: 'var(--blue)',
                                textAlign: 'right',
                              }}
                            >
                              {r.count2}
                            </td>
                            <td
                              style={{
                                padding: '5px 8px',
                                borderBottom: '1px solid var(--bg4)',
                                fontFamily: 'IBM Plex Mono,monospace',
                                color: dc,
                                textAlign: 'right',
                              }}
                            >
                              {diff === null ? '—' : (diff >= 0 ? '+' : '') + diff + '%'}
                            </td>
                            <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bg4)', fontSize: 11 }}>
                              {ft && (
                                <>
                                  <span style={{ color: 'var(--gold2)' }}>{r.first1}s</span> vs{' '}
                                  <span style={{ color: 'var(--blue)' }}>{r.first2}s</span>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          </div>

      <div style={s.panel}>
            <CollapsibleSection
              title={
                <>
                  <div style={s.ptitleBar} />
                  Spell usage & cast rate
                </>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <ChartCard title="Spell usage — casts/min" height={240}>
                  <SpellUsageChart spellRows={spellRows} name1={p1data.name} name2={p2data.name} />
                </ChartCard>
                <ChartCard title="Cast rate over time (30s windows)" height={240}>
                  <CastTimelineChart p1data={p1data} p2data={p2data} />
                </ChartCard>
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              title={
                <>
                  <div style={s.ptitleBar} />
                  Buff uptime & major cooldowns
                </>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <ChartCard title="Buff uptime %" height={200}>
                  <ProcEfficiencyChart p1data={p1data} p2data={p2data} />
                </ChartCard>
                <ChartCard title="Major cooldowns (Blizzard CD length + usage vs partner)" height={220}>
                  <CooldownTimelineChart p1data={p1data} p2data={p2data} spellRows={spellRows} />
                </ChartCard>
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              title={
                <>
                  <div style={s.ptitleBar} />
                  Spell cast timeline
                </>
              }
            >
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px 14px' }}>
                <SpellTimeline
                  groups={spellTimelineGroups}
                  name1={p1data.name}
                  name2={p2data.name}
                  dur1={p1data.dur}
                  dur2={p2data.dur}
                />
              </div>
            </CollapsibleSection>
          </div>

        {talentDiff && (
          <div style={s.panel}>
            <CollapsibleSection
              title={
                <>
                  <div style={s.ptitleBar} />
                  Talent comparison
                </>
              }
              rightSlot={
                talentDiff.t1?.talentString && talentDiff.t2?.talentString ? (
                  <a
                    href={`/compare?b1=${encodeURIComponent(talentDiff.t1.talentString)}&b2=${encodeURIComponent(talentDiff.t2.talentString)}&n1=${encodeURIComponent(talentDiff.name1)}&n2=${encodeURIComponent(talentDiff.name2)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...s.btnGhost, textDecoration: 'none', fontSize: 10, padding: '4px 10px' }}
                  >
                    Open shareable diff
                  </a>
                ) : undefined
              }
            >
              {talentDiff.error && !talentDiff.t1 && !talentDiff.t2 ? (
                <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: 'var(--dim)' }}>
                  Could not load talent data: {talentDiff.error}
                </div>
              ) : (
                <TalentCompare
                  p1Talents={talentDiff.t1}
                  p2Talents={talentDiff.t2}
                  name1={talentDiff.name1}
                  name2={talentDiff.name2}
                  specId={talentDiff.specId}
                />
              )}
            </CollapsibleSection>
          </div>
        )}

      <div style={s.panel}>
            <CollapsibleSection
              title={
                <>
                  <div style={s.ptitleBar} />
                  Ask Claude
                </>
              }
              rightSlot={
                messagesCompare.length > 0 ? (
                  <CopyBtn
                    text={messagesCompare
                      .map(m => `${m.role === 'user' ? 'You' : 'Claude'}:\n${m.content}`)
                      .join('\n\n---\n\n')}
                    label="Copy All"
                  />
                ) : undefined
              }
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginBottom: 12,
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono,monospace',
                  fontSize: 11,
                  color: 'var(--muted)',
                  lineHeight: 1.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={autoRunCompareAiAfterLoad}
                  onChange={e => setAutoRunCompareAiAfterLoad(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span>
                  <strong style={{ color: 'var(--text)' }}>Auto-run initial analysis</strong>
                  {' — '}
                  after a compare finishes loading, send the default “top 5 changes” prompt to Claude immediately (saved in
                  this browser).
                </span>
              </label>
              <div
                ref={chatRef}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 560,
                  overflowY: 'auto',
                  marginBottom: 12,
                  paddingRight: 4,
                }}
              >
                {messagesCompare.length === 0 && !aiLoading && (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 10px',
                      background: 'var(--bg3)',
                      border: '1px dashed var(--border)',
                      borderRadius: 4,
                      fontFamily: 'IBM Plex Mono,monospace',
                      fontSize: 11,
                      color: 'var(--dim)',
                      lineHeight: 1.5,
                    }}
                  >
                    No messages yet — pick a quick question below (including the full initial review) or type your own.
                  </div>
                )}
                {messagesCompare.map((m, i) => {
                  const isLastUser = m.role === 'user' && messagesCompare.slice(i + 1).every(x => x.role !== 'user')
                  return (
                    <div key={i} ref={isLastUser ? lastUserMsgRef : null} style={{ marginBottom: m.role === 'user' ? 8 : 12 }}>
                      {m.role === 'user' ? (
                        <div
                          style={{
                            background: 'var(--bg3)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px 6px 2px 6px',
                            padding: '8px 12px',
                            fontSize: 12,
                            color: 'var(--muted)',
                            alignSelf: 'flex-end',
                            maxWidth: '74%',
                            marginLeft: 'auto',
                          }}
                        >
                          {m.content}
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <div
                            style={{
                              background: 'var(--bg2)',
                              border: '1px solid var(--border)',
                              borderRadius: '2px 6px 6px 6px',
                              padding: '13px 15px 36px 15px',
                              fontSize: 13,
                              lineHeight: 1.85,
                            }}
                          >
                            <FormatAI text={m.content} />
                          </div>
                          <div style={{ position: 'absolute', bottom: 8, right: 10 }}>
                            <CopyBtn text={m.content} label="Copy" />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {aiLoading && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '12px 15px',
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px 6px 6px 6px',
                      marginBottom: 10,
                    }}
                  >
                    {[0, 200, 400].map(d => (
                      <div
                        key={d}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          background: 'var(--dim)',
                          animation: `td 1.2s ${d}ms infinite`,
                        }}
                      />
                    ))}
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--dim)',
                        fontFamily: 'IBM Plex Mono,monospace',
                        marginLeft: 6,
                      }}
                    >
                      Analyzing...
                    </span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'IBM Plex Mono,monospace', marginBottom: 6 }}>
                Quick questions:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => startInitialCompareAnalysis()}
                  disabled={aiLoading || !talentDiff}
                  title={
                    talentDiff
                      ? 'Sends the full default compare prompt (Part 1 + Part 2, wipes). Adds SimulationCraft APL to context only when “Compare to SimulationCraft APL” is on (gold border) for a supported spec — shorthand label only.'
                      : 'Available once talent data has loaded'
                  }
                  style={{
                    fontFamily: 'IBM Plex Mono,monospace',
                    fontSize: 11,
                    padding: '7px 10px',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    color: 'var(--muted)',
                    cursor: aiLoading || !talentDiff ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => {
                    if (!aiLoading && talentDiff) {
                      ;(e.target as HTMLButtonElement).style.borderColor = 'var(--golddim)'
                      ;(e.target as HTMLButtonElement).style.color = 'var(--gold)'
                    }
                  }}
                  onMouseLeave={e => {
                    ;(e.target as HTMLButtonElement).style.borderColor = 'var(--border)'
                    ;(e.target as HTMLButtonElement).style.color = 'var(--muted)'
                  }}
                >
                  {COMPARE_INITIAL_QUICK_LABEL}
                </button>
                {(() => {
                  const simcForSpec = talentDiff ? simcAplAvailableForSpec(talentDiff.specId) : false
                  const simcOn = simcCompareEnabled && simcForSpec
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (simcForSpec) setSimcCompareEnabled(!simcCompareEnabled)
                      }}
                      disabled={aiLoading}
                      title={
                        simcForSpec
                          ? 'Click to include SimulationCraft’s default APL in Claude’s system context (gold border = on). Does not send a message. Use “Ask: log casts vs SimC + Wowhead” to request a cast-by-cast comparison.'
                          : 'SimulationCraft APL context is only wired for Mage and Death Knight (all three specs each).'
                      }
                      style={{
                        fontFamily: 'IBM Plex Mono,monospace',
                        fontSize: 11,
                        padding: '7px 10px',
                        background: 'var(--bg3)',
                        border: `1px solid ${simcOn ? 'var(--golddim)' : 'var(--border)'}`,
                        borderRadius: 3,
                        color: simcOn ? 'var(--gold)' : 'var(--muted)',
                        cursor: aiLoading ? 'not-allowed' : simcForSpec ? 'pointer' : 'not-allowed',
                        opacity: simcForSpec ? 1 : 0.65,
                        textAlign: 'left',
                        lineHeight: 1.4,
                      }}
                      onMouseEnter={e => {
                        if (aiLoading || !simcForSpec) return
                        ;(e.target as HTMLButtonElement).style.borderColor = 'var(--golddim)'
                        ;(e.target as HTMLButtonElement).style.color = 'var(--gold)'
                      }}
                      onMouseLeave={e => {
                        const el = e.target as HTMLButtonElement
                        el.style.borderColor = simcOn ? 'var(--golddim)' : 'var(--border)'
                        el.style.color = simcOn ? 'var(--gold)' : 'var(--muted)'
                      }}
                    >
                      {simcForSpec
                        ? 'Compare to SimulationCraft APL'
                        : 'Compare to SimulationCraft APL (unavailable)'}
                    </button>
                  )
                })()}
                {PRESET_QUESTIONS.map((p, i) => {
                  const { label, prompt } = resolvePresetPrompt(p)
                  return (
                    <button
                      key={`${i}-${label}`}
                      type="button"
                      onClick={() => sendCompareQuestion(prompt)}
                      disabled={aiLoading}
                      style={{
                        fontFamily: 'IBM Plex Mono,monospace',
                        fontSize: 11,
                        padding: '7px 10px',
                        background: 'var(--bg3)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--muted)',
                        cursor: aiLoading ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        lineHeight: 1.4,
                      }}
                      onMouseEnter={e => {
                        if (!aiLoading) {
                          ;(e.target as HTMLButtonElement).style.borderColor = 'var(--golddim)'
                          ;(e.target as HTMLButtonElement).style.color = 'var(--gold)'
                        }
                      }}
                      onMouseLeave={e => {
                        ;(e.target as HTMLButtonElement).style.borderColor = 'var(--border)'
                        ;(e.target as HTMLButtonElement).style.color = 'var(--muted)'
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={s.input}
                  value={inputCompare}
                  onChange={e => setInputCompare(e.target.value)}
                  placeholder="Ask anything — why am I losing DPS, when should I hold cooldowns, etc."
                  onKeyDown={e => e.key === 'Enter' && sendCompareQuestion()}
                  disabled={aiLoading}
                />
                <button style={aiLoading ? s.btnGoldDis : s.btnGold} onClick={() => sendCompareQuestion()} disabled={aiLoading}>
                  Ask
                </button>
              </div>
            </CollapsibleSection>
          </div>
    </>
  )
}
