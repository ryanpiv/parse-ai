import { useState } from 'react'
import {
    encounterModeLabel,
    formatDebuffTimer,
    wowIconUrl,
    type TargetDebuff,
    type TrainerEncounter,
} from '../../../lib/trainer/encounter'
import styles from './styles.module.css'

export type TargetFrameProps = {
    encounter: TrainerEncounter
}

const DebuffIcon = ({ targetId, debuff }: { targetId: string; debuff: TargetDebuff }) => {
    const [missingArt, setMissingArt] = useState(false)
    const timer = formatDebuffTimer(debuff.remains)

    return (
        <div
            className={styles.debuff}
            data-testid={`TargetFrame-debuff-${targetId}-${debuff.id}`}
            data-wh-spell={debuff.spellId ? String(debuff.spellId) : undefined}
            data-wh-name={debuff.label}
            aria-label={`${debuff.label}, ${timer} seconds`}
        >
            {missingArt ? (
                <span className={styles.fallback}>{debuff.label.slice(0, 2)}</span>
            ) : (
                <img src={wowIconUrl(debuff.icon)} alt="" onError={() => setMissingArt(true)} />
            )}
            <span className={styles.timer}>{timer}</span>
            {debuff.stacks !== null ? <span className={styles.stacks}>{debuff.stacks}</span> : null}
        </div>
    )
}

const TargetFrame = ({ encounter }: TargetFrameProps) => {
    return (
        <div className={styles.frame} data-testid="TargetFrame" data-mode={encounter.mode}>
            <div className={styles.mode}>{encounterModeLabel(encounter.mode)}</div>
            <div className={styles.plates}>
                {encounter.targets.map((target) => (
                    <div key={target.id} className={styles.plate} data-testid={`TargetFrame-${target.id}`}>
                        <div className={styles.name}>{target.name}</div>
                        <div className={styles.debuffs}>
                            {target.debuffs.map((debuff) => (
                                <DebuffIcon key={debuff.id} targetId={target.id} debuff={debuff} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default TargetFrame
