import { useEffect, useRef } from 'react'
import { _nodeMap } from '../../lib/talents/nodeResolution'

export type TalentIconState = 'p1' | 'p2' | 'both' | 'neither'

export function TalentIcon({
  spellId,
  nodeId,
  name,
  state,
  size = 40,
}: {
  spellId: number
  nodeId?: number
  name?: string
  state?: TalentIconState
  size?: number
}) {
  const mapped = nodeId ? _nodeMap[nodeId] || _nodeMap[String(nodeId)] : null
  const iconUrl = mapped?.icon || null
  const displayName = mapped?.name || name
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.setAttribute('data-wh-spell', String(mapped?.spellId || spellId))
      ref.current.setAttribute('data-wh-name', displayName || '')
    }
  }, [displayName, spellId, mapped])

  const borderColor =
    state === 'p1'
      ? 'rgba(201,162,39,0.9)'
      : state === 'p2'
        ? 'rgba(90,173,240,0.9)'
        : state === 'both'
          ? 'rgba(64,160,96,0.7)'
          : 'rgba(42,51,64,0.5)'

  const opacity = state === 'neither' ? 0.25 : 1

  return (
    <a
      ref={ref}
      href={`https://www.wowhead.com/spell=${spellId}`}
      target="_blank"
      rel="noreferrer"
      data-wh-spell={spellId}
      data-wh-name={displayName}
      title={displayName}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 7,
        flexShrink: 0,
        border: `2px solid ${borderColor}`,
        background: iconUrl ? 'transparent' : '#1e252e',
        opacity,
        cursor: 'pointer',
        textDecoration: 'none',
        overflow: 'hidden',
        position: 'relative',
        transition: 'transform .1s, opacity .1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)'
        e.currentTarget.style.zIndex = '10'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.zIndex = '1'
      }}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={displayName}
          style={{ width: '100%', height: '100%', display: 'block', borderRadius: 5 }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 8,
            color: '#4a5a6a',
            textAlign: 'center',
            padding: 2,
          }}
        >
          {(displayName || '').slice(0, 3).toUpperCase()}
        </span>
      )}
      {(state === 'p1' || state === 'p2') && (
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: state === 'p1' ? '#c9a227' : '#5aadf0',
            border: '1px solid rgba(0,0,0,0.5)',
          }}
        />
      )}
    </a>
  )
}

export function IconGrid({
  talents,
  emptyLabel,
}: {
  talents: { id: number; nodeId?: number; name?: string; state?: TalentIconState; cat?: string }[]
  emptyLabel?: string
}) {
  if (!talents || talents.length === 0) {
    return (
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--dim)', padding: '4px 0' }}>
        {emptyLabel || '—'}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {talents.map((t, i) => (
        <TalentIcon key={i} spellId={t.id} nodeId={t.nodeId} name={t.name} state={t.state} size={38} />
      ))}
    </div>
  )
}
