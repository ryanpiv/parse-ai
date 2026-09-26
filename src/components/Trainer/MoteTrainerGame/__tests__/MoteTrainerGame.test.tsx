/**
 * @jest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import MoteTrainerGame from '../MoteTrainerGame'

describe('MoteTrainerGame', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.runOnlyPendingTimers()
        jest.useRealTimers()
    })

    it('renders the cooldown manager bars', () => {
        render(<MoteTrainerGame />)
        expect(screen.getByTestId('MoteTrainerGame')).toBeInTheDocument()
        expect(screen.getByTestId('MoteTrainerGame-maelstrom')).toBeInTheDocument()
        expect(screen.getByTestId('MoteTrainerGame-procs')).toBeInTheDocument()
        expect(screen.getByTestId('MoteTrainerGame-cast-stormkeeper')).toBeInTheDocument()
        expect(screen.getByTestId('MoteTrainerGame-cooldowns')).toBeInTheDocument()
        expect(screen.getByTestId('MoteTrainerGame-cast-lava_burst')).toHaveAttribute(
            'aria-label',
            'Lava Burst, 2 of 2 charges',
        )
        expect(screen.getByTestId('TargetFrame-boss')).toHaveTextContent('Boss')
        expect(screen.queryByTestId('TargetFrame-debuff-boss-flame_shock')).not.toBeInTheDocument()
        expect(screen.getByTestId('MoteTrainerGame-timeline')).toBeInTheDocument()
        expect(screen.getByTestId('MoteTrainerGame-cast-flame_shock')).toHaveAttribute(
            'data-wh-spell',
            '188389',
        )
    })

    it('does not accept elemental blast when maelstrom cannot pay for it', () => {
        render(<MoteTrainerGame />)
        const blast = screen.getByTestId('MoteTrainerGame-cast-elemental_blast')
        expect(blast).toBeDisabled()
        fireEvent.click(blast)
        expect(screen.queryByTestId('MoteTrainerGame-miss')).not.toBeInTheDocument()
        expect(screen.getByTestId('MoteTrainerGame-gcd')).toHaveTextContent('1 / 239')
    })

    it('keeps the gcd after a wrong essential', () => {
        render(<MoteTrainerGame />)
        fireEvent.click(screen.getByTestId('MoteTrainerGame-cast-lightning_bolt'))
        expect(screen.getByTestId('MoteTrainerGame-miss')).toBeInTheDocument()
        expect(screen.getByTestId('MoteTrainerGame-gcd')).toHaveTextContent('1 / 239')
    })

    it('accepts the sim pick and advances after the delay', () => {
        render(<MoteTrainerGame />)
        fireEvent.click(screen.getByTestId('MoteTrainerGame-cast-stormkeeper'))
        expect(screen.getByTestId('MoteTrainerGame-hit')).toBeInTheDocument()
        act(() => {
            jest.advanceTimersByTime(800)
        })
        expect(screen.getByTestId('MoteTrainerGame-gcd')).toHaveTextContent('2 / 239')
    })
})
