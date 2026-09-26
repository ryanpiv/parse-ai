/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react'
import TargetFrame from '../TargetFrame'
import type { TrainerEncounter } from '../../../../lib/trainer/encounter'

const encounter = (debuffs: TrainerEncounter['targets'][0]['debuffs']): TrainerEncounter => ({
    mode: 'single',
    targets: [{ id: 'boss', name: 'Boss', debuffs }],
})

describe('TargetFrame', () => {
    it('shows the boss with no debuff icons when nothing is applied', () => {
        render(<TargetFrame encounter={encounter([])} />)
        expect(screen.getByTestId('TargetFrame')).toHaveAttribute('data-mode', 'single')
        expect(screen.getByTestId('TargetFrame-boss')).toHaveTextContent('Boss')
        expect(screen.queryByTestId('TargetFrame-debuff-boss-flame_shock')).not.toBeInTheDocument()
    })

    it('shows a debuff timer on the boss', () => {
        render(
            <TargetFrame
                encounter={encounter([
                    {
                        id: 'flame_shock',
                        label: 'Flame Shock',
                        icon: 'spell_fire_flameshock',
                        spellId: 188389,
                        remains: 17.2,
                        stacks: null,
                    },
                ])}
            />,
        )
        expect(screen.getByTestId('TargetFrame-debuff-boss-flame_shock')).toHaveAttribute(
            'aria-label',
            'Flame Shock, 17 seconds',
        )
    })

    it('renders one plate per target', () => {
        const cleave: TrainerEncounter = {
            mode: 'cleave',
            targets: [
                { id: 'boss', name: 'Boss', debuffs: [] },
                { id: 'add', name: 'Add', debuffs: [] },
            ],
        }
        render(<TargetFrame encounter={cleave} />)
        expect(screen.getByTestId('TargetFrame-boss')).toBeInTheDocument()
        expect(screen.getByTestId('TargetFrame-add')).toBeInTheDocument()
        expect(screen.getByTestId('TargetFrame')).toHaveAttribute('data-mode', 'cleave')
    })
})
