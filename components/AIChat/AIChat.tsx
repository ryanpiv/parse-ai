import { useEffect, useRef, type ReactNode } from 'react'
import ui from '../../styles/ui.module.css'
import styles from './styles.module.css'
import FormatAI from './FormatAI'
import CopyBtn from './CopyBtn'

export type AIChatMessage = { role: string; content: string; usage?: { in: number; out: number } }

export type AIChatLiveStatus = { elapsedSec: number; inputTokens?: number; outputTokens?: number }

export type AIChatProps = {
    messages: AIChatMessage[]
    input: string
    onInputChange: (value: string) => void
    /** Sends `question` when given, otherwise the current input value. */
    onSend: (question?: string) => void
    aiLoading: boolean
    aiLiveStatus: AIChatLiveStatus | null
    inputPlaceholder: string
    /** Preset tiles rendered in the two-column grid above the input. */
    quickQuestions: ReactNode
}

interface IAssistantReplyProps {
    message: AIChatMessage
    isStreaming: boolean
    aiLiveStatus: AIChatLiveStatus | null
}

const TYPING_DOT_DELAYS_MS = [0, 200, 400]

const AssistantReply = ({ message, isStreaming, aiLiveStatus }: IAssistantReplyProps) => {
    const showTyping = isStreaming && !message.content.trim()
    const bubbleClass =
        showTyping || !message.content
            ? styles.assistantBubble
            : `${styles.assistantBubble} ${styles.assistantBubbleWithCopy}`

    return (
        <div className={styles.assistantWrap}>
            <div className={bubbleClass}>
                {showTyping ? (
                    <div className={styles.typingRow}>
                        {TYPING_DOT_DELAYS_MS.map((delayMs) => (
                            <div
                                key={delayMs}
                                className={styles.typingDot}
                                style={{ animationDelay: `${delayMs}ms` }}
                            />
                        ))}
                        <span className={styles.typingLabel}>
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
                        {message.content ? <FormatAI text={message.content} /> : null}
                        {isStreaming && message.content ? (
                            <span className={styles.streamCaret} aria-hidden>
                                ▍
                            </span>
                        ) : null}
                    </>
                )}
                {message.usage && !isStreaming ? (
                    <div className={styles.usageFooter}>
                        {message.usage.in.toLocaleString()} tokens in · {message.usage.out.toLocaleString()}{' '}
                        out
                    </div>
                ) : null}
            </div>
            {message.content && !showTyping ? (
                <div className={styles.copyCorner}>
                    <CopyBtn text={message.content} label="Copy" />
                </div>
            ) : null}
        </div>
    )
}

/** Ask Claude thread: scrolling message list, quick-question grid, and the ask input row. */
const AIChat = ({
    messages,
    input,
    onInputChange,
    onSend,
    aiLoading,
    aiLiveStatus,
    inputPlaceholder,
    quickQuestions,
}: AIChatProps) => {
    const chatRef = useRef<HTMLDivElement>(null)
    const lastUserMsgRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = chatRef.current
        if (!el || !lastUserMsgRef.current) return
        const msgTop = lastUserMsgRef.current.offsetTop
        el.scrollTo({ top: Math.max(0, msgTop - 12), behavior: aiLoading ? 'smooth' : 'auto' })
    }, [messages, aiLoading])

    return (
        <>
            <div ref={chatRef} className={styles.chatScroll}>
                {messages.length === 0 && !aiLoading && (
                    <div className={styles.emptyHint}>
                        No messages yet — try a quick question below or type your own.
                    </div>
                )}
                {messages.map((m, i) => {
                    const isLastUser =
                        m.role === 'user' && messages.slice(i + 1).every((x) => x.role !== 'user')
                    const isUser = m.role === 'user'
                    return (
                        <div
                            key={i}
                            ref={isLastUser ? lastUserMsgRef : null}
                            className={isUser ? styles.msgRowUser : styles.msgRowAssistant}
                        >
                            {isUser ? (
                                <div className={styles.userBubble}>{m.content}</div>
                            ) : (
                                <AssistantReply
                                    message={m}
                                    isStreaming={i === messages.length - 1 && aiLoading}
                                    aiLiveStatus={aiLiveStatus}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
            <div className={styles.quickLabel}>Quick questions:</div>
            <div className={styles.quickGrid}>{quickQuestions}</div>
            <div className={styles.inputRow}>
                <input
                    className={ui.input}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    placeholder={inputPlaceholder}
                    onKeyDown={(e) => e.key === 'Enter' && onSend()}
                    disabled={aiLoading}
                />
                <button type="button" className={ui.btnGold} onClick={() => onSend()} disabled={aiLoading}>
                    Ask
                </button>
            </div>
        </>
    )
}

export default AIChat
