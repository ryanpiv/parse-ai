import { useEffect, useState } from 'react'
import { categorizeTalents } from '../../lib/talents/diffTalents'
import { _nodeMap } from '../../lib/talents/nodeResolution'
import { IconGrid } from './TalentIcon'

export function TalentCompare({
  p1Talents,
  p2Talents,
  name1,
  name2,
  treeLayout,
}: {
  p1Talents: any
  p2Talents: any
  name1: string
  name2: string
  treeLayout?: Map<number, any> | null
}) {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const allNodeIDs = [
      ...(p1Talents?.talentTree || []).map((t: any) => t.nodeID),
      ...(p2Talents?.talentTree || []).map((t: any) => t.nodeID),
    ].filter(Boolean)

    if (!allNodeIDs.length) return

    fetch('/api/talents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeIDs: [...new Set(allNodeIDs)] }),
    })
      .then((r) => r.json())
      .then((d) => {
        Object.assign(_nodeMap, d.nodeMap || {})
        console.log(`[TalentCompare] loaded ${Object.keys(d.nodeMap || {}).length} node mappings`)
        forceUpdate((n) => n + 1)
      })
      .catch(() => {})
  }, [p1Talents, p2Talents])

  if (!p1Talents && !p2Talents) {
    return (
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--dim)', padding: '8px 0' }}>
        Talent data not available. Check browser console for details.
      </div>
    )
  }

  const cats1 = categorizeTalents(p1Talents?.talentTree || [], treeLayout ?? null)
  const cats2 = categorizeTalents(p2Talents?.talentTree || [], treeLayout ?? null)

  function makeIdSet(arr: { id: number }[]) {
    return new Set(arr.map((t) => t.id))
  }
  const set1 = {
    class: makeIdSet(cats1.class),
    spec: makeIdSet(cats1.spec),
    hero: makeIdSet(cats1.hero),
  }
  const set2 = {
    class: makeIdSet(cats2.class),
    spec: makeIdSet(cats2.spec),
    hero: makeIdSet(cats2.hero),
  }

  function annotate(talents: any[], otherSet: Set<number>) {
    return talents.map((t) => ({ ...t, state: otherSet.has(t.id) ? 'both' : 'p1' }))
  }
  function annotateP2(talents: any[], otherSet: Set<number>) {
    return talents.map((t) => ({ ...t, state: otherSet.has(t.id) ? 'both' : 'p2' }))
  }

  function buildFullRow(cat: 'class' | 'spec' | 'hero') {
    const allTalents1: any[] = [],
      allTalents2: any[] = []
    const merged = new Map<number, any>()
    cats1[cat].forEach((t) => merged.set(t.id, t))
    cats2[cat].forEach((t) => {
      if (!merged.has(t.id)) merged.set(t.id, t)
    })

    merged.forEach((t, id) => {
      const inP1 = set1[cat].has(id)
      const inP2 = set2[cat].has(id)
      allTalents1.push({ ...t, state: inP1 ? (inP2 ? 'both' : 'p1') : 'neither' })
      allTalents2.push({ ...t, state: inP2 ? (inP1 ? 'both' : 'p2') : 'neither' })
    })

    return { p1: allTalents1, p2: allTalents2 }
  }

  const classRow = buildFullRow('class')
  const specRow = buildFullRow('spec')
  const heroRow = buildFullRow('hero')

  const diff1 = [
    ...cats1.class.filter((t) => !set2.class.has(t.id)).map((t) => ({ ...t, state: 'p1' as const, cat: 'class' })),
    ...cats1.spec.filter((t) => !set2.spec.has(t.id)).map((t) => ({ ...t, state: 'p1' as const, cat: 'spec' })),
    ...cats1.hero.filter((t) => !set2.hero.has(t.id)).map((t) => ({ ...t, state: 'p1' as const, cat: 'hero' })),
  ]
  const diff2 = [
    ...cats2.class.filter((t) => !set1.class.has(t.id)).map((t) => ({ ...t, state: 'p2' as const, cat: 'class' })),
    ...cats2.spec.filter((t) => !set1.spec.has(t.id)).map((t) => ({ ...t, state: 'p2' as const, cat: 'spec' })),
    ...cats2.hero.filter((t) => !set1.hero.has(t.id)).map((t) => ({ ...t, state: 'p2' as const, cat: 'hero' })),
  ]

  const totalDiffs = diff1.length + diff2.length
  const shared =
    cats1.class.filter((t) => set2.class.has(t.id)).length +
    cats1.spec.filter((t) => set2.spec.has(t.id)).length +
    cats1.hero.filter((t) => set2.hero.has(t.id)).length

  const s = {
    grid: { display: 'grid' as const, gridTemplateColumns: '80px 1fr 1fr', gap: 0 },
    rowLabel: {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.8px',
      textTransform: 'uppercase' as const,
      color: 'var(--dim)',
      paddingTop: 10,
      paddingRight: 10,
      display: 'flex',
      alignItems: 'flex-start',
    },
    cell: { padding: '10px 8px', borderBottom: '1px solid var(--border)' },
    colHeader: {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.8px',
      textTransform: 'uppercase' as const,
      padding: '6px 8px',
      borderBottom: '1px solid var(--border)',
    },
    diffCell: {
      padding: '10px 8px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg3)',
      borderRadius: 0,
    },
  }

  return (
    <div>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}
      >
        <div style={{ display: 'flex', gap: 16, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
          <span style={{ color: 'var(--dim)' }}>
            Shared: <span style={{ color: 'var(--text)' }}>{shared}</span>
          </span>
          <span style={{ color: 'var(--gold2)' }}>
            {name1} unique: <strong>{diff1.length}</strong>
          </span>
          <span style={{ color: 'var(--blue)' }}>
            {name2} unique: <strong>{diff2.length}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {p1Talents?.talentString && (
            <a
              href={`https://www.wowhead.com/talent-calc/mage/frost#${p1Talents.talentString}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--gold2)' }}
            >
              {name1} on Wowhead ↗
            </a>
          )}
          {p2Talents?.talentString && (
            <a
              href={`https://www.wowhead.com/talent-calc/mage/frost#${p2Talents.talentString}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--blue)' }}
            >
              {name2} on Wowhead ↗
            </a>
          )}
        </div>
      </div>

      <div style={s.grid}>
        <div style={{ ...s.colHeader, color: 'var(--dim)' }} />
        <div style={{ ...s.colHeader, color: 'var(--gold2)', borderLeft: '1px solid var(--border)' }}>{name1}</div>
        <div style={{ ...s.colHeader, color: 'var(--blue)', borderLeft: '1px solid var(--border)' }}>{name2}</div>

        {totalDiffs > 0 && (
          <>
            <div style={{ ...s.rowLabel, ...s.diffCell, background: 'var(--bg3)' }}>Diff</div>
            <div style={{ ...s.diffCell, borderLeft: '2px solid rgba(201,162,39,0.3)' }}>
              <IconGrid talents={diff1} emptyLabel="Identical" />
            </div>
            <div style={{ ...s.diffCell, borderLeft: '2px solid rgba(90,173,240,0.3)' }}>
              <IconGrid talents={diff2} emptyLabel="Identical" />
            </div>
          </>
        )}

        {(classRow.p1.length > 0 || classRow.p2.length > 0) && (
          <>
            <div style={{ ...s.rowLabel, ...s.cell }}>Class</div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid talents={classRow.p1} />
            </div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid talents={classRow.p2} />
            </div>
          </>
        )}

        {(specRow.p1.length > 0 || specRow.p2.length > 0) && (
          <>
            <div style={{ ...s.rowLabel, ...s.cell }}>Spec</div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid talents={specRow.p1} />
            </div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid talents={specRow.p2} />
            </div>
          </>
        )}

        {(heroRow.p1.length > 0 || heroRow.p2.length > 0) && (
          <>
            <div style={{ ...s.rowLabel, ...s.cell }}>Hero</div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid talents={heroRow.p1} />
            </div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid talents={heroRow.p2} />
            </div>
          </>
        )}

        {classRow.p1.length === 0 && specRow.p1.length === 0 && heroRow.p1.length === 0 && (
          <>
            <div style={{ ...s.rowLabel, ...s.cell }}>Talents</div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid
                talents={(p1Talents?.talentTree || []).map((t: any) => ({
                  id: t.spellId || t.id,
                  name: t.name || `Talent ${t.spellId || t.id}`,
                  state: 'p1' as const,
                }))}
              />
            </div>
            <div style={{ ...s.cell, borderLeft: '1px solid var(--border)' }}>
              <IconGrid
                talents={(p2Talents?.talentTree || []).map((t: any) => ({
                  id: t.spellId || t.id,
                  name: t.name || `Talent ${t.spellId || t.id}`,
                  state: 'p2' as const,
                }))}
              />
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 12,
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 10,
          color: 'var(--dim)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: 'rgba(64,160,96,0.2)',
              border: '1.5px solid rgba(64,160,96,0.6)',
              display: 'inline-block',
            }}
          />
          both
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: 'rgba(201,162,39,0.15)',
              border: '2px solid rgba(201,162,39,0.9)',
              display: 'inline-block',
            }}
          />
          {name1} only
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: 'rgba(90,173,240,0.15)',
              border: '2px solid rgba(90,173,240,0.9)',
              display: 'inline-block',
            }}
          />
          {name2} only
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: '#1e252e',
              border: '1px solid rgba(42,51,64,0.5)',
              opacity: 0.4,
              display: 'inline-block',
            }}
          />
          neither
        </span>
      </div>
    </div>
  )
}
