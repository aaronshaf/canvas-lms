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
import {render, screen, fireEvent} from '@testing-library/react'
import EvaluationInsights from '../EvaluationInsights'
import type {EvaluationMetric, ConversationEvaluation} from '../../../types'

const enabledMetrics: EvaluationMetric[] = [
  {name: 'Summary', enabled: true, visible_to_learners: false},
  {name: 'Learning targets met', enabled: true, visible_to_learners: true},
  {name: 'Areas for improvement', enabled: true, visible_to_learners: false},
]

describe('EvaluationInsights', () => {
  it('renders nothing when no enabled metrics', () => {
    const {container} = render(
      <EvaluationInsights
        metrics={[{name: 'Summary', enabled: false, visible_to_learners: false}]}
        isLoading={false}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an error alert (not the empty "not yet available" state) when the evaluation fails to load', () => {
    render(
      <EvaluationInsights
        metrics={enabledMetrics}
        isLoading={false}
        error={{
          message: 'Could not load the evaluation.',
          code: 'evaluation_failed',
          referenceId: 'ref-9',
        }}
      />,
    )
    expect(screen.getByTestId('ai-experience-error')).toBeInTheDocument()
    expect(screen.getByText('Could not load the evaluation.')).toBeInTheDocument()
    expect(screen.queryByText('Evaluation not yet available')).not.toBeInTheDocument()
  })

  it('renders nothing when metrics array is empty', () => {
    const {container} = render(<EvaluationInsights metrics={[]} isLoading={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the heading when there are enabled metrics', () => {
    render(<EvaluationInsights metrics={enabledMetrics} isLoading={false} />)
    expect(screen.getByText('Evaluation insights')).toBeInTheDocument()
  })

  it('renders a section for each enabled metric', () => {
    render(<EvaluationInsights metrics={enabledMetrics} isLoading={false} />)
    expect(screen.getByText('Summary')).toBeInTheDocument()
    expect(screen.getByText('Learning targets met')).toBeInTheDocument()
    expect(screen.getByText('Areas for improvement')).toBeInTheDocument()
  })

  it('does not render disabled metrics', () => {
    const mixed: EvaluationMetric[] = [
      {name: 'Summary', enabled: true, visible_to_learners: false},
      {name: 'Disabled metric', enabled: false, visible_to_learners: false},
    ]
    render(<EvaluationInsights metrics={mixed} isLoading={false} />)
    expect(screen.queryByText('Disabled metric')).not.toBeInTheDocument()
  })

  it('does not show "Visible to learners" badge (hidden until designed for release)', () => {
    render(<EvaluationInsights metrics={enabledMetrics} isLoading={false} />)
    expect(screen.queryByText('Visible to learners')).not.toBeInTheDocument()
  })

  it('shows empty evaluation state text per metric', () => {
    render(<EvaluationInsights metrics={enabledMetrics} isLoading={false} />)
    const emptyTexts = screen.getAllByText('Evaluation not yet available')
    expect(emptyTexts).toHaveLength(3)
  })

  it('renders loading spinner when isLoading is true', () => {
    render(<EvaluationInsights metrics={enabledMetrics} isLoading={true} />)
    expect(screen.getByTestId('evaluation-insights-loading')).toBeInTheDocument()
    expect(screen.getByTitle('Loading insights')).toBeInTheDocument()
  })

  it('does not show metric sections while loading', () => {
    render(<EvaluationInsights metrics={enabledMetrics} isLoading={true} />)
    expect(screen.queryByText('Summary')).not.toBeInTheDocument()
  })

  describe('with evaluation data', () => {
    const evaluation: ConversationEvaluation = {
      summary: 'The student demonstrated strong understanding of the material.',
      learning_objectives_evaluation: [
        {objective: 'Identify the geologist', met: true, met_at_turn: 2},
        {objective: 'Identify the commander', met: false, met_at_turn: null},
      ],
      areas_for_improvement: ['Could elaborate on reasoning', 'Should cite specific evidence'],
    }

    it('renders summary text', () => {
      render(
        <EvaluationInsights metrics={enabledMetrics} evaluation={evaluation} isLoading={false} />,
      )
      expect(
        screen.getByText('The student demonstrated strong understanding of the material.'),
      ).toBeInTheDocument()
    })

    it('renders met talking points with checkmark icon', () => {
      render(
        <EvaluationInsights metrics={enabledMetrics} evaluation={evaluation} isLoading={false} />,
      )
      expect(screen.getByText('Identify the geologist')).toBeInTheDocument()
    })

    it('renders unmet talking points', () => {
      render(
        <EvaluationInsights metrics={enabledMetrics} evaluation={evaluation} isLoading={false} />,
      )
      expect(screen.getByText('Identify the commander')).toBeInTheDocument()
    })

    it('shows "Met at turn" for a met talking point with a turn', () => {
      render(
        <EvaluationInsights metrics={enabledMetrics} evaluation={evaluation} isLoading={false} />,
      )
      expect(screen.getByText('Met at turn 2')).toBeInTheDocument()
    })

    it('does not show "Met at turn" for an unmet talking point', () => {
      render(
        <EvaluationInsights metrics={enabledMetrics} evaluation={evaluation} isLoading={false} />,
      )
      // Only the met objective ("Identify the geologist", turn 2) shows a turn line;
      // the unmet "Identify the commander" (met:false, met_at_turn:null) does not.
      expect(screen.queryAllByText(/Met at turn/)).toHaveLength(1)
    })

    it('does not show "Met at turn" when met_at_turn is missing', () => {
      const evalNoTurn: ConversationEvaluation = {
        summary: 'No turn data.',
        learning_objectives_evaluation: [
          {objective: 'Identify the geologist', met: true, met_at_turn: null},
        ],
      }
      render(
        <EvaluationInsights metrics={enabledMetrics} evaluation={evalNoTurn} isLoading={false} />,
      )
      expect(screen.getByText('Identify the geologist')).toBeInTheDocument()
      expect(screen.queryByText(/Met at turn/)).not.toBeInTheDocument()
    })

    it('renders areas for improvement as bullet points', () => {
      render(
        <EvaluationInsights metrics={enabledMetrics} evaluation={evaluation} isLoading={false} />,
      )
      expect(screen.getByText('• Could elaborate on reasoning')).toBeInTheDocument()
      expect(screen.getByText('• Should cite specific evidence')).toBeInTheDocument()
    })

    it('does not show "Evaluation not yet available" when evaluation is present', () => {
      render(
        <EvaluationInsights metrics={enabledMetrics} evaluation={evaluation} isLoading={false} />,
      )
      expect(screen.queryByText('Evaluation not yet available')).not.toBeInTheDocument()
    })

    it('renders custom metric response', () => {
      const customMetrics: EvaluationMetric[] = [
        {name: 'Truthfulness', enabled: true, visible_to_learners: false},
      ]
      const evalWithCustom: ConversationEvaluation = {
        summary: 'Good',
        custom_metrics: [{metric: 'Truthfulness', response: 'Student responses were accurate.'}],
      }
      render(
        <EvaluationInsights
          metrics={customMetrics}
          evaluation={evalWithCustom}
          isLoading={false}
        />,
      )
      expect(screen.getByText('Student responses were accurate.')).toBeInTheDocument()
    })

    it('shows "No talking points data" when learning_objectives_evaluation is empty', () => {
      const evalNoObjectives: ConversationEvaluation = {
        summary: 'Short conversation.',
        learning_objectives_evaluation: [],
      }
      render(
        <EvaluationInsights
          metrics={enabledMetrics}
          evaluation={evalNoObjectives}
          isLoading={false}
        />,
      )
      expect(screen.getByText('No talking points data')).toBeInTheDocument()
    })

    it('shows "No areas identified" when areas_for_improvement is empty', () => {
      const evalNoAreas: ConversationEvaluation = {
        summary: 'Perfect.',
        areas_for_improvement: [],
      }
      render(
        <EvaluationInsights metrics={enabledMetrics} evaluation={evalNoAreas} isLoading={false} />,
      )
      expect(screen.getByText('No areas identified')).toBeInTheDocument()
    })

    it('shows the configured metric name verbatim and still maps GA names to llma fields', () => {
      // GA copy: "Objectives" / "Opportunities" must render as-is (no relabeling)
      // AND resolve to llma's learning_objectives_evaluation / areas_for_improvement.
      const gaMetrics: EvaluationMetric[] = [
        {name: 'Objectives', enabled: true, visible_to_learners: false},
        {name: 'Opportunities', enabled: true, visible_to_learners: false},
      ]
      render(<EvaluationInsights metrics={gaMetrics} evaluation={evaluation} isLoading={false} />)

      // Headings keep the GA copy.
      expect(screen.getByText('Objectives')).toBeInTheDocument()
      expect(screen.getByText('Opportunities')).toBeInTheDocument()
      // Content resolves to the llma evaluation fields (not "not yet available").
      expect(screen.getByText('Identify the geologist')).toBeInTheDocument()
      expect(screen.getByText('• Could elaborate on reasoning')).toBeInTheDocument()
      expect(screen.queryByText('Evaluation not yet available')).not.toBeInTheDocument()
    })

    it('still maps the legacy "Learning targets met" / "Areas for improvement" names', () => {
      const legacyMetrics: EvaluationMetric[] = [
        {name: 'Learning targets met', enabled: true, visible_to_learners: false},
        {name: 'Areas for improvement', enabled: true, visible_to_learners: false},
      ]
      render(
        <EvaluationInsights metrics={legacyMetrics} evaluation={evaluation} isLoading={false} />,
      )
      expect(screen.getByText('Identify the geologist')).toBeInTheDocument()
      expect(screen.getByText('• Could elaborate on reasoning')).toBeInTheDocument()
      expect(screen.queryByText('Evaluation not yet available')).not.toBeInTheDocument()
    })
  })

  describe('reset button', () => {
    const evaluation: ConversationEvaluation = {summary: 'Solid work.'}

    it('renders the reset button when an evaluation exists and onRegenerate is provided', () => {
      render(
        <EvaluationInsights
          metrics={enabledMetrics}
          evaluation={evaluation}
          isLoading={false}
          onRegenerate={() => {}}
        />,
      )
      expect(screen.getByTestId('evaluation-regenerate-button')).toBeInTheDocument()
    })

    it('does not render the reset button when no evaluation exists', () => {
      render(
        <EvaluationInsights metrics={enabledMetrics} isLoading={false} onRegenerate={() => {}} />,
      )
      expect(screen.queryByTestId('evaluation-regenerate-button')).not.toBeInTheDocument()
    })

    it('does not render the reset button while loading', () => {
      render(
        <EvaluationInsights
          metrics={enabledMetrics}
          evaluation={evaluation}
          isLoading={true}
          onRegenerate={() => {}}
        />,
      )
      expect(screen.queryByTestId('evaluation-regenerate-button')).not.toBeInTheDocument()
    })

    it('calls onRegenerate when the reset button is clicked', () => {
      const onRegenerate = jest.fn()
      render(
        <EvaluationInsights
          metrics={enabledMetrics}
          evaluation={evaluation}
          isLoading={false}
          onRegenerate={onRegenerate}
        />,
      )
      fireEvent.click(screen.getByTestId('evaluation-regenerate-button'))
      expect(onRegenerate).toHaveBeenCalledTimes(1)
    })

    it('disables the reset button while regenerating', () => {
      render(
        <EvaluationInsights
          metrics={enabledMetrics}
          evaluation={evaluation}
          isLoading={false}
          isRegenerating={true}
          onRegenerate={() => {}}
        />,
      )
      const button = screen.getByTestId('evaluation-regenerate-button')
      expect(button).toBeDisabled()
    })
  })

  describe('stale alert', () => {
    const evaluation: ConversationEvaluation = {summary: 'Solid work.'}

    it('renders the stale alert when stale is true', () => {
      render(
        <EvaluationInsights
          metrics={enabledMetrics}
          evaluation={evaluation}
          isLoading={false}
          stale={true}
          onRegenerate={() => {}}
        />,
      )
      expect(screen.getByTestId('evaluation-stale-alert')).toBeInTheDocument()
    })

    it('does not render the stale alert when stale is false', () => {
      render(
        <EvaluationInsights
          metrics={enabledMetrics}
          evaluation={evaluation}
          isLoading={false}
          stale={false}
          onRegenerate={() => {}}
        />,
      )
      expect(screen.queryByTestId('evaluation-stale-alert')).not.toBeInTheDocument()
    })
  })
})
