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

import '@instructure/canvas-theme'
import React from 'react'
import {render, screen} from '@testing-library/react'
import ConversationMilestone from '../ConversationMilestone'

describe('ConversationMilestone', () => {
  describe('single variant', () => {
    it('renders the objective met heading', () => {
      render(<ConversationMilestone variant="single" objective="Who is the geologist?" />)
      expect(screen.getByText('Objective met')).toBeInTheDocument()
    })

    it('renders the objective text', () => {
      render(<ConversationMilestone variant="single" objective="Who is the geologist?" />)
      expect(screen.getByText('Who is the geologist?')).toBeInTheDocument()
    })

    it('renders without objective text when not provided', () => {
      render(<ConversationMilestone variant="single" />)
      expect(screen.getByText('Objective met')).toBeInTheDocument()
      expect(screen.getByTestId('conversation-milestone-single')).toBeInTheDocument()
    })

    it('has the correct testid', () => {
      render(<ConversationMilestone variant="single" objective="Test" />)
      expect(screen.getByTestId('conversation-milestone-single')).toBeInTheDocument()
    })
  })

  describe('all variant', () => {
    it('renders the all objectives met heading', () => {
      render(<ConversationMilestone variant="all" />)
      expect(screen.getByText('All objectives met')).toBeInTheDocument()
    })

    it('renders the stop or reset message', () => {
      render(<ConversationMilestone variant="all" />)
      expect(
        screen.getByText('You can stop here — or reset the chat to go again.'),
      ).toBeInTheDocument()
    })

    it('has the correct testid', () => {
      render(<ConversationMilestone variant="all" />)
      expect(screen.getByTestId('conversation-milestone-all')).toBeInTheDocument()
    })
  })
})
