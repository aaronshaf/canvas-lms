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

import React from 'react'
import {render, fireEvent, act, screen} from '@testing-library/react'
import userEvent, {PointerEventsCheckLevel} from '@testing-library/user-event'
import fetchMock from 'fetch-mock'
import BulkEdit from '../BulkEdit'
import fakeENV from '@canvas/test-utils/fakeENV'

const ASSIGNMENTS_ENDPOINT = /api\/v1\/courses\/\d+\/assignments/
const BULK_UPDATE_ENDPOINT = /api\/v1\/courses\/\d+\/assignments\/bulk_update/

const realSetTimeout = setTimeout

// ordering: parent_unlock(T+4) <= parent_due(T+9) <= peer_review_due(T+14) <= parent_lock(T+22)
// override ordering: override_unlock(T+11) <= override_due(T+16) <= peer_review_override_due(T+18) <= override_lock(T+20)
const startOfMonth = (offsetDays = 0) =>
  new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1 + offsetDays))
    .toISOString()
    .replace('.000Z', 'Z')
const dateOfMonth = (offsetDays = 0) => startOfMonth(offsetDays).slice(0, 10)

async function flushPromises() {
  await act(() => new Promise(realSetTimeout))
}

function peerReviewAssignmentResponse() {
  return [
    {
      id: 'assignment_pr',
      name: 'Peer Review Assignment',
      can_edit: true,
      peer_reviews: true,
      all_dates: [
        {
          base: true,
          unlock_at: startOfMonth(4),
          due_at: startOfMonth(9),
          lock_at: startOfMonth(22),
          can_edit: true,
        },
      ],
      peer_review_sub_assignment: {
        id: 'pr_sub_1',
        all_dates: [
          {
            base: true,
            due_at: startOfMonth(14),
            can_edit: true,
          },
        ],
      },
    },
  ]
}

function peerReviewAssignmentWithOverrideResponse() {
  return [
    {
      id: 'assignment_pr',
      name: 'Peer Review Assignment',
      can_edit: true,
      peer_reviews: true,
      all_dates: [
        {
          base: true,
          unlock_at: startOfMonth(4),
          due_at: startOfMonth(9),
          lock_at: startOfMonth(22),
          can_edit: true,
        },
        {
          id: 1,
          title: 'Section A',
          unlock_at: startOfMonth(11),
          due_at: startOfMonth(16),
          lock_at: startOfMonth(20),
          can_edit: true,
        },
      ],
      peer_review_sub_assignment: {
        id: 'pr_sub_1',
        all_dates: [
          {
            base: true,
            due_at: startOfMonth(14),
            can_edit: true,
          },
          {
            id: 2,
            parent_override_id: 1,
            due_at: startOfMonth(18),
            can_edit: true,
          },
        ],
      },
    },
  ]
}

function renderBulkEdit(overrides = {}) {
  const props = {
    courseId: '42',
    onCancel: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  }
  return {...render(<BulkEdit {...props} />), ...props}
}

async function renderBulkEditAndWait(overrides = {}, assignments = peerReviewAssignmentResponse()) {
  fetchMock.getOnce(ASSIGNMENTS_ENDPOINT, assignments)
  const result = renderBulkEdit(overrides)
  await flushPromises()
  result.assignments = assignments
  return result
}

beforeEach(() => {
  fetchMock.put(BULK_UPDATE_ENDPOINT, {})
  vi.useFakeTimers()
})

afterEach(() => {
  fetchMock.reset()
  vi.useRealTimers()
})

describe('Assignment Bulk Edit - Peer Review Dates', () => {
  beforeEach(() => {
    fakeENV.setup({
      TIMEZONE: 'UTC',
      FEATURES: {},
      PEER_REVIEW_ALLOCATION_AND_GRADING_ENABLED: true,
    })
  })

  afterEach(async () => {
    await flushPromises()
    fakeENV.teardown()
  })

  describe('Save payload', () => {
    it('includes peer_review_sub_assignment in save payload when review due date is edited', async () => {
      const {getAllByLabelText, getByText} = await renderBulkEditAndWait()
      const reviewDueDateInput = getAllByLabelText('Review Due Date')[0]

      fireEvent.change(reviewDueDateInput, {target: {value: dateOfMonth(19)}})
      fireEvent.blur(reviewDueDateInput)
      fireEvent.click(getByText('Save'))
      await flushPromises()

      const calls = fetchMock.calls().filter(([url]) => url.includes('bulk_update'))
      expect(calls.length).toBeGreaterThan(0)
      const body = JSON.parse(calls[calls.length - 1][1].body)
      const peerReviewAssignment = body.find(a => a.id === 'assignment_pr')
      expect(peerReviewAssignment).toBeDefined()
      expect(peerReviewAssignment.peer_review_sub_assignment).toBeDefined()
      expect(peerReviewAssignment.peer_review_sub_assignment.id).toBe('pr_sub_1')
      expect(peerReviewAssignment.peer_review_sub_assignment.all_dates).toHaveLength(1)
    })

    it('includes peer_review_sub_assignment in payload when parent due date changes (updates derived unlock_at)', async () => {
      const {getAllByLabelText, getByText} = await renderBulkEditAndWait()
      const dueAtInput = getAllByLabelText('Due At')[0]

      // Use a date before the existing review due date to avoid triggering
      // peer review validation, which would disable Save
      fireEvent.change(dueAtInput, {target: {value: dateOfMonth(11)}})
      fireEvent.blur(dueAtInput)
      fireEvent.click(getByText('Save'))
      await flushPromises()

      const calls = fetchMock.calls().filter(([url]) => url.includes('bulk_update'))
      const body = JSON.parse(calls[calls.length - 1][1].body)
      const peerReviewAssignment = body.find(a => a.id === 'assignment_pr')
      // PR sub-assignment is included because unlock_at is derived from parent due_at and must be updated
      expect(peerReviewAssignment.peer_review_sub_assignment).toBeDefined()
      const peerReviewDate = peerReviewAssignment.peer_review_sub_assignment.all_dates[0]
      expect(peerReviewDate.due_at).toBe(startOfMonth(14))
      expect(peerReviewDate.lock_at).toBe(startOfMonth(22))
    })

    it('includes unlock_at derived from the parent due_at and lock_at from parent lock_at in the payload', async () => {
      const {getAllByLabelText, getByText} = await renderBulkEditAndWait()
      const reviewDueDateInput = getAllByLabelText('Review Due Date')[0]

      fireEvent.change(reviewDueDateInput, {target: {value: dateOfMonth(19)}})
      fireEvent.blur(reviewDueDateInput)
      fireEvent.click(getByText('Save'))
      await flushPromises()

      const calls = fetchMock.calls().filter(([url]) => url.includes('bulk_update'))
      const body = JSON.parse(calls[calls.length - 1][1].body)
      const peerReviewAssignment = body.find(a => a.id === 'assignment_pr')
      const peerReviewDate = peerReviewAssignment.peer_review_sub_assignment.all_dates[0]
      // unlock_at = parent's due_at (review period opens when the assignment is due)
      expect(peerReviewDate.unlock_at).toBe(startOfMonth(9))
      // lock_at = parent's lock_at
      expect(peerReviewDate.lock_at).toBe(startOfMonth(22))
    })

    it('derives unlock_at and lock_at from the section override when serializing an override PR date', async () => {
      const {getAllByLabelText, getByText} = await renderBulkEditAndWait(
        {},
        peerReviewAssignmentWithOverrideResponse(),
      )
      const overrideReviewInput = getAllByLabelText('Review Due Date')[1]

      fireEvent.change(overrideReviewInput, {target: {value: dateOfMonth(19)}})
      fireEvent.blur(overrideReviewInput)
      fireEvent.click(getByText('Save'))
      await flushPromises()

      const calls = fetchMock.calls().filter(([url]) => url.includes('bulk_update'))
      const body = JSON.parse(calls[calls.length - 1][1].body)
      const peerReviewAssignment = body.find(a => a.id === 'assignment_pr')
      const overridePeerReviewDate = peerReviewAssignment.peer_review_sub_assignment.all_dates.find(d => d.id === 2)
      expect(overridePeerReviewDate).toBeDefined()
      // unlock_at = the section override's due_at (review period opens when that override is due)
      expect(overridePeerReviewDate.unlock_at).toBe(startOfMonth(16))
      // lock_at = the section override's lock_at
      expect(overridePeerReviewDate.lock_at).toBe(startOfMonth(20))
    })
  })

  describe('Revert', () => {
    it('restores original review due date when reverted', async () => {
      const {getAllByLabelText} = await renderBulkEditAndWait()
      const reviewDueDateInput = getAllByLabelText('Review Due Date')[0]
      const originalValue = reviewDueDateInput.value

      fireEvent.change(reviewDueDateInput, {target: {value: dateOfMonth(19)}})
      fireEvent.blur(reviewDueDateInput)
      expect(reviewDueDateInput.value).not.toBe(originalValue)

      const [revertButton] = screen.getAllByText('Revert date changes').filter(elt => elt.closest('button'))
      fireEvent.click(revertButton)
      await flushPromises()

      expect(screen.queryAllByText('Revert date changes').filter(elt => elt.closest('button'))).toHaveLength(0)
    })
  })

  describe('Batch edit shift', () => {
    const user = userEvent.setup({pointerEventsCheck: PointerEventsCheckLevel.Never, delay: null})

    it('shifts review due date alongside parent date when batch shifting', async () => {
      const {getAllByLabelText, getByText} = await renderBulkEditAndWait()

      fireEvent.click(getAllByLabelText(/Select assignment:/)[0])
      fireEvent.click(getByText('Batch Edit'))

      const shiftRadio = await screen.findByLabelText(/Shift/i)
      await user.click(shiftRadio)

      const daysInput = screen.getByLabelText(/days/i)
      await user.clear(daysInput)
      await user.type(daysInput, '7')

      await user.click(screen.getByText(/confirm/i))
      await flushPromises()

      fireEvent.click(getByText('Save'))
      await flushPromises()

      const calls = fetchMock.calls().filter(([url]) => url.includes('bulk_update'))
      const body = JSON.parse(calls[calls.length - 1][1].body)
      const peerReviewAssignment = body.find(a => a.id === 'assignment_pr')
      expect(peerReviewAssignment?.peer_review_sub_assignment?.all_dates).toBeDefined()
    })
  })

  describe('Validation', () => {
    function changeAndBlurInput(input, newValue) {
      fireEvent.change(input, {target: {value: newValue}})
      fireEvent.blur(input)
    }

    it('disables save when review date is before assignment due date', async () => {
      const {getByText, getAllByLabelText} = await renderBulkEditAndWait()
      changeAndBlurInput(getAllByLabelText('Review Due Date')[0], dateOfMonth(4))
      expect(getByText('Due date cannot be before assignment due date')).toBeInTheDocument()
      expect(getByText('Save').closest('button').disabled).toBe(true)
    })

    it('disables save when review date is after assignment lock date', async () => {
      const {getByText, getAllByLabelText} = await renderBulkEditAndWait()
      changeAndBlurInput(getAllByLabelText('Review Due Date')[0], dateOfMonth(23))
      expect(getByText('Due date cannot be after assignment until date')).toBeInTheDocument()
      expect(getByText('Save').closest('button').disabled).toBe(true)
    })

    it('clears the validation error when the review date edit is reverted', async () => {
      const {queryByText, getAllByText, getAllByLabelText} = await renderBulkEditAndWait()
      changeAndBlurInput(getAllByLabelText('Review Due Date')[0], dateOfMonth(4))
      expect(queryByText('Due date cannot be before assignment due date')).toBeInTheDocument()
      const revertButtons = getAllByText('Revert date changes').filter(elt => elt.closest('button'))
      fireEvent.click(revertButtons[0])
      expect(queryByText('Due date cannot be before assignment due date')).not.toBeInTheDocument()
    })

    it('shows error on review date when parent due date changes past the review date', async () => {
      const {getByText, getAllByLabelText} = await renderBulkEditAndWait()
      const dueAtInput = getAllByLabelText('Due At')[0]
      changeAndBlurInput(dueAtInput, dateOfMonth(19))
      expect(getByText('Due date cannot be before assignment due date')).toBeInTheDocument()
    })

    it('disables save when a section override review date is before the override due date', async () => {
      const {getByText, getAllByLabelText} = await renderBulkEditAndWait(
        {},
        peerReviewAssignmentWithOverrideResponse(),
      )
      const overrideReviewInput = getAllByLabelText('Review Due Date')[1]

      changeAndBlurInput(overrideReviewInput, dateOfMonth(11))
      expect(getByText('Due date cannot be before assignment due date')).toBeInTheDocument()
      expect(getByText('Save').closest('button').disabled).toBe(true)
    })
  })

  describe('Validation on load', () => {
    function invalidPreLoadedAssignment() {
      const assignment = peerReviewAssignmentResponse()[0]
      assignment.peer_review_sub_assignment.all_dates[0].due_at = startOfMonth(4)
      return [assignment]
    }

    function invalidPreLoadedOverrideAssignment() {
      const assignment = peerReviewAssignmentWithOverrideResponse()[0]
      assignment.peer_review_sub_assignment.all_dates[1].due_at = startOfMonth(11)
      return [assignment]
    }

    it('surfaces a validation error for a pre-existing invalid base peer review date', async () => {
      const {getByText} = await renderBulkEditAndWait({}, invalidPreLoadedAssignment())
      expect(getByText('Due date cannot be before assignment due date')).toBeInTheDocument()
    })

    it('disables save when a pre-existing peer review date is invalid', async () => {
      const {getByText} = await renderBulkEditAndWait({}, invalidPreLoadedAssignment())
      expect(getByText('Save').closest('button').disabled).toBe(true)
    })

    it('surfaces a validation error for a pre-existing invalid override peer review date', async () => {
      const {getByText} = await renderBulkEditAndWait({}, invalidPreLoadedOverrideAssignment())
      expect(getByText('Due date cannot be before assignment due date')).toBeInTheDocument()
    })

    it('does not surface validation errors when pre-existing peer review dates are valid', async () => {
      const {queryByText, getByText} = await renderBulkEditAndWait()
      expect(queryByText('Due date cannot be before assignment due date')).not.toBeInTheDocument()
      expect(queryByText('Due date cannot be after assignment until date')).not.toBeInTheDocument()
      expect(getByText('Save').closest('button').disabled).toBe(false)
    })
  })

  describe('Batch edit remove', () => {
    const user = userEvent.setup({pointerEventsCheck: PointerEventsCheckLevel.Never, delay: null})

    it('clears review due date when due date is batch-removed', async () => {
      const {getAllByLabelText, getByText} = await renderBulkEditAndWait()

      fireEvent.click(getAllByLabelText(/Select assignment:/)[0])
      fireEvent.click(getByText('Batch Edit'))

      const removeRadio = await screen.findByLabelText(/Remove/i)
      await user.click(removeRadio)

      // "Remove Due Dates" is the default selection; no additional click needed
      await user.click(screen.getByText(/confirm/i))
      await flushPromises()

      fireEvent.click(getByText('Save'))
      await flushPromises()

      const calls = fetchMock.calls().filter(([url]) => url.includes('bulk_update'))
      const body = JSON.parse(calls[calls.length - 1][1].body)
      const peerReviewAssignment = body.find(a => a.id === 'assignment_pr')
      const peerReviewDate = peerReviewAssignment?.peer_review_sub_assignment?.all_dates?.[0]
      expect(peerReviewDate?.due_at).toBeNull()
    })

    it('clears review lock date when availability dates are batch-removed', async () => {
      const {getAllByLabelText, getByText} = await renderBulkEditAndWait()

      fireEvent.click(getAllByLabelText(/Select assignment:/)[0])
      fireEvent.click(getByText('Batch Edit'))

      const removeRadio = await screen.findByLabelText(/Remove/i)
      await user.click(removeRadio)

      await user.click(screen.getByLabelText('Remove Availability Dates'))
      await user.click(screen.getByText(/confirm/i))
      await flushPromises()

      fireEvent.click(getByText('Save'))
      await flushPromises()

      const calls = fetchMock.calls().filter(([url]) => url.includes('bulk_update'))
      const body = JSON.parse(calls[calls.length - 1][1].body)
      const peerReviewAssignment = body.find(a => a.id === 'assignment_pr')
      const peerReviewDate = peerReviewAssignment?.peer_review_sub_assignment?.all_dates?.[0]
      expect(peerReviewDate).toBeDefined()
      expect(peerReviewDate?.lock_at).toBeNull()
    })

    it('clears review unlock and lock dates when all dates are batch-removed', async () => {
      const {getAllByLabelText, getByText} = await renderBulkEditAndWait()

      fireEvent.click(getAllByLabelText(/Select assignment:/)[0])
      fireEvent.click(getByText('Batch Edit'))

      const removeRadio = await screen.findByLabelText(/Remove/i)
      await user.click(removeRadio)

      await user.click(screen.getByLabelText('Remove Both'))
      await user.click(screen.getByText(/confirm/i))
      await flushPromises()

      fireEvent.click(getByText('Save'))
      await flushPromises()

      const calls = fetchMock.calls().filter(([url]) => url.includes('bulk_update'))
      const body = JSON.parse(calls[calls.length - 1][1].body)
      const peerReviewAssignment = body.find(a => a.id === 'assignment_pr')
      const peerReviewDate = peerReviewAssignment?.peer_review_sub_assignment?.all_dates?.[0]
      expect(peerReviewDate?.due_at).toBeNull()
      expect(peerReviewDate?.unlock_at).toBeNull()
      expect(peerReviewDate?.lock_at).toBeNull()
    })
  })
})
