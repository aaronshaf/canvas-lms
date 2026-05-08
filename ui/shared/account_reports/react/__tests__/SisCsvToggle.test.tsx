/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

// Verifies that SisCsvToggle restores the legacy inline-script behavior
// shipped from SIS CSV report parameter partials (provisioning_csv,
// sis_export_csv, etc.) after that script is stripped by the CFA-865
// DOMPurify wrapper at the RunReportForm dangerouslySetInnerHTML sink.

import {fireEvent, render, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RunReportForm from '../RunReportForm'
import fakeENV from '@canvas/test-utils/fakeENV'

// Minimal facsimile of a server-rendered SIS CSV report form — used for
// both provisioning_csv and sis_export_csv variants. The inline <script>
// is included to mirror what the server ships; sanitization removes it.
const makeFormHTML = (reportName: string) => `
  <form id="${reportName}_form" class="run_report_form" action="/api/v1/accounts/1/reports/${reportName}">
    <table>
      <tr><td><label class="checkbox">
        <input type="checkbox" name="parameters[users]" id="parameters_users" />
        Users CSV
      </label></td></tr>
      <tr><td><label class="checkbox">
        <input type="checkbox" name="parameters[courses]" id="parameters_courses" />
        Courses CSV
      </label></td></tr>
      <tr><td><label class="checkbox">
        <input type="checkbox" name="parameters[created_by_sis]" id="parameters_created_by_sis" disabled />
        Created by SIS
      </label></td></tr>
      <tr><td><label class="checkbox">
        <input type="checkbox" name="parameters[include_deleted]" id="parameters_include_deleted" disabled />
        Include Deleted/Concluded Objects
      </label></td></tr>
    </table>
    <script>window.__legacy_toggle_ran = true</script>
  </form>
`

const provisioningCsvFormHTML = makeFormHTML('provisioning_csv')

const baseProps = {
  formHTML: provisioningCsvFormHTML,
  path: '/api/v1/accounts/1/reports/provisioning_csv',
  reportName: 'provisioning_csv',
  closeModal: vi.fn(),
  onSuccess: vi.fn(),
}

describe('SisCsvToggle (via RunReportForm)', () => {
  beforeEach(() => {
    delete (window as any).__legacy_toggle_ran
    fakeENV.setup({TIMEZONE: 'America/Los_Angeles', LOCALE: 'en'})
  })
  afterEach(() => {
    delete (window as any).__legacy_toggle_ran
    fakeENV.teardown()
  })

  it('does not run the legacy inline <script> (defense-in-depth check)', () => {
    render(<RunReportForm {...baseProps} />)
    expect((window as any).__legacy_toggle_ran).toBeUndefined()
  })

  it('keeps dependents enabled when at least one controller is still checked', async () => {
    const user = userEvent.setup()
    const {getByLabelText} = render(<RunReportForm {...baseProps} />)

    const usersCsv = getByLabelText('Users CSV') as HTMLInputElement
    const coursesCsv = getByLabelText('Courses CSV') as HTMLInputElement
    const createdBySis = getByLabelText('Created by SIS') as HTMLInputElement

    await user.click(usersCsv)
    await user.click(coursesCsv)
    await waitFor(() => expect(createdBySis.disabled).toBe(false))

    await user.click(usersCsv)
    // courses still checked -> dependents stay enabled
    expect(createdBySis.disabled).toBe(false)
  })

  it('does not mount the toggle for unrelated reports', async () => {
    const user = userEvent.setup()
    // Same form HTML, but a reportName not in the SIS CSV list — the
    // toggle should not be wired, so dependents stay in their
    // server-rendered disabled=true state regardless of clicks.
    const {getByLabelText} = render(<RunReportForm {...baseProps} reportName="some_other_csv" />)

    const usersCsv = getByLabelText('Users CSV') as HTMLInputElement
    const createdBySis = getByLabelText('Created by SIS') as HTMLInputElement

    await user.click(usersCsv)
    // toggle is not active; nothing should re-enable createdBySis
    expect(createdBySis.disabled).toBe(true)
  })

  describe.each([{reportName: 'provisioning_csv'}, {reportName: 'sis_export_csv'}])(
    '$reportName',
    ({reportName}) => {
      const props = {
        formHTML: makeFormHTML(reportName),
        path: `/api/v1/accounts/1/reports/${reportName}`,
        reportName,
        closeModal: vi.fn(),
        onSuccess: vi.fn(),
      }

      it('starts with created_by_sis and include_deleted disabled', () => {
        const {getByLabelText} = render(<RunReportForm {...props} />)
        expect((getByLabelText('Created by SIS') as HTMLInputElement).disabled).toBe(true)
        expect(
          (getByLabelText('Include Deleted/Concluded Objects') as HTMLInputElement).disabled,
        ).toBe(true)
      })

      it('enables the dependent checkboxes when any controlling CSV is checked', async () => {
        const user = userEvent.setup()
        const {getByLabelText} = render(<RunReportForm {...props} />)

        await user.click(getByLabelText('Users CSV'))

        await waitFor(() => {
          expect((getByLabelText('Created by SIS') as HTMLInputElement).disabled).toBe(false)
          expect(
            (getByLabelText('Include Deleted/Concluded Objects') as HTMLInputElement).disabled,
          ).toBe(false)
        })
      })

      it('re-disables and unchecks the dependents when all controllers are unchecked', async () => {
        const user = userEvent.setup()
        const {getByLabelText} = render(<RunReportForm {...props} />)

        const usersCsv = getByLabelText('Users CSV') as HTMLInputElement
        const createdBySis = getByLabelText('Created by SIS') as HTMLInputElement
        const includeDeleted = getByLabelText(
          'Include Deleted/Concluded Objects',
        ) as HTMLInputElement

        await user.click(usersCsv)
        await waitFor(() => expect(createdBySis.disabled).toBe(false))

        await user.click(createdBySis)
        await user.click(includeDeleted)

        await user.click(usersCsv)

        await waitFor(() => {
          expect(createdBySis.disabled).toBe(true)
          expect(includeDeleted.disabled).toBe(true)
          expect(createdBySis.checked).toBe(false)
          expect(includeDeleted.checked).toBe(false)
        })
      })
    },
  )

  it('syncs initial state if the server-rendered form has a controller pre-checked', () => {
    const formHTMLWithPrecheck = provisioningCsvFormHTML.replace(
      '<input type="checkbox" name="parameters[users]" id="parameters_users" />',
      '<input type="checkbox" name="parameters[users]" id="parameters_users" checked />',
    )
    const {getByLabelText} = render(
      <RunReportForm {...baseProps} formHTML={formHTMLWithPrecheck} />,
    )
    // initial mount should run applyToggle once and lift disabled
    expect((getByLabelText('Created by SIS') as HTMLInputElement).disabled).toBe(false)
    expect((getByLabelText('Include Deleted/Concluded Objects') as HTMLInputElement).disabled).toBe(
      false,
    )
  })

  it('also responds to fireEvent.click (covers programmatic clicks)', () => {
    const {getByLabelText} = render(<RunReportForm {...baseProps} />)

    const usersCsv = getByLabelText('Users CSV') as HTMLInputElement
    const createdBySis = getByLabelText('Created by SIS') as HTMLInputElement

    fireEvent.click(usersCsv)
    expect(createdBySis.disabled).toBe(false)
  })
})
