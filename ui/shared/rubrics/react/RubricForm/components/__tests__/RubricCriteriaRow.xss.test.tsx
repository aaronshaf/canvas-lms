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
  // Non-outcome longDescription is "htmlified plain text" — teachers author it in a
  // plain <TextArea>, not the RCE. XSS defense is HTML-escaping (angle brackets become
  // entities), not stripping. No actual HTML elements should be injected; event handlers
  // never fire. Contrast with the outcome branch below, which is real Rich HTML.

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not inject a <script> element for longDescription', () => {
    const {container} = renderRow('<script>alert(1)</script>malicious')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.querySelector('script')).toBeNull()
    expect(longDescEl?.innerHTML).not.toContain('<script>')
  })

  it('does not inject a <div> for onclick payloads in longDescription', () => {
    const {container} = renderRow('<div onclick="alert(1)">click me</div>')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.querySelector('div')).toBeNull()
  })

  it('does not inject an <a> for javascript: hrefs in longDescription', () => {
    const {container} = renderRow('<a href="javascript:alert(1)">click</a>')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.querySelector('a')).toBeNull()
  })

  it('does not inject an <object> for onerror payloads in longDescription', () => {
    const {container} = renderRow('<object onerror="alert(3)">x</object>')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.querySelector('object')).toBeNull()
  })

  it('does not inject an <svg> for onload payloads in longDescription', () => {
    const {container} = renderRow('<svg onload="alert(1)"></svg>')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.querySelector('svg')).toBeNull()
  })

  it('shows angle-bracket text as visible plain text, not blank', () => {
    const {container} = renderRow('<your initials>')
    const longDescEl = container.querySelector(
      '[data-testid="rubric-criteria-row-long-description"]',
    )
    expect(longDescEl?.textContent).toContain('<your initials>')
  })

  describe('learning outcome criteria (Rich HTML — uses sanitizeHTML)', () => {
    // Outcome longDescription = LearningOutcome.description, which is RCE-authored
    // Rich HTML. sanitizeHTML (DOMPurify) strips dangerous tags but passes safe
    // markup through. This branch has a different contract from the plain-text branch.

    it('strips <script> tags from outcome longDescription', () => {
      const {container} = renderRowWithOutcome('<script>alert(1)</script>malicious')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('<script>')
      expect(descEl?.innerHTML).not.toContain('alert(1)')
    })

    it('strips onerror event handlers from outcome longDescription', () => {
      const {container} = renderRowWithOutcome('<img src="x" onerror="alert(1)">')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('onerror')
    })

    it('strips onclick event handlers from outcome longDescription', () => {
      const {container} = renderRowWithOutcome('<div onclick="alert(1)">click me</div>')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('onclick')
    })

    it('strips javascript: protocol from outcome longDescription', () => {
      const {container} = renderRowWithOutcome('<a href="javascript:alert(1)">click</a>')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('javascript:')
    })

    it('strips object tags with event handlers from outcome longDescription', () => {
      const {container} = renderRowWithOutcome('<object onerror="alert(3)">x</object>')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('onerror')
    })

    it('strips svg onload handlers from outcome longDescription', () => {
      const {container} = renderRowWithOutcome('<svg onload="alert(1)"></svg>')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.innerHTML).not.toContain('onload')
    })

    it('renders safe markup from outcome descriptions as HTML', () => {
      const {container} = renderRowWithOutcome('<strong>bold</strong>')
      const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
      expect(descEl?.querySelector('strong')?.textContent).toBe('bold')
    })
  })
})
