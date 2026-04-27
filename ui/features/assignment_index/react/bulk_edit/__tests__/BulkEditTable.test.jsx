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

import React from 'react'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BulkEditTable from '../BulkEditTable'

const startOfMonth = (offsetDays = 0) =>
  new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1 + offsetDays))
    .toISOString()
    .replace('.000Z', 'Z')

function standardAssignmentData() {
  return [
    {
      id: 'assignment_1',
      name: 'First Assignment',
      can_edit: true,
      all_dates: [
        {
          base: true,
          unlock_at: '2020-03-19T00:00:00Z',
          due_at: '2020-03-20T03:00:00Z',
          lock_at: '2020-04-11T00:00:00Z',
          can_edit: true,
        },
      ],
    },
  ]
}

function assignmentWithEditedOverride() {
  return [
    {
      id: 'assignment_1',
      name: 'First Assignment',
      can_edit: true,
      all_dates: [
        {
          base: true,
          unlock_at: '2020-03-19T00:00:00Z',
          due_at: '2020-03-20T03:00:00Z',
          lock_at: '2020-04-11T00:00:00Z',
          can_edit: true,
        },
        {
          id: 'override_1',
          title: 'Section A',
          unlock_at: '2020-03-19T00:00:00Z',
          due_at: '2020-03-21T03:00:00Z',
          lock_at: '2020-04-11T00:00:00Z',
          can_edit: true,
          original_due_at: '2020-03-20T03:00:00Z',
        },
      ],
    },
  ]
}

function peerReviewAssignmentData() {
  return [
    {
      id: 'assignment_pr',
      name: 'Peer Review Assignment',
      can_edit: true,
      peer_reviews: true,
      all_dates: [
        {
          base: true,
          unlock_at: '2020-03-19T00:00:00Z',
          due_at: '2020-03-20T03:00:00Z',
          lock_at: '2020-04-11T00:00:00Z',
          can_edit: true,
        },
      ],
      peer_review_sub_assignment: {
        id: 'pr_sub_1',
        all_dates: [
          {
            base: true,
            due_at: '2020-03-27T03:00:00Z',
            can_edit: true,
          },
        ],
      },
    },
  ]
}

function peerReviewAssignmentWithEditedReviewDate() {
  return [
    {
      id: 'assignment_pr',
      name: 'Peer Review Assignment',
      can_edit: true,
      peer_reviews: true,
      all_dates: [
        {
          base: true,
          unlock_at: '2020-03-19T00:00:00Z',
          due_at: '2020-03-20T03:00:00Z',
          lock_at: '2020-04-11T00:00:00Z',
          can_edit: true,
        },
      ],
      peer_review_sub_assignment: {
        id: 'pr_sub_1',
        all_dates: [
          {
            base: true,
            due_at: '2020-03-28T03:00:00Z',
            original_due_at: '2020-03-27T03:00:00Z',
            can_edit: true,
          },
        ],
      },
    },
  ]
}

function peerReviewAssignmentWithNoDueDate() {
  return [
    {
      id: 'assignment_pr',
      name: 'Peer Review Assignment',
      can_edit: true,
      peer_reviews: true,
      all_dates: [
        {
          base: true,
          unlock_at: '2020-03-19T00:00:00Z',
          due_at: null,
          lock_at: '2020-04-11T00:00:00Z',
          can_edit: true,
        },
      ],
      peer_review_sub_assignment: {
        id: 'pr_sub_1',
        all_dates: [
          {
            base: true,
            due_at: null,
            can_edit: true,
          },
        ],
      },
    },
  ]
}

function assignmentWithLegacyPeerReviewData() {
  return [
    {
      id: 'assignment_legacy_pr',
      name: 'Assignment with Legacy Peer Reviews',
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
    },
  ]
}

function assignmentWithLegacyPeerReviewInGradedMode() {
  return [
    {
      id: 'assignment_legacy_pr',
      name: 'Assignment with Legacy Peer Reviews',
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
    },
    {
      id: 'assignment_modern_pr',
      name: 'Assignment with Graded Peer Review',
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
        id: 'pr_sub_2',
        all_dates: [{base: true, due_at: startOfMonth(14), can_edit: true}],
      },
    },
  ]
}

function mixedAssignmentData() {
  return [
    {
      id: 'assignment_pr',
      name: 'Peer Review Assignment',
      can_edit: true,
      peer_reviews: true,
      all_dates: [
        {
          base: true,
          unlock_at: '2020-03-19T00:00:00Z',
          due_at: '2020-03-20T03:00:00Z',
          lock_at: '2020-04-11T00:00:00Z',
          can_edit: true,
        },
      ],
      peer_review_sub_assignment: {
        id: 'pr_sub_1',
        all_dates: [{base: true, due_at: '2020-03-27T03:00:00Z', can_edit: true}],
      },
    },
    {
      id: 'assignment_regular',
      name: 'Regular Assignment',
      can_edit: true,
      peer_reviews: false,
      all_dates: [
        {
          base: true,
          unlock_at: '2020-03-19T00:00:00Z',
          due_at: '2020-03-20T03:00:00Z',
          lock_at: '2020-04-11T00:00:00Z',
          can_edit: true,
        },
      ],
    },
  ]
}

describe('BulkEditTable Peer Review', () => {
  const mockUpdateAssignmentDate = vi.fn()
  const mockUpdatePeerReviewDate = vi.fn()
  const mockSetAssignmentSelected = vi.fn()
  const mockSelectAllAssignments = vi.fn()
  const mockClearOverrideEdits = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('shows Review Due Date column header when peerReviewAllocationAndGradingEnabled is true', async () => {
    render(
      <BulkEditTable
        assignments={peerReviewAssignmentData()}
        updateAssignmentDate={mockUpdateAssignmentDate}
        updatePeerReviewDate={mockUpdatePeerReviewDate}
        setAssignmentSelected={mockSetAssignmentSelected}
        selectAllAssignments={mockSelectAllAssignments}
        clearOverrideEdits={mockClearOverrideEdits}
        peerReviewAllocationAndGradingEnabled={true}
      />,
    )

    expect(await screen.findByText('Review Due Date')).toBeInTheDocument()
  })

  it('does not show Review Due Date column header when peerReviewAllocationAndGradingEnabled is false', () => {
    render(
      <BulkEditTable
        assignments={standardAssignmentData()}
        updateAssignmentDate={mockUpdateAssignmentDate}
        setAssignmentSelected={mockSetAssignmentSelected}
        selectAllAssignments={mockSelectAllAssignments}
        clearOverrideEdits={mockClearOverrideEdits}
        peerReviewAllocationAndGradingEnabled={false}
      />,
    )

    expect(screen.queryByText('Review Due Date')).not.toBeInTheDocument()
  })

  it('renders the review due date input for peer review assignments', async () => {
    render(
      <BulkEditTable
        assignments={peerReviewAssignmentData()}
        updateAssignmentDate={mockUpdateAssignmentDate}
        updatePeerReviewDate={mockUpdatePeerReviewDate}
        setAssignmentSelected={mockSetAssignmentSelected}
        selectAllAssignments={mockSelectAllAssignments}
        clearOverrideEdits={mockClearOverrideEdits}
        peerReviewAllocationAndGradingEnabled={true}
      />,
    )

    const reviewDueDateInputs = await screen.findAllByLabelText('Review Due Date')
    expect(reviewDueDateInputs.length).toBeGreaterThan(0)
  })

  it('shows revert button when review due date has been edited', async () => {
    const user = userEvent.setup()

    render(
      <BulkEditTable
        assignments={peerReviewAssignmentWithEditedReviewDate()}
        updateAssignmentDate={mockUpdateAssignmentDate}
        updatePeerReviewDate={mockUpdatePeerReviewDate}
        setAssignmentSelected={mockSetAssignmentSelected}
        selectAllAssignments={mockSelectAllAssignments}
        clearOverrideEdits={mockClearOverrideEdits}
        peerReviewAllocationAndGradingEnabled={true}
      />,
    )

    const revertTexts = await screen.findAllByText('Revert date changes')
    const revertButton = revertTexts.find(el => el.closest('button'))?.closest('button')
    expect(revertButton).toBeInTheDocument()
    await user.click(revertButton)
    expect(mockClearOverrideEdits).toHaveBeenCalledWith({
      assignmentId: 'assignment_pr',
      overrideId: undefined,
    })
  })

  it('disables review due date input when parent assignment has no due date', async () => {
    render(
      <BulkEditTable
        assignments={peerReviewAssignmentWithNoDueDate()}
        updateAssignmentDate={mockUpdateAssignmentDate}
        updatePeerReviewDate={mockUpdatePeerReviewDate}
        setAssignmentSelected={mockSetAssignmentSelected}
        selectAllAssignments={mockSelectAllAssignments}
        clearOverrideEdits={mockClearOverrideEdits}
        peerReviewAllocationAndGradingEnabled={true}
      />,
    )

    const reviewDueDateInputs = await screen.findAllByLabelText('Review Due Date')
    expect(reviewDueDateInputs[0]).toBeDisabled()
  })

  it('enables review due date input when parent assignment has a due date', async () => {
    render(
      <BulkEditTable
        assignments={peerReviewAssignmentData()}
        updateAssignmentDate={mockUpdateAssignmentDate}
        updatePeerReviewDate={mockUpdatePeerReviewDate}
        setAssignmentSelected={mockSetAssignmentSelected}
        selectAllAssignments={mockSelectAllAssignments}
        clearOverrideEdits={mockClearOverrideEdits}
        peerReviewAllocationAndGradingEnabled={true}
      />,
    )

    const reviewDueDateInputs = await screen.findAllByLabelText('Review Due Date')
    expect(reviewDueDateInputs[0]).not.toBeDisabled()
  })

  it('does not render review due date input for assignment with legacy peer reviews in graded mode', () => {
    render(
      <BulkEditTable
        assignments={assignmentWithLegacyPeerReviewData()}
        updateAssignmentDate={mockUpdateAssignmentDate}
        updatePeerReviewDate={mockUpdatePeerReviewDate}
        setAssignmentSelected={mockSetAssignmentSelected}
        selectAllAssignments={mockSelectAllAssignments}
        clearOverrideEdits={mockClearOverrideEdits}
        peerReviewAllocationAndGradingEnabled={true}
      />,
    )

    expect(screen.queryByLabelText('Review Due Date')).not.toBeInTheDocument()
  })

  it('renders review due date input only for assignment with graded peer reviews in graded mode', async () => {
    render(
      <BulkEditTable
        assignments={assignmentWithLegacyPeerReviewInGradedMode()}
        updateAssignmentDate={mockUpdateAssignmentDate}
        updatePeerReviewDate={mockUpdatePeerReviewDate}
        setAssignmentSelected={mockSetAssignmentSelected}
        selectAllAssignments={mockSelectAllAssignments}
        clearOverrideEdits={mockClearOverrideEdits}
        peerReviewAllocationAndGradingEnabled={true}
      />,
    )

    const reviewDueDateInputs = await screen.findAllByLabelText('Review Due Date')
    expect(reviewDueDateInputs).toHaveLength(1)
  })

  it('renders empty cell for non-peer-review assignments in the review due date column', async () => {
    render(
      <BulkEditTable
        assignments={mixedAssignmentData()}
        updateAssignmentDate={mockUpdateAssignmentDate}
        updatePeerReviewDate={mockUpdatePeerReviewDate}
        setAssignmentSelected={mockSetAssignmentSelected}
        selectAllAssignments={mockSelectAllAssignments}
        clearOverrideEdits={mockClearOverrideEdits}
        peerReviewAllocationAndGradingEnabled={true}
      />,
    )

    const reviewDueDateInputs = await screen.findAllByLabelText('Review Due Date')
    expect(reviewDueDateInputs).toHaveLength(1)
  })

  describe('stacked layout', () => {
    let originalResizeObserver

    beforeEach(() => {
      originalResizeObserver = window.ResizeObserver
      delete window.ResizeObserver
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('maxWidth'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
    })

    afterEach(() => {
      window.ResizeObserver = originalResizeObserver
    })

    it('does not render review due date input for non-peer-review assignments in stacked layout', () => {
      render(
        <BulkEditTable
          assignments={standardAssignmentData()}
          updateAssignmentDate={mockUpdateAssignmentDate}
          updatePeerReviewDate={mockUpdatePeerReviewDate}
          setAssignmentSelected={mockSetAssignmentSelected}
          selectAllAssignments={mockSelectAllAssignments}
          clearOverrideEdits={mockClearOverrideEdits}
          peerReviewAllocationAndGradingEnabled={true}
        />,
      )

      expect(screen.queryByLabelText('Review Due Date')).not.toBeInTheDocument()
    })

    it('keeps Available From input accessible in stacked layout when peerReviewAllocationAndGradingEnabled is true', () => {
      render(
        <BulkEditTable
          assignments={standardAssignmentData()}
          updateAssignmentDate={mockUpdateAssignmentDate}
          updatePeerReviewDate={mockUpdatePeerReviewDate}
          setAssignmentSelected={mockSetAssignmentSelected}
          selectAllAssignments={mockSelectAllAssignments}
          clearOverrideEdits={mockClearOverrideEdits}
          peerReviewAllocationAndGradingEnabled={true}
        />,
      )

      expect(screen.getByLabelText('Available From')).toBeInTheDocument()
    })

    it('renders review due date input only for peer-review assignments in stacked layout', async () => {
      render(
        <BulkEditTable
          assignments={mixedAssignmentData()}
          updateAssignmentDate={mockUpdateAssignmentDate}
          updatePeerReviewDate={mockUpdatePeerReviewDate}
          setAssignmentSelected={mockSetAssignmentSelected}
          selectAllAssignments={mockSelectAllAssignments}
          clearOverrideEdits={mockClearOverrideEdits}
          peerReviewAllocationAndGradingEnabled={true}
        />,
      )

      const reviewDueDateInputs = await screen.findAllByLabelText('Review Due Date')
      expect(reviewDueDateInputs).toHaveLength(1)
    })
  })
})

describe('BulkEditTable Layout', () => {
  const mockUpdateAssignmentDate = vi.fn()
  const mockSetAssignmentSelected = vi.fn()
  const mockSelectAllAssignments = vi.fn()
  const mockClearOverrideEdits = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('stacked layout', () => {
    let originalResizeObserver

    beforeEach(() => {
      originalResizeObserver = window.ResizeObserver
      delete window.ResizeObserver
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('maxWidth'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
    })

    afterEach(() => {
      window.ResizeObserver = originalResizeObserver
    })

    it('shows visible text for Actions column header in stacked layout', () => {
      render(
        <BulkEditTable
          assignments={standardAssignmentData()}
          updateAssignmentDate={mockUpdateAssignmentDate}
          setAssignmentSelected={mockSetAssignmentSelected}
          selectAllAssignments={mockSelectAllAssignments}
          clearOverrideEdits={mockClearOverrideEdits}
        />,
      )

      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('shows visible text for Notes column header in stacked layout', () => {
      render(
        <BulkEditTable
          assignments={standardAssignmentData()}
          updateAssignmentDate={mockUpdateAssignmentDate}
          setAssignmentSelected={mockSetAssignmentSelected}
          selectAllAssignments={mockSelectAllAssignments}
          clearOverrideEdits={mockClearOverrideEdits}
        />,
      )

      expect(screen.getByText('Notes')).toBeInTheDocument()
    })

    it('handles revert click without errors in stacked layout', async () => {
      const user = userEvent.setup()

      render(
        <BulkEditTable
          assignments={assignmentWithEditedOverride()}
          updateAssignmentDate={mockUpdateAssignmentDate}
          setAssignmentSelected={mockSetAssignmentSelected}
          selectAllAssignments={mockSelectAllAssignments}
          clearOverrideEdits={mockClearOverrideEdits}
        />,
      )

      const revertButton = screen.getByRole('button', {name: /revert date changes/i})
      await user.click(revertButton)

      expect(mockClearOverrideEdits).toHaveBeenCalledWith({
        assignmentId: 'assignment_1',
        overrideId: 'override_1',
      })
    })
  })

  describe('fixed layout', () => {
    let matchMediaMock
    let originalResizeObserver

    beforeEach(() => {
      originalResizeObserver = window.ResizeObserver
      delete window.ResizeObserver

      matchMediaMock = vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event, handler) => {
          if (event === 'change') {
            setTimeout(() => handler({matches: false}), 0)
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      })
    })

    afterEach(() => {
      window.ResizeObserver = originalResizeObserver
    })

    it('shows screen reader only text for Actions column header in fixed layout', async () => {
      render(
        <BulkEditTable
          assignments={standardAssignmentData()}
          updateAssignmentDate={mockUpdateAssignmentDate}
          setAssignmentSelected={mockSetAssignmentSelected}
          selectAllAssignments={mockSelectAllAssignments}
          clearOverrideEdits={mockClearOverrideEdits}
        />,
      )

      const actionsText = await screen.findByText('Actions')

      expect(actionsText).toHaveAttribute('class', expect.stringContaining('screenReaderContent'))
    })

    it('shows screen reader only text for Notes column header in fixed layout', async () => {
      render(
        <BulkEditTable
          assignments={standardAssignmentData()}
          updateAssignmentDate={mockUpdateAssignmentDate}
          setAssignmentSelected={mockSetAssignmentSelected}
          selectAllAssignments={mockSelectAllAssignments}
          clearOverrideEdits={mockClearOverrideEdits}
        />,
      )

      const notesText = await screen.findByText('Notes')

      expect(notesText).toHaveAttribute('class', expect.stringContaining('screenReaderContent'))
    })

    it('handles revert click without errors in fixed layout', async () => {
      const user = userEvent.setup()

      render(
        <BulkEditTable
          assignments={assignmentWithEditedOverride()}
          updateAssignmentDate={mockUpdateAssignmentDate}
          setAssignmentSelected={mockSetAssignmentSelected}
          selectAllAssignments={mockSelectAllAssignments}
          clearOverrideEdits={mockClearOverrideEdits}
        />,
      )

      const revertButton = screen.getByRole('button', {name: /revert date changes/i})
      await user.click(revertButton)

      expect(mockClearOverrideEdits).toHaveBeenCalledWith({
        assignmentId: 'assignment_1',
        overrideId: 'override_1',
      })
    })
  })
})
