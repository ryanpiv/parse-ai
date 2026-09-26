import { useEffect, useMemo, useState } from 'react'
import {
    answerCast,
    buildBoard,
    formatWowTimer,
    getReaction,
    indexAfterAnswer,
    isSpellEnabled,
    spellCooldown,
} from '../../../lib/moteTrainer/board'
import {
    AS_CD,
    ASC_CD,
    BLAST_COST,
    EB_CD,
    LVB_RECHARGE,
    MS_MAX,
    SK_CD,
    TRAINER_JUMPS,
} from '../../../lib/moteTrainer/constants'
import { getProcHud } from '../../../lib/moteTrainer/hud'
import {
    bindFromEvent,
    CAST_SPELLS,
    COOLDOWN_SPELLS,
    formatBind,
    iconUrl,
    PROC_ICONS,
    sameBind,
    SPENDER_SPELLS,
    type SpellIcon,
} from '../../../lib/moteTrainer/spells'
import { buildMoteEncounter } from '../../../lib/moteTrainer/encounter'
import { TRAINER_STEPS } from '../../../lib/moteTrainer/steps'
import TargetFrame from '../TargetFrame'
import styles from './styles.module.css'

const CD_MAX: Record<string, number> = {
    stormkeeper: SK_CD,
    ancestral_swiftness: AS_CD,
    ascendance: ASC_CD,
    elemental_blast: EB_CD,
    lava_burst: LVB_RECHARGE,
}

const ADVANCE_MS = 700

const CAST_COLOR: Record<string, string> = {
    lightning_bolt: '#7eb6ff',
    lava_burst: '#ff7a3c',
    elemental_blast: '#c9a0ff',
    flame_shock: '#ffb020',
    ancestral_swiftness: '#7dffb2',
    stormkeeper: '#6ecbff',
    ascendance: '#ff5a3c',
}

type CdmIconProps = {
    testId: string
    label: string
    icon: string
    spellId?: number
    active: boolean
    usable?: boolean
    timer: string | null
    swipePct: number
    stacks: number | null
    maxCharges?: number
    bind?: string
    tone?: 'ok' | 'bad' | 'idle'
    disabled?: boolean
    onClick?: () => void
}

const CdmIcon = ({
    testId,
    label,
    icon,
    spellId,
    active,
    usable = false,
    timer,
    swipePct,
    stacks,
    maxCharges,
    bind,
    tone = 'idle',
    disabled = false,
    onClick,
}: CdmIconProps) => {
    const [missingArt, setMissingArt] = useState(false)
    const Tag = onClick ? 'button' : 'div'
    const swipe = Math.max(0, Math.min(100, swipePct))
    const className = [
        styles.icon,
        onClick ? styles.iconButton : '',
        active ? styles.iconActive : styles.iconIdle,
        usable ? styles.iconUsable : '',
        tone === 'ok' ? styles.iconOk : '',
        tone === 'bad' ? styles.iconBad : '',
    ]
        .filter(Boolean)
        .join(' ')

    const chargeLabel = maxCharges && stacks !== null ? `${stacks} of ${maxCharges} charges` : undefined
    const slotted = Boolean(onClick)

    return (
        <div className={slotted ? styles.iconSlot : styles.iconWrap}>
            {slotted ? <span className={styles.iconBind}>{bind}</span> : null}
            <Tag
                type={onClick ? 'button' : undefined}
                data-testid={testId}
                data-wh-spell={spellId ? String(spellId) : undefined}
                data-wh-name={label}
                className={className}
                aria-label={chargeLabel ? `${label}, ${chargeLabel}` : label}
                aria-pressed={usable}
                disabled={onClick ? disabled : undefined}
                onClick={onClick}
            >
                {missingArt ? (
                    <span className={styles.iconFallback}>{label.slice(0, 2)}</span>
                ) : (
                    <img
                        className={styles.iconArt}
                        src={iconUrl(icon)}
                        alt=""
                        onError={() => setMissingArt(true)}
                    />
                )}
                {swipe > 0 ? (
                    <span
                        className={styles.iconSwipe}
                        style={{ ['--cd' as string]: String(swipe) }}
                        aria-hidden
                    />
                ) : null}
                {timer ? <span className={styles.iconTimer}>{timer}</span> : null}
                {stacks !== null ? <span className={styles.iconStacks}>{stacks}</span> : null}
            </Tag>
            {slotted ? (
                <span className={styles.chargePips} aria-hidden>
                    {maxCharges
                        ? Array.from({ length: maxCharges }, (_, pip) => (
                              <span
                                  key={pip}
                                  className={pip < (stacks ?? 0) ? styles.pipOn : styles.pipOff}
                              />
                          ))
                        : null}
                </span>
            ) : null}
        </div>
    )
}

const CastTimeline = ({ index }: { index: number }) => {
    const last = TRAINER_STEPS[TRAINER_STEPS.length - 1]
    const span = Math.max(last.t + last.dur, 1)
    const now = TRAINER_STEPS[index]
    const marks = [0]
    for (let t = 30; t < span; t += 30) marks.push(t)
    const lead = TRAINER_STEPS.slice(Math.max(0, index - 9), index + 1)

    return (
        <div className={styles.timeline} data-testid="MoteTrainerGame-timeline">
            <div className={styles.rowLabel}>Casts leading here</div>
            <div className={styles.track}>
                {TRAINER_STEPS.map((step, stepIndex) => (
                    <span
                        key={`${step.t}-${step.name}`}
                        className={stepIndex === index ? styles.tickNow : styles.tick}
                        style={{
                            left: `${(Math.max(step.t, 0) / span) * 100}%`,
                            background: CAST_COLOR[step.name] ?? '#8a9bb0',
                        }}
                    />
                ))}
                <span className={styles.playhead} style={{ left: `${(Math.max(now.t, 0) / span) * 100}%` }} />
            </div>
            <div className={styles.timeMarks}>
                {marks.map((t) => (
                    <span key={t} style={{ left: `${(t / span) * 100}%` }}>
                        {t}s
                    </span>
                ))}
            </div>
            <div className={styles.lead}>
                {lead.map((step) => {
                    const art = CAST_SPELLS.find((spell) => spell.id === step.name)
                    const current = step === now
                    return (
                        <div
                            key={`${step.t}-${step.name}`}
                            className={current ? styles.leadOn : styles.leadItem}
                            data-wh-spell={art?.spellId ? String(art.spellId) : undefined}
                            data-wh-name={step.label}
                        >
                            {art ? <img src={iconUrl(art.icon)} alt="" /> : null}
                            <span>{step.t.toFixed(0)}s</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const MaelstromBar = ({ ms }: { ms: number }) => {
    const pct = Math.max(0, Math.min(100, (ms / MS_MAX) * 100))
    const mark = (BLAST_COST / MS_MAX) * 100
    return (
        <div className={styles.resource} data-testid="MoteTrainerGame-maelstrom">
            <div className={styles.resourceTrack}>
                <div className={styles.resourceFill} style={{ width: `${pct}%` }} />
                <div className={styles.resourceMark} style={{ left: `${mark}%` }} />
                <div className={styles.resourceLabel}>
                    {ms} / {MS_MAX}
                </div>
            </div>
            <div className={styles.resourceName}>Maelstrom</div>
        </div>
    )
}

const goToFlags = () => ({
    resolved: false,
    missed: false,
    guess: '',
})

const MoteTrainerGame = () => {
    const [step, setStep] = useState(0)
    const [hits, setHits] = useState(0)
    const [asked, setAsked] = useState(0)
    const [resolved, setResolved] = useState(false)
    const [missed, setMissed] = useState(false)
    const [guess, setGuess] = useState('')

    const last = TRAINER_STEPS.length - 1
    const done = step >= TRAINER_STEPS.length
    const i = done ? last : Math.min(Math.max(step, 0), last)
    const now = TRAINER_STEPS[i]
    const board = useMemo(() => buildBoard(TRAINER_STEPS, i), [i])
    const procs = useMemo(() => getProcHud(board), [board])
    const answer = answerCast(now, board)
    const reaction = getReaction(board, answer)
    const hitText =
        answer === now.name
            ? `${now.label} — ${now.why}`
            : 'Lava Burst — Lava Burst applies MotE (Master of the Elements). Elemental Blast spends it next.'
    const pct = asked === 0 ? '—' : `${Math.round((hits / asked) * 100)}%`

    const jump = (index: number) => {
        setStep(index)
        const flags = goToFlags()
        setResolved(flags.resolved)
        setMissed(flags.missed)
        setGuess(flags.guess)
    }

    const pick = (name: string) => {
        if (done || resolved) return
        setGuess(name)
        if (name === answer) {
            if (!missed) setHits((n) => n + 1)
            setAsked((n) => n + 1)
            setResolved(true)
            return
        }
        setMissed(true)
    }

    useEffect(() => {
        if (!resolved || done) return
        const id = window.setTimeout(() => {
            jump(indexAfterAnswer(TRAINER_STEPS, step, answer))
        }, ADVANCE_MS)
        return () => window.clearTimeout(id)
    }, [resolved, done, step])

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const pressed = bindFromEvent(event)
            if (!pressed) return
            const spell = CAST_SPELLS.find((s) => s.bind && sameBind(s.bind, pressed))
            if (!spell || !isSpellEnabled(spell.id, board)) return
            event.preventDefault()
            pick(spell.id)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    const iconTone = (name: string): 'ok' | 'bad' | 'idle' => {
        if (resolved && name === answer) return 'ok'
        if (missed && guess === name && name !== answer) return 'bad'
        return 'idle'
    }

    const encounter = buildMoteEncounter(board)

    const renderCast = (spell: SpellIcon) => {
        const cd = spellCooldown(spell.id, board)
        const max = CD_MAX[spell.id] ?? 1
        const swipe = cd.ready ? 0 : Math.min(100, (cd.remains / max) * 100)
        const timer = cd.ready ? null : formatWowTimer(cd.remains)
        const enabled = isSpellEnabled(spell.id, board)
        const isBurst = spell.id === 'lava_burst'
        const stacks = isBurst
            ? board.lvbCharges
            : spell.id === 'stormkeeper' && board.sk > 0
              ? board.sk
              : null
        return (
            <CdmIcon
                key={spell.id}
                testId={`MoteTrainerGame-cast-${spell.id}`}
                label={spell.label}
                icon={spell.icon}
                spellId={spell.spellId}
                active={enabled}
                usable={enabled && !resolved}
                disabled={!enabled || resolved}
                timer={timer}
                swipePct={isBurst && board.lvbCharges > 0 ? 0 : swipe}
                stacks={stacks}
                maxCharges={isBurst ? board.lvbChargeMax : undefined}
                bind={spell.bind ? formatBind(spell.bind) : undefined}
                tone={iconTone(spell.id)}
                onClick={() => pick(spell.id)}
            />
        )
    }

    return (
        <div className={styles.game} data-testid="MoteTrainerGame">
            <div className={styles.meta}>
                <span data-testid="MoteTrainerGame-gcd">
                    {done ? 'Done' : `${i + 1} / ${TRAINER_STEPS.length}`}
                </span>
                <span>
                    {hits} / {asked} · {pct}
                </span>
                <span>{done ? `${TRAINER_STEPS[last].t.toFixed(0)}s` : `${now.t.toFixed(1)}s`}</span>
                <span className={styles.phase}>{board.phase}</span>
            </div>

            <div className={styles.jumps}>
                {TRAINER_JUMPS.map((j) => (
                    <button
                        key={j.id}
                        type="button"
                        className={`${styles.jump} ${!done && i === j.index ? styles.jumpOn : ''}`}
                        onClick={() => jump(j.index)}
                    >
                        {j.label}
                    </button>
                ))}
            </div>

            <CastTimeline index={i} />

            {done ? (
                <p className={styles.done} data-testid="MoteTrainerGame-done">
                    {hits} of {asked} correct on the first try ({pct}).
                </p>
            ) : (
                <div className={styles.hud}>
                    <TargetFrame encounter={encounter} />

                    <div className={styles.rowLabel}>Procs</div>
                    <div className={styles.procRow} data-testid="MoteTrainerGame-procs">
                        {procs
                            .filter((proc) => proc.active && proc.id !== 'flame_shock_dot')
                            .map((proc) => {
                                const art = PROC_ICONS.find((p) => p.id === proc.id)
                                if (!art) return null
                                return (
                                    <CdmIcon
                                        key={proc.id}
                                        testId={`MoteTrainerGame-proc-${proc.id}`}
                                        label={art.label}
                                        icon={art.icon}
                                        spellId={art.spellId}
                                        active
                                        timer={proc.timer}
                                        swipePct={0}
                                        stacks={proc.stacks}
                                    />
                                )
                            })}
                    </div>

                    <div className={styles.rowLabel}>Spenders</div>
                    <div className={styles.castRow} data-testid="MoteTrainerGame-casts">
                        {SPENDER_SPELLS.map((spell) => renderCast(spell))}
                    </div>
                    <div className={styles.rowLabel}>Cooldowns</div>
                    <div className={styles.castRow} data-testid="MoteTrainerGame-cooldowns">
                        {COOLDOWN_SPELLS.map((spell) => renderCast(spell))}
                    </div>

                    <MaelstromBar ms={board.ms} />

                    <div className={styles.cueSlot}>
                        <p className={styles.cue} data-testid="MoteTrainerGame-cue">
                            <strong>{reaction.title}.</strong> {reaction.body}
                        </p>
                    </div>
                    <div className={styles.feedbackSlot}>
                        {missed && !resolved ? (
                            <p className={styles.miss} data-testid="MoteTrainerGame-miss">
                                Wrong spell. Check the procs and cooldowns.
                            </p>
                        ) : null}
                        {resolved ? (
                            <p className={styles.hit} data-testid="MoteTrainerGame-hit">
                                {hitText}
                            </p>
                        ) : null}
                    </div>
                </div>
            )}

            <div className={styles.controls}>
                <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => jump(Math.max(0, i - 1))}
                    disabled={i === 0 && !done}
                >
                    Back
                </button>
                <button
                    type="button"
                    className={styles.ghost}
                    data-testid="MoteTrainerGame-restart"
                    onClick={() => {
                        jump(0)
                        setHits(0)
                        setAsked(0)
                    }}
                >
                    Restart
                </button>
            </div>
        </div>
    )
}

export default MoteTrainerGame
