import { useEffect, useMemo, useRef } from 'react'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { simcAplAvailableForSpec } from '../../lib/knowledge/embeddedSimc'
import { SpellUsageChart, CastTimelineChart, ProcEfficiencyChart, CooldownTimelineChart, ChartCard } from '../Charts'
import { SpellTimeline, type SpellTimelineGroup } from '../Charts/SpellTimeline'
import { FormatAI, CopyBtn } from '../AIChat'
import { CollapsibleSection } from '../CollapsibleSection'
import { s, PRESET_QUESTIONS_SOLO } from '../../lib/styles'

export function SoloFightView() {
  const fa = useFightAnalysis()
  const {
    p1data,
    p2data,
    spellRows,
    talentDiff,
    messagesAnalyze,
    inputAnalyze,
    setInputAnalyze,
    aiLoading,
    simcCompareEnabled,
    setSimcCompareEnabled,
    bossName,
    fightKill1,
    sendAnalyzeQuestion,
  } = fa

  const chatRef = useRef<HTMLDivElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = chatRef.current
    if (!el || !lastUserMsgRef.current) return
    const msgTop = lastUserMsgRef.current.offsetTop
    el.scrollTo({ top: Math.max(0, msgTop - 12), behavior: aiLoading ? 'smooth' : 'auto' })
  }, [messagesAnalyze, aiLoading])

  const dur1Fmt = p1data ? `${Math.floor(p1data.dur / 60)}:${String(Math.round(p1data.dur % 60)).padStart(2, '0')}` : ''

  const spellTimelineGroups: SpellTimelineGroup[] = useMemo(() => {
    if (!p1data) return []
    const ids = new Set<number>()
    for (const seg of p1data.castTimeline || []) ids.add(seg.spellId)
    const resolveName = (spellId: number) =>
      p1data.spellMap[String(spellId)]?.name || p1data.nameMap[spellId] || `Spell ${spellId}`

    return [...ids]
      .map(spellId => ({
        spellId,
        name: resolveName(spellId),
        segments1: (p1data.castTimeline || []).filter(s => s.spellId === spellId),
        segments2: [],
      }))
      .sort((a, b) => b.segments1.length - a.segments1.length)
      .slice(0, 22)
  }, [p1data])

  return (
    <>
        {!p1data && (
          <div style={s.panel}>
            <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              Paste a Warcraft Logs <strong style={{ color: 'var(--text)' }}>report</strong> URL{' '}
              (<code style={{ color: 'var(--blue)' }}>?fight=…</code>) or a <strong style={{ color: 'var(--text)' }}>compare</strong>{' '}
              URL, then click <strong style={{ color: 'var(--text)' }}>Load</strong>. For a compare link you are{' '}
              <strong style={{ color: 'var(--gold2)' }}>player 1</strong> — use <strong style={{ color: 'var(--text)' }}>Solo</strong> for
              your pull only, or <strong style={{ color: 'var(--text)' }}>Compare</strong> when two players are loaded.
            </div>
          </div>
        )}

        {p1data && p2data && (
          <>
            <div style={s.panel}>
              <CollapsibleSection
                title={
                  <>
                    <div style={s.ptitleBar} />
                    {bossName} — {p1data.name}
                  </>
                }
              >
                <div
                  style={{
                    background: 'var(--bg3)',
                    border: `1px solid ${fightKill1 ? 'var(--border)' : 'rgba(212,64,64,0.3)'}`,
                    borderRadius: 4,
                    padding: '10px 13px',
                    maxWidth: 480,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Rajdhani,sans-serif',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '.8px',
                      textTransform: 'uppercase',
                      color: 'var(--gold2)',
                      marginBottom: 4,
                    }}
                  >
                    {p1data.name}
                    {!fightKill1 && <span style={{ marginLeft: 8, color: 'var(--red)', fontSize: 9 }}>WIPE</span>}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Rajdhani,sans-serif',
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--gold2)',
                      lineHeight: 1.2,
                    }}
                  >
                    {p1data.dps?.toLocaleString() || '?'}{' '}
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
                    {dur1Fmt} · {p1data.downtime.cpm}/min · {p1data.downtime.pct}% downtime · {p1data.spec}
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: 'Rajdhani,sans-serif',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '.8px',
                    textTransform: 'uppercase',
                    color: 'var(--dim)',
                    margin: '14px 0 6px',
                  }}
                >
                  Spell breakdown — total casts
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        {['Spell', 'Casts', 'First cast'].map((h, i) => (
                          <th
                            key={h}
                            style={{
                              fontFamily: 'Rajdhani,sans-serif',
                              fontSize: 10,
                              letterSpacing: '.8px',
                              textTransform: 'uppercase',
                              color: i === 1 ? 'var(--gold2)' : 'var(--dim)',
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
                        .filter(r => r.count1 > 0)
                        .map((r, i) => (
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
                                textAlign: 'right',
                                fontSize: 11,
                              }}
                            >
                              {r.first1 != null ? `${r.first1}s` : '—'}
                            </td>
                          </tr>
                        ))}
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
                    <SpellUsageChart spellRows={spellRows} name1={p1data.name} name2={p2data.name} solo />
                  </ChartCard>
                  <ChartCard title="Cast rate over time (30s windows)" height={240}>
                    <CastTimelineChart p1data={p1data} p2data={p2data} solo />
                  </ChartCard>
                </div>
              </CollapsibleSection>
              <CollapsibleSection
                title={
                  <>
                    <div style={s.ptitleBar} />
                    Buff uptime & cooldowns
                  </>
                }
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <ChartCard title="Buff uptime %" height={200}>
                    <ProcEfficiencyChart p1data={p1data} p2data={p2data} solo />
                  </ChartCard>
                  <ChartCard title="Major cooldowns (total casts)" height={220}>
                    <CooldownTimelineChart p1data={p1data} p2data={p2data} spellRows={spellRows} solo />
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
                    solo
                  />
                </div>
              </CollapsibleSection>
            </div>

            <div style={s.panel}>
              <CollapsibleSection
                title={
                  <>
                    <div style={s.ptitleBar} />
                    Ask Claude
                  </>
                }
                rightSlot={
                  messagesAnalyze.length > 0 ? (
                    <CopyBtn
                      text={messagesAnalyze
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
                    cursor: simcAplAvailableForSpec(talentDiff?.specId) ? 'pointer' : 'not-allowed',
                    fontFamily: 'IBM Plex Mono,monospace',
                    fontSize: 11,
                    color: 'var(--muted)',
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={simcCompareEnabled && simcAplAvailableForSpec(talentDiff?.specId)}
                    disabled={!simcAplAvailableForSpec(talentDiff?.specId)}
                    onChange={e => setSimcCompareEnabled(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span>
                    <strong style={{ color: 'var(--text)' }}>Compare to SimulationCraft</strong>
                    {' — '}
                    include the default Frost Mage APL and frame answers against sim priorities (opt-in).
                    {!simcAplAvailableForSpec(talentDiff?.specId) && (
                      <span style={{ color: 'var(--dim)' }}> (Frost Mage when bundled.)</span>
                    )}
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
                  {messagesAnalyze.map((m, i) => {
                    const isLastUser = m.role === 'user' && messagesAnalyze.slice(i + 1).every(x => x.role !== 'user')
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
                  {PRESET_QUESTIONS_SOLO.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendAnalyzeQuestion(q)}
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
                      {q}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={s.input}
                    value={inputAnalyze}
                    onChange={e => setInputAnalyze(e.target.value)}
                    placeholder="Ask about your rotation, cooldowns, procs…"
                    onKeyDown={e => e.key === 'Enter' && sendAnalyzeQuestion()}
                    disabled={aiLoading}
                  />
                  <button style={aiLoading ? s.btnGoldDis : s.btnGold} onClick={() => sendAnalyzeQuestion()} disabled={aiLoading}>
                    Ask
                  </button>
                </div>
              </CollapsibleSection>
            </div>
          </>
        )}
    </>
  )
}
