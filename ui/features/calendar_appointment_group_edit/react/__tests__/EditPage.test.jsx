/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import $ from 'jquery'
import React from 'react'
import {render, waitFor, fireEvent, screen as testScreen} from '@testing-library/react'
import EditPage from '../EditPage'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import MessageParticipantsDialog from '@canvas/calendar/jquery/MessageParticipantsDialog'
import {assignLocation} from '@canvas/util/globalUtils'

vi.mock('@canvas/calendar/jquery/MessageParticipantsDialog')
vi.mock('@canvas/util/globalUtils', () => ({
  assignLocation: vi.fn(),
}))

// Mock jQuery dialog and form methods
$.fn.dialog = vi.fn()
$.fn.errorBox = vi.fn()
$.fn.getClientRects = () => [{top: 0, left: 0}]
$.fn.offset = () => ({top: 0, left: 0})
$.fn.position = () => ({top: 0, left: 0})
$.fn.val = vi.fn().mockReturnValue('')
$.flashError = vi.fn()

const defaultProps = {
  appointment_group_id: '1',
}

const mockAppointmentGroup = {
  id: '1',
  title: 'Test Group',
  description: 'Test Description',
  location_name: 'Test Location',
  participants_per_appointment: 1,
  participant_visibility: 'private',
  max_appointments_per_participant: 1,
  context_codes: ['course_1'],
  sub_context_codes: [],
  workflow_state: 'active',
  requiring_action: false,
  appointments_count: 0,
  user_color: null,
  context_color: null,
  appointments: [],
}

const mockContexts = {
  contexts: [
    {
      asset_string: 'course_1',
      name: 'Test Course',
      allow_observers_in_appointment_groups: true,
    },
  ],
}

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

describe('AppointmentGroup EditPage', () => {
  beforeEach(() => {
    MessageParticipantsDialog.mockImplementation(function () {
      return {show: vi.fn()}
    })
    server.use(
      http.get('/api/v1/appointment_groups/1', () => HttpResponse.json(mockAppointmentGroup)),
      http.get('/api/v1/calendar_events/visible_contexts', () => HttpResponse.json(mockContexts)),
    )
  })

  it('renders the EditPage component', async () => {
    render(<EditPage {...defaultProps} />)
    await waitFor(() => {
      expect(testScreen.getByTestId('edit-page')).toBeInTheDocument()
    })
  })

  describe('API Interactions', () => {
    it('fetches appointment group data on mount', async () => {
      render(<EditPage {...defaultProps} />)
      await waitFor(() => {
        expect(testScreen.getByDisplayValue('Test Group')).toBeInTheDocument()
      })
    })

    it('fetches calendar events data on mount', async () => {
      render(<EditPage {...defaultProps} />)
      await waitFor(() => {
        expect(testScreen.getByTestId('edit-page')).toBeInTheDocument()
      })
    })
  })

  describe('Message Users', () => {
    it('renders message users button', async () => {
      render(<EditPage {...defaultProps} />)
      await waitFor(() => {
        expect(testScreen.getByText('Message Students')).toBeInTheDocument()
      })
    })

    it('opens message students modal when clicking button', async () => {
      render(<EditPage {...defaultProps} />)
      await waitFor(() => {
        const messageButton = testScreen.getByText('Message Students')
        fireEvent.click(messageButton)
        expect(MessageParticipantsDialog).toHaveBeenCalledWith({
          group: expect.any(Object),
          dataSource: expect.any(Object),
        })
      })
    })
  })

  describe('Delete Group', () => {
    it('shows confirmation modal when delete button is clicked', async () => {
      render(<EditPage {...defaultProps} />)
      const deleteButton = await testScreen.findByText('Delete Group')
      fireEvent.click(deleteButton)
      await waitFor(() => {
        expect(testScreen.getByTestId('delete-appointment-group-modal')).toBeInTheDocument()
      })
    })

    it('closes modal when "Never mind" is clicked', async () => {
      render(<EditPage {...defaultProps} />)
      const deleteButton = await testScreen.findByText('Delete Group')
      fireEvent.click(deleteButton)
      await waitFor(
        () => {
          expect(testScreen.getByTestId('delete-appointment-group-modal')).toBeInTheDocument()
        },
        {timeout: 10000},
      )
      const cancelButton = testScreen.getByTestId('cancel-delete-button')
      fireEvent.click(cancelButton)
      await waitFor(
        () => {
          expect(testScreen.queryByTestId('delete-appointment-group-modal')).not.toBeInTheDocument()
        },
        {timeout: 10000},
      )
    })

    it('sends delete request with correct id and redirects when confirmed', async () => {
      server.use(
        http.delete('/api/v1/appointment_groups/1', () => new HttpResponse(null, {status: 200})),
      )
      render(<EditPage {...defaultProps} />)
      const deleteButton = await testScreen.findByText('Delete Group')
      fireEvent.click(deleteButton)
      await waitFor(() => {
        expect(testScreen.getByTestId('delete-appointment-group-modal')).toBeInTheDocument()
      })
      const confirmButton = testScreen.getByTestId('confirm-delete-button')
      fireEvent.click(confirmButton)
      await waitFor(() => expect(assignLocation).toHaveBeenCalledWith('/calendar'))
    })

    it('shows error message on failed delete', async () => {
      server.use(
        http.delete('/api/v1/appointment_groups/1', () => new HttpResponse(null, {status: 500})),
      )
      render(<EditPage {...defaultProps} />)
      const deleteButton = await testScreen.findByText('Delete Group')
      fireEvent.click(deleteButton)
      await waitFor(() => {
        expect(testScreen.getByTestId('delete-appointment-group-modal')).toBeInTheDocument()
      })
      const confirmButton = testScreen.getByTestId('confirm-delete-button')
      fireEvent.click(confirmButton)
      await waitFor(() => {
        expect($.flashError).toHaveBeenCalledWith(
          'An error occurred while deleting the appointment group',
        )
      })
    })
  })

  describe('Form Interactions', () => {
    it('updates form values on input change', async () => {
      render(<EditPage {...defaultProps} />)
      const titleInput = await testScreen.findByRole('textbox', {name: 'Title'})
      fireEvent.change(titleInput, {target: {value: 'New Title', name: 'title'}})
      expect(titleInput.value).toBe('New Title')
    })

    it('updates checkbox values correctly', async () => {
      render(<EditPage {...defaultProps} />)
      const checkbox = await testScreen.findByRole('checkbox', {
        name: 'Allow students to see who was signed up for time slots that are still available',
      })
      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()
    })
  })

  describe('Save Group', () => {
    beforeEach(() => {
      server.use(
        http.put('/api/v1/appointment_groups/1', () => new HttpResponse(null, {status: 200})),
      )
    })

    it('shows error for empty limit users per slot', async () => {
      const {container} = render(<EditPage {...defaultProps} />)
      const checkbox = container.querySelector('#limit_users_per_slot')
      fireEvent.click(checkbox)
      $.fn.val.mockReturnValue('')
      const saveButton = testScreen.getByText('Save')
      fireEvent.click(saveButton)
      await waitFor(() => {
        expect($.fn.errorBox).toHaveBeenCalledWith(
          'You must provide a value or unselect the option.',
        )
      })
    })

    it('shows error for invalid limit users per slot', async () => {
      const {container} = render(<EditPage {...defaultProps} />)
      const checkbox = container.querySelector('#limit_users_per_slot')
      fireEvent.click(checkbox)
      const input = container.querySelector('.EditPage__Options-LimitUsersPerSlot')
      Object.defineProperty(input, 'value', {value: '0'})
      fireEvent.change(input, {target: {value: '0'}})
      $.fn.val = vi.fn().mockReturnValue('0')
      const saveButton = testScreen.getByText('Save')
      fireEvent.click(saveButton)
      await waitFor(() => {
        expect($.fn.errorBox).toHaveBeenCalledWith(
          'You must allow at least one appointment per time slot.',
        )
      })
    })

    it('prepares correct participant visibility', async () => {
      let capturedBody
      server.use(
        http.put('/api/v1/appointment_groups/1', async ({request}) => {
          capturedBody = await request.json()
          return new HttpResponse(null, {status: 200})
        }),
      )
      const {container} = render(<EditPage {...defaultProps} />)
      const visibilityCheckbox = container.querySelector('input[name="allowStudentsToView"]')
      fireEvent.click(visibilityCheckbox)
      const limitUsersCheckbox = container.querySelector('#limit_users_per_slot')
      fireEvent.click(limitUsersCheckbox)
      const input = container.querySelector('.EditPage__Options-LimitUsersPerSlot')
      Object.defineProperty(input, 'value', {value: '1'})
      fireEvent.change(input, {target: {name: 'limitUsersPerSlot', value: '1'}})
      $.fn.val = vi.fn().mockReturnValue('1')
      const saveButton = testScreen.getByText('Save')
      fireEvent.click(saveButton)
      await waitFor(() => {
        expect(capturedBody).toMatchObject({
          appointment_group: expect.objectContaining({
            participant_visibility: 'protected',
            participants_per_appointment: '1',
          }),
        })
      })
    })

    it('shows error on failed save', async () => {
      server.use(
        http.put('/api/v1/appointment_groups/1', () => new HttpResponse(null, {status: 500})),
      )
      render(<EditPage {...defaultProps} />)
      const saveButton = testScreen.getByText('Save')
      fireEvent.click(saveButton)
      await waitFor(() => {
        expect($.flashError).toHaveBeenCalledWith(
          'An error occurred while saving the appointment group',
        )
      })
    })

    it('redirects to calendar on successful save', async () => {
      render(<EditPage {...defaultProps} />)
      const saveButton = testScreen.getByText('Save')
      fireEvent.click(saveButton)
      await waitFor(() => {
        expect(assignLocation).toHaveBeenCalledWith('/calendar?edit_appointment_group_success=1')
      })
    })
  })
})
