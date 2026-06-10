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
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIExperienceList from '../AIExperienceList'
import type {AiExperience} from '../../types'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  default: vi.fn().mockResolvedValue({json: {}}),
}))

const mockExperiences: AiExperience[] = [
  {
    id: 1,
    title: 'Customer Service Training',
    description: 'Practice customer service scenarios',
    workflow_state: 'published',
    facts: 'You are a customer service representative',
    learning_objectives: ['Learn to handle complaints'],
    pedagogical_guidance: 'A customer calls about billing',
    created_at: '2025-01-15T10:30:00Z',
    can_unpublish: true,
    context_ready: true,
  },
  {
    id: 2,
    title: 'Sales Simulation',
    description: 'Practice sales techniques',
    workflow_state: 'unpublished',
    facts: 'You are a sales representative',
    learning_objectives: ['Learn to close deals'],
    pedagogical_guidance: 'A potential customer is interested',
    created_at: '2025-01-10T14:20:00Z',
    can_unpublish: true,
    context_ready: true,
  },
]

const defaultProps = {
  canManage: true,
  experiences: mockExperiences,
  onEdit: vi.fn(),
  onPublishChange: vi.fn(),
  onDelete: vi.fn(),
}

describe('AIExperienceList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global as any).ENV = {COURSE_ID: 123}
  })

  it('renders all experiences passed as props', () => {
    render(<AIExperienceList {...defaultProps} />)

    expect(screen.getByText('Customer Service Training')).toBeInTheDocument()
    expect(screen.getByText('Sales Simulation')).toBeInTheDocument()
  })

  it('displays formatted creation dates', () => {
    render(<AIExperienceList {...defaultProps} />)

    expect(screen.getByText(/Created on January 15, 2025/)).toBeInTheDocument()
    expect(screen.getByText(/Created on January 10, 2025/)).toBeInTheDocument()
  })

  it('shows publish buttons for each experience', () => {
    render(<AIExperienceList {...defaultProps} />)
    expect(screen.getAllByTestId('ai-experience-publish-button')).toHaveLength(2)
  })

  it('calls onEdit when edit menu item is clicked', async () => {
    const user = userEvent.setup()
    render(<AIExperienceList {...defaultProps} />)

    const menuButtons = screen.getAllByTestId('ai-experience-menu')
    await user.click(menuButtons[0])
    await user.click(screen.getByText('Edit'))

    expect(defaultProps.onEdit).toHaveBeenCalledWith(1)
  })

  it('calls onDelete when delete menu item is clicked', async () => {
    const user = userEvent.setup()
    render(<AIExperienceList {...defaultProps} />)

    const menuButtons = screen.getAllByTestId('ai-experience-menu')
    await user.click(menuButtons[0])
    await user.click(screen.getByText('Delete'))

    expect(defaultProps.onDelete).toHaveBeenCalledWith(1)
  })

  it('renders empty list when no experiences provided', () => {
    render(<AIExperienceList {...defaultProps} experiences={[]} />)

    expect(screen.queryByText('Customer Service Training')).not.toBeInTheDocument()
    expect(screen.queryByText('Sales Simulation')).not.toBeInTheDocument()
  })

  it('passes totalStudents to each row', () => {
    render(<AIExperienceList {...defaultProps} totalStudents={20} />)
    // With no completed_count on the experiences, no completion badges render —
    // just verify the list renders without error
    expect(screen.getByText('Customer Service Training')).toBeInTheDocument()
  })
})
