import Head from 'next/head'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { applyVibe, readStoredVibe, VIBES, type VibeId, type VibeKit } from '../lib/vibes'
import { s } from '../lib/styles'

export default function LookPage() {
  const [active, setActive] = useState<VibeId>('classic')

  useEffect(() => {
    const id = readStoredVibe()
    setActive(id)
    applyVibe(id)
  }, [])

  const useKit = useCallback((id: VibeId) => {
    setActive(id)
    applyVibe(id)
  }, [])

  return (
    <>
      <Head>
        <title>Look — Parse Analyzer</title>
      </Head>
      <div style={s.wrap}>
        <div style={s.hdr}>
          <div>
            <div style={s.logo}>Look</div>
            <div style={s.logoSub}>Color, type, and chrome — click a kit to paint the whole app</div>
          </div>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 15,
            color: 'var(--muted)',
            lineHeight: 1.55,
            marginBottom: 22,
            maxWidth: 720,
          }}
        >
          A–E in the Cursor canvas was layout, not color. These are the palettes. Each card is a mini UI kit
          in that scheme. <strong style={{ color: 'var(--text)', fontWeight: 600 }}>Use this kit</strong> applies
          it to Analyze, Talents, and the rest of the app.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {VIBES.map(kit => (
            <KitCard key={kit.id} kit={kit} active={active === kit.id} onUse={() => useKit(kit.id)} />
          ))}
        </div>
      </div>
    </>
  )
}

function KitCard(props: { kit: VibeKit; active: boolean; onUse: () => void }) {
  const { kit, active, onUse } = props
  const c = kit.colors
  const swatches: Array<{ name: string; hex: string }> = [
    { name: 'bg', hex: c.bg },
    { name: 'surface', hex: c.bg2 },
    { name: 'raised', hex: c.bg3 },
    { name: 'border', hex: c.border },
    { name: 'text', hex: c.text },
    { name: 'muted', hex: c.muted },
    { name: 'accent', hex: c.accent },
    { name: 'accent 2', hex: c.accent2 },
  ]

  return (
    <section
      style={{
        background: c.bg,
        color: c.text,
        border: `2px solid ${active ? c.accent : c.border}`,
        borderRadius: kit.radius + 4,
        overflow: 'hidden',
        fontFamily: kit.fontUi,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '18px 20px 12px',
          borderBottom: `1px solid ${c.border}`,
          background: c.bg2,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: kit.fontDisplay,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: kit.tracking,
              textTransform: kit.transform,
              color: c.accent2,
            }}
          >
            {kit.name}
          </div>
          <div style={{ fontSize: 13, color: c.muted, marginTop: 4, maxWidth: 520 }}>{kit.blurb}</div>
        </div>
        <button
          type="button"
          onClick={onUse}
          style={{
            fontFamily: kit.fontDisplay,
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: kit.tracking,
            textTransform: kit.transform,
            padding: '9px 18px',
            border: 'none',
            borderRadius: kit.radius,
            background: c.accent,
            color: c.onAccent,
            cursor: 'pointer',
          }}
        >
          {active ? 'Using this kit' : 'Use this kit'}
        </button>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          {swatches.map(sw => (
            <div key={sw.name} style={{ width: 72 }}>
              <div
                style={{
                  height: 40,
                  borderRadius: Math.max(4, kit.radius - 4),
                  background: sw.hex,
                  border: `1px solid ${c.border}`,
                }}
              />
              <div style={{ fontFamily: kit.fontMono, fontSize: 10, color: c.dim, marginTop: 4 }}>{sw.name}</div>
              <div style={{ fontFamily: kit.fontMono, fontSize: 10, color: c.muted }}>{sw.hex}</div>
            </div>
          ))}
        </div>

        <ChromePreview kit={kit} />
      </div>
    </section>
  )
}

function ChromePreview(props: { kit: VibeKit }) {
  const { kit } = props
  const c = kit.colors
  const tab = (label: string, on: boolean): CSSProperties => ({
    fontFamily: kit.fontDisplay,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: kit.tracking,
    textTransform: kit.transform,
    padding: '8px 14px',
    borderRadius: kit.radius,
    border: `1px solid ${on ? c.accent : c.border}`,
    background: on ? c.bg2 : c.bg3,
    color: on ? c.accent2 : c.dim,
  })

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: kit.radius,
        padding: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          fontFamily: kit.fontDisplay,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: kit.tracking,
          textTransform: kit.transform,
          color: c.dim,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: `1px solid ${c.border}`,
        }}
      >
        <span style={{ color: c.accent2 }}>Analyze</span>
        <span>Talents</span>
        <span>Look</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
        <div
          style={{
            background: c.bg3,
            border: `1px solid ${c.border}`,
            borderRadius: Math.max(4, kit.radius - 4),
            padding: '8px 10px',
            fontFamily: kit.fontMono,
            fontSize: 12,
            color: c.muted,
          }}
        >
          https://www.warcraftlogs.com/reports/…
        </div>
        <div
          style={{
            fontFamily: kit.fontDisplay,
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: kit.tracking,
            textTransform: kit.transform,
            padding: '8px 16px',
            borderRadius: Math.max(4, kit.radius - 4),
            background: c.accent,
            color: c.onAccent,
          }}
        >
          Load
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={tab('Solo', true)}>Solo</div>
        <div style={tab('Compare', false)}>Compare</div>
      </div>
      <div
        style={{
          background: c.bg2,
          border: `1px solid ${c.border}`,
          borderRadius: kit.radius,
          padding: 14,
        }}
      >
        <div
          style={{
            fontFamily: kit.fontDisplay,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: kit.tracking,
            textTransform: kit.transform,
            color: c.muted,
            marginBottom: 8,
          }}
        >
          Fight
        </div>
        <div style={{ fontSize: 14, color: c.text, marginBottom: 10 }}>The Azurevault — 4:12 kill</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: kit.fontMono,
              fontSize: 11,
              padding: '6px 10px',
              borderRadius: Math.max(4, kit.radius - 6),
              border: `1px solid ${c.border}`,
              color: c.muted,
            }}
          >
            Ask: rotation vs SimC
          </span>
          <span style={{ fontFamily: kit.fontMono, fontSize: 11, color: c.green }}>Loaded</span>
          <span style={{ fontFamily: kit.fontMono, fontSize: 11, color: c.red }}>Could not load this log</span>
        </div>
      </div>
    </div>
  )
}
