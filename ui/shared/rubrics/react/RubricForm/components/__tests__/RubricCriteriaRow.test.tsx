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
import userEvent from '@testing-library/user-event'
import {waitFor} from '@testing-library/dom'
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

const defaultCriterion = {
  id: 'crit1',
  description: 'Test Criterion',
  longDescription: '',
  points: 10,
  ratings: [
    {id: 'rat1', description: 'Full Marks', longDescription: '', points: 10, criterionId: 'crit1'},
    {id: 'rat2', description: 'No Marks', longDescription: '', points: 0, criterionId: 'crit1'},
  ],
  criterionUseRange: false,
}

const defaultProps = {
  criterion: defaultCriterion,
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

describe('RubricCriteriaRow', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('RegenerateCriteriaButton visibility', () => {
    it('shows the button when showRegenerateButtonFreeForm conditions are met and isCompactRatings is false', () => {
      const {getByTestId} = render(
        <RubricCriteriaRow
          {...defaultProps}
          freeFormCriterionComments={true}
          showCriteriaRegeneration={true}
          isCompactRatings={false}
          onRegenerateCriterion={vi.fn()}
        />,
      )
      expect(getByTestId('regenerate-criteria-button')).toBeInTheDocument()
    })

    it('hides the button when showRegenerateButtonFreeForm is true but isCompactRatings is true', () => {
      const {queryByTestId} = render(
        <RubricCriteriaRow
          {...defaultProps}
          freeFormCriterionComments={true}
          showCriteriaRegeneration={true}
          isCompactRatings={true}
          onRegenerateCriterion={vi.fn()}
        />,
      )
      expect(queryByTestId('regenerate-criteria-button')).not.toBeInTheDocument()
    })

    it('hides the button when showCriteriaRegeneration is false', () => {
      const {queryByTestId} = render(
        <RubricCriteriaRow
          {...defaultProps}
          freeFormCriterionComments={true}
          showCriteriaRegeneration={false}
          isCompactRatings={false}
          onRegenerateCriterion={vi.fn()}
        />,
      )
      expect(queryByTestId('regenerate-criteria-button')).not.toBeInTheDocument()
    })

    it('hides the button when onRegenerateCriterion is not provided', () => {
      const {queryByTestId} = render(
        <RubricCriteriaRow
          {...defaultProps}
          freeFormCriterionComments={true}
          showCriteriaRegeneration={true}
          isCompactRatings={false}
        />,
      )
      expect(queryByTestId('regenerate-criteria-button')).not.toBeInTheDocument()
    })
  })

  describe('XSS protection for longDescription', () => {
    // The description fields are plain text. XSS defense is HTML-escaping
    // (angle brackets become entities), not stripping. No actual HTML
    // elements should be injected into the DOM; event handlers never fire.

    const renderWithLongDescription = (longDescription: string) => {
      return render(
        <RubricCriteriaRow {...defaultProps} criterion={{...defaultCriterion, longDescription}} />,
      )
    }

    const renderWithOutcomeLongDescription = (longDescription: string) => {
      return render(
        <RubricCriteriaRow
          {...defaultProps}
          criterion={{...defaultCriterion, longDescription, learningOutcomeId: 'outcome_1'}}
        />,
      )
    }

    it('does not inject a <script> element for longDescription', () => {
      const {container} = renderWithLongDescription('<script>alert(1)</script>malicious')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.querySelector('script')).toBeNull()
      expect(longDescEl?.innerHTML).not.toContain('<script>')
    })

    it('does not inject an <img> element for onerror payloads in longDescription', () => {
      const {container} = renderWithLongDescription('<img src="x" onerror="alert(1)">')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.querySelector('img')).toBeNull()
    })

    it('does not inject a <div> element for onclick payloads in longDescription', () => {
      const {container} = renderWithLongDescription('<div onclick="alert(1)">click me</div>')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.querySelector('div')).toBeNull()
    })

    it('does not inject an <a> element for javascript: hrefs in longDescription', () => {
      const {container} = renderWithLongDescription('<a href="javascript:alert(1)">click</a>')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.querySelector('a')).toBeNull()
    })

    it('does not inject an <object> element for onerror payloads in longDescription', () => {
      const {container} = renderWithLongDescription('<object onerror="alert(3)">x</object>')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.querySelector('object')).toBeNull()
    })

    it('does not inject an <svg> element for onload payloads in longDescription', () => {
      const {container} = renderWithLongDescription('<svg onload="alert(1)"></svg>')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.querySelector('svg')).toBeNull()
    })

    it('shows angle-bracket text as visible plain text before server save', () => {
      const {container} = renderWithLongDescription('<your initials>')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.textContent).toContain('<your initials>')
    })

    it('shows script-shaped text as visible plain text, not blank', () => {
      const {container} = renderWithLongDescription('<script>alert(1)</script>')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.textContent).toContain('<script>alert(1)</script>')
    })

    it('shows server-format entity-encoded longDescription correctly', () => {
      const {container} = renderWithLongDescription('&lt;your initials&gt;')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.textContent).toContain('<your initials>')
    })

    it('renders server-format <br/> tags as line breaks in longDescription', () => {
      const {container} = renderWithLongDescription('line one<br/>line two')
      const longDescEl = container.querySelector(
        '[data-testid="rubric-criteria-row-long-description"]',
      )
      expect(longDescEl?.querySelector('br')).not.toBeNull()
    })

    describe('learning outcome criteria (Rich HTML — uses sanitizeHTML/strip contract)', () => {
      it('strips <script> tags from outcome longDescription', () => {
        const {container} = renderWithOutcomeLongDescription('<script>alert(1)</script>malicious')
        const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
        expect(descEl?.querySelector('script')).toBeNull()
        expect(descEl?.innerHTML).not.toContain('<script>')
        expect(descEl?.innerHTML).not.toContain('alert(1)')
      })

      it('strips onerror event handlers from outcome longDescription', () => {
        const {container} = renderWithOutcomeLongDescription('<img src="x" onerror="alert(1)">')
        const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
        expect(descEl?.innerHTML).not.toContain('onerror')
      })

      it('strips onclick event handlers from outcome longDescription', () => {
        const {container} = renderWithOutcomeLongDescription(
          '<div onclick="alert(1)">click me</div>',
        )
        const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
        expect(descEl?.innerHTML).not.toContain('onclick')
      })

      it('strips javascript: protocol from outcome longDescription', () => {
        const {container} = renderWithOutcomeLongDescription(
          '<a href="javascript:alert(1)">click</a>',
        )
        const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
        expect(descEl?.innerHTML).not.toContain('javascript:')
      })

      it('strips object tags with event handlers from outcome longDescription', () => {
        const {container} = renderWithOutcomeLongDescription(
          '<object onerror="alert(3)">x</object>',
        )
        const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
        expect(descEl?.innerHTML).not.toContain('onerror')
      })

      it('strips svg onload handlers from outcome longDescription', () => {
        const {container} = renderWithOutcomeLongDescription('<svg onload="alert(1)"></svg>')
        const descEl = container.querySelector('[data-testid="rubric-criteria-row-description"]')
        expect(descEl?.innerHTML).not.toContain('onload')
      })
    })
  })

  describe('CriterionRowPopover onRegenerate', () => {
    it('passes onRegenerate to the popover when isCompactRatings and showRegenerateButtonRatings are true', async () => {
      const user = userEvent.setup()
      const {getByTestId} = render(
        <RubricCriteriaRow
          {...defaultProps}
          isCompact={true}
          isCompactRatings={true}
          showCriteriaRegeneration={true}
          onRegenerateCriterion={vi.fn()}
        />,
      )

      await user.click(getByTestId('criterion-options-popover'))

      await waitFor(() => {
        expect(getByTestId('regenerate-criterion-menu-item')).toBeInTheDocument()
      })
    })

    it('passes onRegenerate to the popover when isCompactRatings and showRegenerateButtonFreeForm are true', async () => {
      const user = userEvent.setup()
      const {getByTestId} = render(
        <RubricCriteriaRow
          {...defaultProps}
          isCompact={true}
          isCompactRatings={true}
          freeFormCriterionComments={true}
          showCriteriaRegeneration={true}
          onRegenerateCriterion={vi.fn()}
        />,
      )

      await user.click(getByTestId('criterion-options-popover'))

      await waitFor(() => {
        expect(getByTestId('regenerate-criterion-menu-item')).toBeInTheDocument()
      })
    })

    it('does not pass onRegenerate to the popover when isCompactRatings is false', async () => {
      const user = userEvent.setup()
      const {getByTestId, queryByTestId} = render(
        <RubricCriteriaRow
          {...defaultProps}
          isCompact={true}
          isCompactRatings={false}
          showCriteriaRegeneration={true}
          onRegenerateCriterion={vi.fn()}
        />,
      )

      await user.click(getByTestId('criterion-options-popover'))

      await waitFor(() => {
        expect(getByTestId('move-up-criterion-menu-item')).toBeInTheDocument()
      })

      expect(queryByTestId('regenerate-criterion-menu-item')).not.toBeInTheDocument()
    })

    it('does not pass onRegenerate to the popover when neither showRegenerateButtonFreeForm nor showRegenerateButtonRatings are true', async () => {
      const user = userEvent.setup()
      const {getByTestId, queryByTestId} = render(
        <RubricCriteriaRow
          {...defaultProps}
          isCompact={true}
          isCompactRatings={true}
          showCriteriaRegeneration={false}
          onRegenerateCriterion={vi.fn()}
        />,
      )

      await user.click(getByTestId('criterion-options-popover'))

      await waitFor(() => {
        expect(getByTestId('move-up-criterion-menu-item')).toBeInTheDocument()
      })

      expect(queryByTestId('regenerate-criterion-menu-item')).not.toBeInTheDocument()
    })
  })
})
