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
import OverallSnapshot from '../OverallSnapshot'
import type {Snapshot} from '../../../types'

const mockSnapshot: Snapshot = {
  total_objectives: 3,
  completed: 6,
  in_progress: 4,
  not_started: 5,
  evaluation_metrics: [],
}

describe('OverallSnapshot', () => {
  it('renders all stat cards when snapshot is provided', () => {
    render(<OverallSnapshot snapshot={mockSnapshot} isLoading={false} />)
    expect(screen.getByTestId('snapshot-learning-targets')).toBeInTheDocument()
    expect(screen.getByTestId('snapshot-completed')).toBeInTheDocument()
    expect(screen.getByTestId('snapshot-in-progress')).toBeInTheDocument()
    expect(screen.getByTestId('snapshot-not-started')).toBeInTheDocument()
  })

  it('displays correct values in each card', () => {
    render(<OverallSnapshot snapshot={mockSnapshot} isLoading={false} />)
    expect(screen.getByTestId('snapshot-learning-targets')).toHaveTextContent('3')
    expect(screen.getByTestId('snapshot-completed')).toHaveTextContent('6')
    expect(screen.getByTestId('snapshot-in-progress')).toHaveTextContent('4')
    expect(screen.getByTestId('snapshot-not-started')).toHaveTextContent('5')
  })

  it('displays card labels', () => {
    render(<OverallSnapshot snapshot={mockSnapshot} isLoading={false} />)
    expect(screen.getByText('Talking points included')).toBeInTheDocument()
    expect(screen.getByText('Avg talking points hit')).toBeInTheDocument()
    expect(screen.getByText('Chats completed')).toBeInTheDocument()
    expect(screen.getByText('Chats in progress')).toBeInTheDocument()
    expect(screen.getByText('Chats not started')).toBeInTheDocument()
  })

  it('renders the Overall snapshot heading', () => {
    render(<OverallSnapshot snapshot={mockSnapshot} isLoading={false} />)
    expect(screen.getByText('Overall snapshot')).toBeInTheDocument()
  })

  it('renders nothing when snapshot is null and not loading', () => {
    const {container} = render(<OverallSnapshot snapshot={null} isLoading={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders loading spinner when isLoading is true', () => {
    render(<OverallSnapshot snapshot={null} isLoading={true} />)
    expect(screen.getByTestId('overall-snapshot-loading')).toBeInTheDocument()
    expect(screen.getByTitle('Loading snapshot')).toBeInTheDocument()
  })

  it('shows loading spinner instead of cards while loading', () => {
    render(<OverallSnapshot snapshot={mockSnapshot} isLoading={true} />)
    expect(screen.queryByTestId('overall-snapshot')).not.toBeInTheDocument()
    expect(screen.getByTestId('overall-snapshot-loading')).toBeInTheDocument()
  })

  it('renders avg met as completed/started fraction', () => {
    render(<OverallSnapshot snapshot={mockSnapshot} isLoading={false} />)
    // mockSnapshot: completed=6, in_progress=4 → started=10 → "6/10"
    expect(screen.getByTestId('snapshot-avg-met')).toHaveTextContent('6/10')
  })

  it('renders avg met as 0/0 when no one has started', () => {
    const noStarted = {...mockSnapshot, completed: 0, in_progress: 0}
    render(<OverallSnapshot snapshot={noStarted} isLoading={false} />)
    expect(screen.getByTestId('snapshot-avg-met')).toHaveTextContent('0/0')
  })
})
