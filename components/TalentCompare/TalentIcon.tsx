import { useEffect, useRef } from 'react'
import { _nodeMap } from '../../lib/talents/nodeResolution'
import styles from './styles.module.css'

export type TalentIconState = 'p1' | 'p2' | 'both' | 'neither'

export type TalentIconProps = {
    spellId: number
    nodeId?: number
    name?: string
    state?: TalentIconState
    size?: number
}

const TalentIcon = ({ spellId, nodeId, name, state, size = 40 }: TalentIconProps) => {
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
            className={styles.talentIcon}
            style={{
                width: size,
                height: size,
                borderColor,
                background: iconUrl ? 'transparent' : '#1e252e',
                opacity,
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
                    className={styles.talentIconImg}
                    onError={(e) => {
                        e.currentTarget.style.display = 'none'
                    }}
                />
            ) : (
                <span className={styles.talentIconInitials}>
                    {(displayName || '').slice(0, 3).toUpperCase()}
                </span>
            )}
            {(state === 'p1' || state === 'p2') && (
                <div
                    className={styles.talentIconDot}
                    style={{ background: state === 'p1' ? '#c9a227' : '#5aadf0' }}
                />
            )}
        </a>
    )
}

/** Secondary component — kept a named export; splitting it into its own file is disproportionate. */
export const IconGrid = ({
    talents,
    emptyLabel,
}: {
    talents: { id: number; nodeId?: number; name?: string; state?: TalentIconState; cat?: string }[]
    emptyLabel?: string
}) => {
    if (!talents || talents.length === 0) {
        return <div className={styles.iconGridEmpty}>{emptyLabel || '—'}</div>
    }
    return (
        <div className={styles.iconGrid}>
            {talents.map((t, i) => (
                <TalentIcon
                    key={i}
                    spellId={t.id}
                    nodeId={t.nodeId}
                    name={t.name}
                    state={t.state}
                    size={38}
                />
            ))}
        </div>
    )
}

export default TalentIcon
