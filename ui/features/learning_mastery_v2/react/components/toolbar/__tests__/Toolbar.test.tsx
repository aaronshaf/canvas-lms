/*
 * Copyright (C) 2025 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */
import {cleanup, render, screen, waitFor, fireEvent} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {Toolbar, ToolbarProps, buildCsvExportHandler} from '../Toolbar'
import {DEFAULT_GRADEBOOK_SETTINGS} from '@canvas/outcomes/react/utils/constants'
import {mapSettingsToFilters} from '@canvas/outcomes/react/utils/filter'
import * as apiClient from '../../../apiClient'

vi.mock('../../../apiClient', () => ({
  exportCSV: vi.fn().mockResolvedValue({text: 'student,score\nAlice,4'}),
}))

const makeProps = (props = {}): ToolbarProps => ({
  courseId: '123',
  showDataDependentControls: true,
  gradebookSettings: DEFAULT_GRADEBOOK_SETTINGS,
  setGradebookSettings: vi.fn(),
  ...props,
})

describe('Toolbar', () => {
  it('renders the gradebook menu and title', () => {
    const {getByTestId, getByText} = render(<Toolbar {...makeProps()} />)
    expect(getByTestId('lmgb-gradebook-menu')).toBeInTheDocument()
    expect(getByText('Learning Mastery Gradebook')).toBeInTheDocument()
  })

  it('renders the ExportCSVButton', () => {
    const {getByTestId} = render(<Toolbar {...makeProps()} />)
    expect(getByTestId('export-button')).toBeInTheDocument()
    expect(getByTestId('export-button')).toHaveTextContent('Export')
  })

  it('renders the settings button', () => {
    const {getByTestId} = render(<Toolbar {...makeProps()} />)
    expect(getByTestId('lmgb-settings-button')).toBeInTheDocument()
  })

  it('opens and closes the SettingsTray when settings button is clicked', async () => {
    const {getByTestId, queryByTestId} = render(<Toolbar {...makeProps()} />)
    expect(queryByTestId('lmgb-settings-tray')).toBeNull()
    fireEvent.click(getByTestId('lmgb-settings-button'))
    await waitFor(() => expect(getByTestId('lmgb-settings-tray')).toBeInTheDocument())
    fireEvent.click(getByTestId('lmgb-close-settings-button').querySelector('button')!)
    // InstUI Tray remains in DOM with transition class, check for exited state
    await waitFor(() => {
      const tray = queryByTestId('lmgb-settings-tray')
      expect(tray?.classList.contains('transition--slide-right-exited')).toBe(true)
    })
  })

  it('calls exportCSV with courseId and mapped filters when export button is clicked', async () => {
    const user = userEvent.setup()
    render(<Toolbar {...makeProps()} />)
    await user.click(screen.getByTestId('export-button'))
    await waitFor(() =>
      expect(apiClient.exportCSV).toHaveBeenCalledWith(
        '123',
        mapSettingsToFilters(DEFAULT_GRADEBOOK_SETTINGS),
      ),
    )
  })

  it('buildCsvExportHandler resolves to the CSV text returned by exportCSV', async () => {
    const handler = buildCsvExportHandler('123', ['filter1'])
    const result = await handler()
    expect(result).toBe('student,score\nAlice,4')
  })

  it('hides data-dependent controls when showDataDependentControls is false', () => {
    const {queryByTestId} = render(<Toolbar {...makeProps({showDataDependentControls: false})} />)
    expect(queryByTestId('export-button')).toBeNull()
    expect(queryByTestId('lmgb-settings-button')).toBeNull()
  })

  it('shows data-dependent controls when showDataDependentControls is true', () => {
    const {getByTestId} = render(<Toolbar {...makeProps({showDataDependentControls: true})} />)
    expect(getByTestId('export-button')).toBeInTheDocument()
    expect(getByTestId('lmgb-settings-button')).toBeInTheDocument()
  })
})
