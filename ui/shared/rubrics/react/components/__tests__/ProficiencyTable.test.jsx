/*
 * Copyright (C) 2018 - present Instructure, Inc.
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

/*
  TODO: Duplicated and modified within jsx/outcomes/MasteryScale for use there
        Remove when feature flag account_level_mastery_scales is enabled
*/

import $ from 'jquery'
import React from 'react'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {render, waitFor, fireEvent} from '@testing-library/react'
import ProficiencyTable from '../ProficiencyTable'

const PROFICIENCY_URL = '/api/v1/accounts/1/outcome_proficiency'

// Default handler: 404 means no custom ratings (show billboard)
const server = setupServer(http.get(PROFICIENCY_URL, () => new HttpResponse(null, {status: 404})))

// Suppress the validateDOMNesting warning for this test suite
// The ProficiencyTable uses Flex.Item with as="th" which causes this warning
const originalError = console.error
beforeAll(() => {
  server.listen()
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('validateDOMNesting')) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  server.close()
  console.error = originalError
})

// Mock HTMLElement.focus to prevent focus errors in tests
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'focus', {configurable: true, value: vi.fn()})
  vi.useFakeTimers()
})

afterEach(() => {
  server.resetHandlers()
  vi.useRealTimers()
})

async function wait(ms = 0) {
  if (ms > 0) {
    vi.advanceTimersByTime(ms)
  }
  // Allow promises to resolve
  await Promise.resolve()
}

const defaultProps = {
  accountId: '1',
}

describe('default proficiency', () => {
  it('renders loading spinner initially', () => {
    const {getByText} = render(<ProficiencyTable {...defaultProps} />)
    expect(getByText('Loading')).toBeInTheDocument()
  })

  it('render billboard after loading', async () => {
    const {getByText} = render(<ProficiencyTable {...defaultProps} />)
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
  })
  it('renders five ratings', async () => {
    const {getAllByRole, getByText} = render(<ProficiencyTable {...defaultProps} />)

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    await waitFor(() => {
      const checkboxes = getAllByRole('radio')
      expect(checkboxes).toHaveLength(5) // Each rating has a mastery radio button
    })
  })

  it('has mastery selected on first rating only', async () => {
    const {getAllByRole, getByText} = render(<ProficiencyTable {...defaultProps} />)

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    await waitFor(() => {
      const masteryRadios = getAllByRole('radio')
      expect(masteryRadios).toHaveLength(5)
      // Default mastery index is 1 (second rating)
      expect(masteryRadios[0]).not.toBeChecked()
      expect(masteryRadios[1]).toBeChecked()
      expect(masteryRadios[2]).not.toBeChecked()
      expect(masteryRadios[3]).not.toBeChecked()
      expect(masteryRadios[4]).not.toBeChecked()
    })
  })

  it('clicking add button adds rating', async () => {
    const {getAllByRole, getByText, getByRole} = render(<ProficiencyTable {...defaultProps} />)

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    // Wait for table to render
    await waitFor(() => {
      expect(getByText('Proficiency Rating')).toBeInTheDocument()
    })

    const initialRadios = getAllByRole('radio')
    expect(initialRadios).toHaveLength(5)

    // Click add button
    const addButton = getByRole('button', {name: 'Add proficiency rating'})
    fireEvent.click(addButton)

    await waitFor(() => {
      const newRadios = getAllByRole('radio')
      expect(newRadios).toHaveLength(6)
    })
  })

  it('clicking add rating button flashes SR message', async () => {
    const {getByText, getByRole} = render(<ProficiencyTable {...defaultProps} />)
    const flashMock = vi.spyOn($, 'screenReaderFlashMessage')

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    // Wait for table to render
    await waitFor(() => {
      expect(getByText('Proficiency Rating')).toBeInTheDocument()
    })

    const addButton = getByRole('button', {name: 'Add proficiency rating'})
    fireEvent.click(addButton)

    expect(flashMock).toHaveBeenCalledTimes(1)
    flashMock.mockRestore()
  })

  it('deleting rating removes rating and flashes SR message', async () => {
    const {getAllByRole, getByText} = render(<ProficiencyTable {...defaultProps} />)
    const flashMock = vi.spyOn($, 'screenReaderFlashMessage')

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    await waitFor(() => {
      const initialRadios = getAllByRole('radio')
      expect(initialRadios).toHaveLength(5)
    })

    const deleteButtons = getAllByRole('button', {name: /delete proficiency rating/i})
    fireEvent.click(deleteButtons[1])

    await waitFor(() => {
      const newRadios = getAllByRole('radio')
      expect(newRadios).toHaveLength(4)
    })
    expect(flashMock).toHaveBeenCalledTimes(1)
    flashMock.mockRestore()
  })

  it('setting blank description sets error', async () => {
    const {getByText, getAllByRole} = render(<ProficiencyTable {...defaultProps} />)

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    // Wait for inputs to be rendered
    await waitFor(() => {
      expect(getByText('Proficiency Rating')).toBeInTheDocument()
    })

    // Clear first rating description
    const descriptionInputs = getAllByRole('textbox', {name: /change description/i})
    const firstInput = descriptionInputs[0]
    fireEvent.change(firstInput, {target: {value: ''}})
    fireEvent.blur(firstInput)

    // Submit form
    const saveButton = getByText('Save Learning Mastery')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(getByText(/Please include a rating title/)).toBeInTheDocument()
    })
  })

  it('setting blank points sets error', async () => {
    const {getByText, getAllByLabelText} = render(<ProficiencyTable {...defaultProps} />)

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    // Clear first rating points
    const pointsInputs = getAllByLabelText(/Change points/)
    const firstInput = pointsInputs[0]
    firstInput.focus()
    firstInput.select()
    fireEvent.input(firstInput, {target: {value: ''}})

    // Submit form
    const saveButton = getByText('Save Learning Mastery')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(getByText(/Invalid format/)).toBeInTheDocument()
    })
  })

  it('setting invalid points sets error', async () => {
    const {getByText, getAllByLabelText} = render(<ProficiencyTable {...defaultProps} />)

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    // Set invalid points
    const pointsInputs = getAllByLabelText(/Change points/)
    const firstInput = pointsInputs[0]
    firstInput.focus()
    firstInput.select()
    fireEvent.input(firstInput, {target: {value: '1.1.1'}})

    // Submit form
    const saveButton = getByText('Save Learning Mastery')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(getByText(/Invalid format/)).toBeInTheDocument()
    })
  })

  it('setting negative points sets error', async () => {
    const {getByText, getAllByLabelText} = render(<ProficiencyTable {...defaultProps} />)

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    // Set negative points
    const pointsInputs = getAllByLabelText(/Change points/)
    const firstInput = pointsInputs[0]
    firstInput.focus()
    firstInput.select()
    fireEvent.input(firstInput, {target: {value: '-1'}})

    // Submit form
    const saveButton = getByText('Save Learning Mastery')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(getByText(/Negative points/)).toBeInTheDocument()
    })
  })

  it('sends POST on submit', async () => {
    let resolveCapture
    const capturePromise = new Promise(res => {
      resolveCapture = res
    })
    server.use(
      http.post(PROFICIENCY_URL, async () => {
        resolveCapture()
        return HttpResponse.json({})
      }),
    )

    const {getByText} = render(<ProficiencyTable {...defaultProps} />)

    await wait(1)

    // Wait for billboard and close it
    await waitFor(() => {
      expect(getByText('Customize Learning Mastery Ratings')).toBeInTheDocument()
    })
    const getStartedButton = getByText('Get Started')
    fireEvent.click(getStartedButton)

    // Submit form
    const saveButton = getByText('Save Learning Mastery')
    fireEvent.click(saveButton)

    // Ensure that the POST request was made
    await capturePromise
  })

  // Tests for error validation are covered by the UI interaction tests above
})

describe('custom proficiency', () => {
  it('renders two ratings that are deletable', async () => {
    server.use(
      http.get(PROFICIENCY_URL, () =>
        HttpResponse.json({
          ratings: [
            {
              description: 'Great',
              points: 10,
              color: '0000ff',
              mastery: true,
            },
            {
              description: 'Poor',
              points: 0,
              color: 'ff0000',
              mastery: false,
            },
          ],
        }),
      ),
    )

    const {getAllByRole} = render(<ProficiencyTable {...defaultProps} />)

    await waitFor(() => {
      const radios = getAllByRole('radio')
      expect(radios).toHaveLength(2)
    })

    const deleteButtons = getAllByRole('button', {name: /delete proficiency rating/i})
    expect(deleteButtons).toHaveLength(2)
  })

  it('renders one rating that is not deletable', async () => {
    server.use(
      http.get(PROFICIENCY_URL, () =>
        HttpResponse.json({
          ratings: [
            {
              description: 'Uno',
              points: 1,
              color: '0000ff',
              mastery: true,
            },
          ],
        }),
      ),
    )

    const {getAllByRole, queryAllByLabelText} = render(<ProficiencyTable {...defaultProps} />)

    await waitFor(() => {
      const radios = getAllByRole('radio')
      expect(radios).toHaveLength(1)
    })

    const deleteButtons = queryAllByLabelText('Delete proficiency rating')
    expect(deleteButtons).toHaveLength(0)
  })
})
