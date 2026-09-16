import { useEffect, useRef, type ReactNode } from 'react'
import ui from '../../../styles/ui.module.css'
import styles from './styles.module.css'

export type KeyFieldProps = {
    label: string
    value: string
    onChange: (value: string) => void
    onSave: () => void
    saved: boolean
    savedText?: string
    placeholder?: string
    buttonLabel?: string
    note?: ReactNode
    /** Briefly glow + focus the input (used when another part of the app sends the user here). */
    highlight?: boolean
}

/**
 * Settings row for a secret: password input + Save button.
 * When a value is saved the field shows masked dots and a green status check.
 */
const KeyField = ({
    label,
    value,
    onChange,
    onSave,
    saved,
    savedText = 'Saved',
    placeholder,
    buttonLabel = 'Save',
    note,
    highlight = false,
}: KeyFieldProps) => {
    const inputRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (highlight) inputRef.current?.focus()
    }, [highlight])
    return (
        <div>
            <div className={styles.row}>
                <div className={ui.field}>
                    <label className={`${ui.label} ${styles.labelRow}`}>
                        {label}
                        {saved && <span className={styles.savedCheck}>✓ {savedText}</span>}
                    </label>
                    <input
                        ref={inputRef}
                        className={highlight ? `${ui.input} ${ui.keyGlow}` : ui.input}
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSave()}
                        placeholder={saved ? '••••••••••••••••' : placeholder}
                    />
                </div>
                <div className={styles.buttonColumn}>
                    <button type="button" className={ui.btnGold} onClick={onSave}>
                        {buttonLabel}
                    </button>
                </div>
            </div>
            {note ? <div className={ui.note}>{note}</div> : null}
        </div>
    )
}

export default KeyField
