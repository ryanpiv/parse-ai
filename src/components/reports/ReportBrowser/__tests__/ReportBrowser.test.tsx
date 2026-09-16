/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ReportBrowser from '../ReportBrowser'
import { resetReportsBrowserSession } from '../reportsBrowserCache'
import { fetchCurrentUser, fetchReportPage } from '../../../../lib/wclReports'

jest.mock('next/router', () => ({
    useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('../../../../contexts/FightAnalysisContext', () => ({
    useFightAnalysis: () => ({
        authStatus: 'ok',
        loading: false,
        loadCompare: jest.fn(),
    }),
}))

jest.mock('../../../../lib/wclReports', () => {
    const actual = jest.requireActual('../../../../lib/wclReports')
    return {
        ...actual,
        fetchCurrentUser: jest.fn(),
        fetchReportPage: jest.fn(),
        fetchReportFights: jest.fn(),
    }
})

const fetchCurrentUserMock = fetchCurrentUser as jest.MockedFunction<typeof fetchCurrentUser>
const fetchReportPageMock = fetchReportPage as jest.MockedFunction<typeof fetchReportPage>

describe('ReportBrowser', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        resetReportsBrowserSession()
        fetchCurrentUserMock.mockResolvedValue({ id: 1, name: 'Ryan', guilds: [] })
        fetchReportPageMock.mockResolvedValue({
            reports: [
                {
                    code: 'Abc12',
                    title: 'raid night',
                    startTime: 1,
                    endTime: 2,
                    zoneName: 'Zone',
                    ownerName: 'Ryan',
                },
            ],
            page: 1,
            hasMore: false,
            total: 1,
        })
    })

    it('reuses the cached report list after remount instead of refetching', async () => {
        const { unmount } = render(<ReportBrowser />)
        await waitFor(() => expect(screen.getByText('raid night')).toBeInTheDocument())
        expect(fetchCurrentUserMock).toHaveBeenCalledTimes(1)
        expect(fetchReportPageMock).toHaveBeenCalledTimes(1)

        unmount()
        render(<ReportBrowser />)

        expect(screen.getByTestId('ReportBrowser')).toBeInTheDocument()
        expect(screen.getByText('raid night')).toBeInTheDocument()
        expect(fetchCurrentUserMock).toHaveBeenCalledTimes(1)
        expect(fetchReportPageMock).toHaveBeenCalledTimes(1)
    })

    it('refetches the current page when refresh is clicked', async () => {
        render(<ReportBrowser />)
        await waitFor(() => expect(screen.getByText('raid night')).toBeInTheDocument())

        fireEvent.click(screen.getByTestId('ReportBrowser-refresh'))

        await waitFor(() => expect(fetchReportPageMock).toHaveBeenCalledTimes(2))
        expect(screen.getByText('raid night')).toBeInTheDocument()
    })
})
