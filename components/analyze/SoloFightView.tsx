import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFightAnalysis } from '../../contexts/FightAnalysisContext'
import { simcAplAvailableForSpec } from '../../lib/knowledge/embeddedSimc'
import { wowheadReferenceAvailableForSpec } from '../../lib/knowledge/embeddedWowhead'
import { icyVeinsReferenceAvailableForSpec } from '../../lib/knowledge/embeddedIcyVeins'
import {
  SpellUsageChart,
  CastTimelineChart,
  ProcEfficiencyChart,
  CooldownTimelineChart,
  ChartCard,
  CritRateChart,
  hasCritRateChartData,
} from '../Charts'
import { SpellTimeline, type SpellTimelineGroup } from '../Charts/SpellTimeline'
import { FormatAI, CopyBtn } from '../AIChat'
import { CollapsibleSection } from '../CollapsibleSection'
import { CollapsibleGroupProvider, type CollapsibleBridgeApi } from '../CollapsibleGroup'
import { buildInitialSoloUserPrompt } from '../../lib/buildContext/initialComparePrompt'
import {
  s,
  pa,
  PRESET_QUESTIONS_SOLO,
  SOLO_INITIAL_QUICK_LABEL,
  resolvePresetPrompt,
  PRESET_SOLO_ROTATION_WOWHEAD,
  PRESET_SOLO_ROTATION_ICY,
  PRESET_SOLO_ROTATION_BOTH,
  ROTATION_GUIDE_CLUSTER_LABEL,
  ROTATION_GUIDE_CLUSTER_LABEL_COLOR,
} from '../../lib/styles'

export function SoloFightView(props: {
  collapsibleBridgeRef?: MutableRefObject<CollapsibleBridgeApi | null>
}) {
  const { collapsibleBridgeRef } = props
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
    aiLiveStatus,
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

  const soloSpellRows = useMemo(
    () => spellRows.filter(r => r.count1 > 0).sort((a, b) => b.count1 - a.count1),
    [spellRows]
  )

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
          <CollapsibleGroupProvider bridgeRef={collapsibleBridgeRef}>
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
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'stretch',
                    gap: '14px 28px',
                    background: 'var(--bg3)',
                    border: `1px solid ${fightKill1 ? 'var(--border)' : 'rgba(212,64,64,0.3)'}`,
                    borderRadius: 4,
                    padding: '12px 16px',
                    width: '100%',
                  }}
                >
                  <div style={{ minWidth: 140, flex: '1 1 160px' }}>
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
                        fontSize: 10,
                        color: 'var(--dim)',
                        marginTop: 4,
                      }}
                    >
                      {p1data.spec}
                    </div>
                  </div>
                  {[
                    { label: 'Duration', value: dur1Fmt },
                    { label: 'Casts / min', value: `${p1data.downtime.cpm}` },
                    { label: 'Downtime', value: `${p1data.downtime.pct}%` },
                    {
                      label: 'Damage taken',
                      value:
                        p1data.takenTotal != null && Number.isFinite(p1data.takenTotal)
                          ? Math.round(p1data.takenTotal).toLocaleString()
                          : '—',
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      style={{
                        minWidth: 100,
                        flex: '0 1 auto',
                        borderLeft: '1px solid var(--border)',
                        paddingLeft: 16,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'Rajdhani,sans-serif',
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: '.7px',
                          textTransform: 'uppercase',
                          color: 'var(--dim)',
                          marginBottom: 3,
                        }}
                      >
                        {label}
                      </div>
                      <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 13, color: 'var(--muted)' }}>{value}</div>
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
                    margin: '14px 0 6px',
                  }}
                >
                  Spell breakdown — total casts
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        {['Spell', 'Casts', 'Casts/min', 'Crit %', 'Avg gap (s)', 'First cast'].map((h, i) => (
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
                      {soloSpellRows.map((r, i) => {
                        const crit = p1data.critRates?.[r.id]
                        const gap = p1data.spacing?.[Number(r.id)]?.avgGap
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
                                textAlign: 'right',
                                fontSize: 11,
                                color: 'var(--muted)',
                              }}
                            >
                              {r.ppm1 > 0 ? r.ppm1.toFixed(2) : '—'}
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
                              {crit != null ? `${crit}%` : '—'}
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
                              {gap != null && Number.isFinite(gap) ? gap.toFixed(1) : '—'}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                  <ChartCard title="Spell usage — casts/min" height={260}>
                    <SpellUsageChart spellRows={spellRows} name1={p1data.name} name2={p2data.name} solo />
                  </ChartCard>
                  {hasCritRateChartData(p1data) && (
                    <ChartCard title="Crit % — top spells by cast count" height={220}>
                      <CritRateChart p1data={p1data} />
                    </ChartCard>
                  )}
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
                  {messagesAnalyze.length === 0 && !aiLoading && (
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
                      No messages yet — try a quick question below or type your own.
                    </div>
                  )}
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
                          (() => {
                            const isLast = i === messagesAnalyze.length - 1
                            const streamingHere = isLast && aiLoading
                            const showTyping = streamingHere && !m.content.trim()
                            const bubblePad = showTyping || !m.content ? '13px 15px' : '13px 15px 36px 15px'
                            return (
                              <div style={{ position: 'relative' }}>
                                <div
                                  style={{
                                    background: 'var(--bg2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '2px 6px 6px 6px',
                                    padding: bubblePad,
                                    fontSize: 13,
                                    lineHeight: 1.85,
                                  }}
                                >
                                  {showTyping ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                                          marginLeft: 4,
                                        }}
                                      >
                                        Analyzing… {aiLiveStatus ? `${aiLiveStatus.elapsedSec}s` : '0s'}
                                        {aiLiveStatus?.inputTokens != null
                                          ? ` · ${aiLiveStatus.inputTokens.toLocaleString()} in`
                                          : ''}
                                        {aiLiveStatus?.outputTokens != null
                                          ? ` · ${aiLiveStatus.outputTokens.toLocaleString()} out`
                                          : ''}
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      {m.content ? <FormatAI text={m.content} /> : null}
                                      {streamingHere && m.content ? (
                                        <span style={{ color: 'var(--golddim)', fontWeight: 300 }} aria-hidden>
                                          ▍
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                  {m.usage && !streamingHere ? (
                                    <div
                                      style={{
                                        fontSize: 10,
                                        color: 'var(--dim)',
                                        marginTop: 10,
                                        fontFamily: 'IBM Plex Mono,monospace',
                                        borderTop: '1px solid var(--border)',
                                        paddingTop: 8,
                                      }}
                                    >
                                      {m.usage.in.toLocaleString()} tokens in · {m.usage.out.toLocaleString()} out
                                    </div>
                                  ) : null}
                                </div>
                                {m.content && !showTyping ? (
                                  <div style={{ position: 'absolute', bottom: 8, right: 10 }}>
                                    <CopyBtn text={m.content} label="Copy" />
                                  </div>
                                ) : null}
                              </div>
                            )
                          })()
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'IBM Plex Mono,monospace', marginBottom: 6 }}>
                  Quick questions:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!p1data) return
                      sendAnalyzeQuestion(
                        buildInitialSoloUserPrompt({
                          playerName: talentDiff?.name1 ?? p1data.name,
                          spec: p1data.spec,
                          isKill: fightKill1,
                          simcGrounded: simcCompareEnabled && simcAplAvailableForSpec(talentDiff?.specId),
                        })
                      )
                    }}
                    disabled={aiLoading}
                    title="Sends the full default solo prompt (Part 1 + Part 2, wipe note). Adds SimulationCraft APL to context only when “Compare to SimulationCraft APL” is on (gold border) for a supported spec — shorthand label only."
                    className={pa.quickTile}
                  >
                    {SOLO_INITIAL_QUICK_LABEL}
                  </button>
                  {(() => {
                    const simcForSpec = simcAplAvailableForSpec(talentDiff?.specId)
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
                        className={
                          pa.quickTile +
                          (simcOn ? ` ${pa.quickTileActive}` : '') +
                          (!simcForSpec ? ` ${pa.quickTileUnavailable}` : '')
                        }
                      >
                        {simcForSpec
                          ? 'Compare to SimulationCraft APL'
                          : 'Compare to SimulationCraft APL (unavailable)'}
                      </button>
                    )
                  })()}
                  {(() => {
                    const whOk = wowheadReferenceAvailableForSpec(talentDiff?.specId)
                    const icyOk = icyVeinsReferenceAvailableForSpec(talentDiff?.specId)
                    const bothOk = whOk && icyOk
                    return (
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          padding: '8px 10px',
                          background: 'var(--bg3)',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'IBM Plex Mono,monospace',
                            fontSize: 10,
                            color: ROTATION_GUIDE_CLUSTER_LABEL_COLOR,
                            marginBottom: 6,
                            lineHeight: 1.35,
                          }}
                        >
                          {ROTATION_GUIDE_CLUSTER_LABEL}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          <button
                            type="button"
                            disabled={aiLoading || !whOk}
                            title={
                              whOk
                                ? 'Include Wowhead scraped rotation/talent text. Asks Claude to compare your log to that guide.'
                                : 'Wowhead scraped bundle is not available for this spec yet.'
                            }
                            className={pa.guideChip}
                            onClick={() => sendAnalyzeQuestion(PRESET_SOLO_ROTATION_WOWHEAD)}
                          >
                            Wowhead
                          </button>
                          <button
                            type="button"
                            disabled={aiLoading || !icyOk}
                            title={
                              icyOk
                                ? 'Include Icy Veins scraped rotation text. Asks Claude to compare your log to that guide.'
                                : 'Icy Veins scraped bundle is not available for this spec yet.'
                            }
                            className={pa.guideChip}
                            onClick={() => sendAnalyzeQuestion(PRESET_SOLO_ROTATION_ICY)}
                          >
                            Icy Veins
                          </button>
                          <button
                            type="button"
                            disabled={aiLoading || !bothOk}
                            title={
                              bothOk
                                ? 'Include Wowhead and Icy Veins excerpts. Compares your pull to both guides.'
                                : 'Both requires Wowhead and Icy Veins data for this spec (e.g. Frost Mage).'
                            }
                            className={pa.guideChip}
                            onClick={() => sendAnalyzeQuestion(PRESET_SOLO_ROTATION_BOTH)}
                          >
                            Both
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                  {PRESET_QUESTIONS_SOLO.map((p, i) => {
                    const { label, prompt } = resolvePresetPrompt(p)
                    return (
                      <button
                        key={`${i}-${label}`}
                        type="button"
                        onClick={() => sendAnalyzeQuestion(prompt)}
                        disabled={aiLoading}
                        className={pa.quickTile}
                      >
                        {label}
                      </button>
                    )
                  })}
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
                  <button
                    type="button"
                    className={pa.btnGold}
                    onClick={() => sendAnalyzeQuestion()}
                    disabled={aiLoading}
                  >
                    Ask
                  </button>
                </div>
              </CollapsibleSection>
            </div>
          </>
          </CollapsibleGroupProvider>
        )}
    </>
  )
}
