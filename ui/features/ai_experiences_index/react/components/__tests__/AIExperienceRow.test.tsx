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
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIExperienceRow from '../AIExperienceRow'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  default: vi.fn().mockResolvedValue({json: {}}),
}))

const defaultProps = {
  canManage: true,
  id: 1,
  title: 'Customer Service Training',
  workflowState: 'published' as const,
  canUnpublish: true,
  contextReady: true,
  createdAt: '2025-01-15T10:30:00Z',
  onEdit: vi.fn(),
  onPublishChange: vi.fn(),
  onDelete: vi.fn(),
}

describe('AIExperienceRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global as any).ENV = {COURSE_ID: 123}
  })

  it('renders title and formatted creation date', () => {
    render(<AIExperienceRow {...defaultProps} />)

    expect(screen.getByText('Customer Service Training')).toBeInTheDocument()
    expect(screen.getByText(/Created on January 15, 2025/)).toBeInTheDocument()
  })

  it('title is rendered as a clickable link', () => {
    render(<AIExperienceRow {...defaultProps} />)

    const titleLink = screen.getByText('Customer Service Training')
    expect(titleLink).toHaveAttribute('href', '/courses/123/ai_experiences/1')
  })

  it('calls onEdit when edit menu item is clicked', async () => {
    const user = userEvent.setup()
    render(<AIExperienceRow {...defaultProps} />)

    await user.click(screen.getByTestId('ai-experience-menu'))
    await user.click(screen.getByText('Edit'))

    expect(defaultProps.onEdit).toHaveBeenCalledWith(1)
  })

  it('calls onDelete when delete menu item is clicked', async () => {
    const user = userEvent.setup()
    render(<AIExperienceRow {...defaultProps} />)

    await user.click(screen.getByTestId('ai-experience-menu'))
    await user.click(screen.getByText('Delete'))

    expect(defaultProps.onDelete).toHaveBeenCalledWith(1)
  })

  describe('Teacher view (canManage = true)', () => {
    it('shows publish button', () => {
      render(<AIExperienceRow {...defaultProps} />)
      expect(screen.getByTestId('ai-experience-publish-button')).toBeInTheDocument()
    })

    it('shows kebab menu with Edit and Delete options only', async () => {
      const user = userEvent.setup()
      render(<AIExperienceRow {...defaultProps} />)

      await user.click(screen.getByTestId('ai-experience-menu'))

      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
      expect(screen.queryByText('Test Conversation')).not.toBeInTheDocument()
    })

    it('shows completion count when completedCount and totalStudents are provided', () => {
      render(<AIExperienceRow {...defaultProps} completedCount={10} totalStudents={15} />)
      expect(screen.getByTestId('ai-experience-completion-count')).toHaveTextContent(
        '10/15 completed',
      )
    })

    it('does not show completion count when completedCount is not provided', () => {
      render(<AIExperienceRow {...defaultProps} />)
      expect(screen.queryByTestId('ai-experience-completion-count')).not.toBeInTheDocument()
    })

    it('calls onPublishChange after publish button is clicked and API resolves', async () => {
      const doFetchApi = await import('@canvas/do-fetch-api-effect')
      vi.mocked(doFetchApi.default).mockResolvedValueOnce({json: {}} as any)

      const user = userEvent.setup()
      render(<AIExperienceRow {...defaultProps} workflowState="unpublished" contextReady={true} />)

      await user.click(screen.getByTestId('ai-experience-publish-button'))

      await waitFor(() => {
        expect(defaultProps.onPublishChange).toHaveBeenCalledWith(1, 'published')
      })
    })
  })

  describe('Student view (canManage = false)', () => {
    const studentProps = {...defaultProps, canManage: false}

    it('does not show publish button', () => {
      render(<AIExperienceRow {...studentProps} />)
      expect(screen.queryByTestId('ai-experience-publish-button')).not.toBeInTheDocument()
    })

    it('does not show kebab menu', () => {
      render(<AIExperienceRow {...studentProps} />)
      expect(screen.queryByTestId('ai-experience-menu')).not.toBeInTheDocument()
    })

    it('title link is still clickable', () => {
      render(<AIExperienceRow {...studentProps} />)
      expect(screen.getByText('Customer Service Training')).toHaveAttribute(
        'href',
        '/courses/123/ai_experiences/1',
      )
    })

    it('renders description when provided', () => {
      render(
        <AIExperienceRow {...studentProps} description="Practice customer service scenarios" />,
      )
      expect(screen.getByText('Practice customer service scenarios')).toBeInTheDocument()
    })

    it('displays Not Started pill when submission_status is not_started', () => {
      render(<AIExperienceRow {...studentProps} submissionStatus="not_started" />)
      expect(screen.getByText('Not Started')).toBeInTheDocument()
    })

    it('displays In Progress pill (no percentage) when submission_status is in_progress', () => {
      render(<AIExperienceRow {...studentProps} submissionStatus="in_progress" />)
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })

    it('displays Completed pill when submission_status is completed', () => {
      render(<AIExperienceRow {...studentProps} submissionStatus="completed" />)
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('does not display a pill when submission_status is undefined', () => {
      render(<AIExperienceRow {...studentProps} />)
      expect(screen.queryByTestId('ai-experience-submission-status')).not.toBeInTheDocument()
    })
  })

  describe('Teacher view with submission status', () => {
    it('never displays submission status pill even when provided', () => {
      render(<AIExperienceRow {...defaultProps} submissionStatus="not_started" />)
      expect(screen.queryByText('Not Started')).not.toBeInTheDocument()
    })
  })
})
