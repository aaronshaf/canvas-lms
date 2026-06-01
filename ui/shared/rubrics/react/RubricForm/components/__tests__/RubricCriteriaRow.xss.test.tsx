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
import {render} from '@testing-library/react'
import {RubricCriteriaRow} from '../RubricCriteriaRow'

vi.mock('react-beautiful-dnd', () => ({
  Draggable: ({children}: any) =>
    children({dragHandleProps: {}, draggableProps: {}, innerRef: () => {}}, {}),
  DragDropContext: ({children}: any) => children,
  Droppable: ({children}: any) => children({droppableProps: {}, innerRef: () => {}}, {}),
}))

vi.mock('@canvas/graphql', () => ({
  executeQuery: vi.fn(),
}))

vi.mock('../../../RubricAssessment/queries/useGetRubricOutcome', () => ({
  useGetRubricOutcome: () => ({data: undefined}),
}))

const defaultProps = {
  freeFormCriterionComments: false,
  hidePoints: false,
  isCompact: false,
  isCompactRatings: false,
  isCompactOutcome: false,
  rowIndex: 1,
  isAIRubricsAvailable: false,
  selectLearningOutcome: vi.fn(),
  onDeleteCriterion: vi.fn(),
  onDuplicateCriterion: vi.fn(),
  onEditCriterion: vi.fn(),
  handleMoveCriterion: vi.fn(),
  criterionIndex: 0,
  isFirstCriterion: false,
  isLastCriterion: false,
}

const renderRow = (longDescription: string) =>
  render(
    <RubricCriteriaRow
      {...defaultProps}
      criterion={{
        id: 'crit1',
        description: 'Test Criterion',
        longDescription,
        points: 10,
        ratings: [{id: 'rat1', description: 'Full Marks', longDescription: '', points: 10}],
        criterionUseRange: false,
      }}
    />,
  )

const renderRowWithOutcome = (longDescription: string) =>
  render(
    <RubricCriteriaRow
      {...defaultProps}
      criterion={{
        id: 'crit1',
        description: 'Test Criterion',
        longDescription,
        learningOutcomeId: 'outcome_1',
        points: 10,
        ratings: [{id: 'rat1', description: 'Full Marks', longDescription: '', points: 10}],
        criterionUseRange: false,
      }}
    />,
  )

describe('RubricCriteriaRow long description XSS mitigation', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('strips <script> tags from longDescription', () => {
    const {container} = renderRow('<script>alert(1)</script>malicious')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.innerHTML).not.toContain('<script>')
    expect(longDescEl?.innerHTML).not.toContain('alert(1)')
  })

  it('strips onclick event handlers from longDescription', () => {
    const {container} = renderRow('<div onclick="alert(1)">click me</div>')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.innerHTML).not.toContain('onclick')
  })

  it('strips javascript: protocol from longDescription', () => {
    const {container} = renderRow('<a href="javascript:alert(1)">click</a>')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.innerHTML).not.toContain('javascript:')
  })

  it('strips object tags with event handlers from longDescription', () => {
    const {container} = renderRow('<object onerror="alert(3)">x</object>')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.innerHTML).not.toContain('onerror')
  })

  it('strips svg onload handlers from longDescription', () => {
    const {container} = renderRow('<svg onload="alert(1)"></svg>')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.innerHTML).not.toContain('onload')
  })

  it('renders safe HTML as rich content', () => {
    const {getByTestId} = renderRow('<strong>bold</strong>')
    expect(
      getByTestId('rubric-criteria-row-long-description').querySelector('strong')?.textContent,
    ).toBe('bold')
  })

  describe('learning outcome criteria', () => {
    it('strips <script> tags from longDescription', () => {
      const {container} = renderRowWithOutcome('<script>alert(1)</script>malicious')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('<script>')
      expect(descEl?.innerHTML).not.toContain('alert(1)')
    })

    it('strips onerror event handlers from longDescription', () => {
      const {container} = renderRowWithOutcome('<img src="x" onerror="alert(1)">')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('onerror')
    })

    it('strips onclick event handlers from longDescription', () => {
      const {container} = renderRowWithOutcome('<div onclick="alert(1)">click me</div>')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('onclick')
    })

    it('strips javascript: protocol from longDescription', () => {
      const {container} = renderRowWithOutcome('<a href="javascript:alert(1)">click</a>')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('javascript:')
    })

    it('strips object tags with event handlers from longDescription', () => {
      const {container} = renderRowWithOutcome('<object onerror="alert(3)">x</object>')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('onerror')
    })

    it('strips svg onload handlers from longDescription', () => {
      const {container} = renderRowWithOutcome('<svg onload="alert(1)"></svg>')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('onload')
    })
  })
})
