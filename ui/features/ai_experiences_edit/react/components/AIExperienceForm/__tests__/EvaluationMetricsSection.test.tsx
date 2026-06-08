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
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EvaluationMetricsSection, {
  DEFAULT_METRICS,
} from '@canvas/ai-experiences/react/components/EvaluationMetricsSection'
import {EvaluationMetric} from '../../../../types'

function renderSection(metrics: EvaluationMetric[] = DEFAULT_METRICS, onChange = vi.fn()) {
  return render(<EvaluationMetricsSection metrics={metrics} onChange={onChange} />)
}

describe('EvaluationMetricsSection', () => {
  describe('rendering', () => {
    it('renders the section heading', () => {
      renderSection()
      expect(screen.getByText('Evaluate with AI')).toBeInTheDocument()
    })

    it('renders all three default metric names', () => {
      renderSection()
      expect(screen.getByText('Summary')).toBeInTheDocument()
      expect(screen.getByText('Learning targets met')).toBeInTheDocument()
      expect(screen.getByText('Areas for improvement')).toBeInTheDocument()
    })

    it('renders descriptions for default metrics', () => {
      renderSection()
      expect(
        screen.getByText("An overall summary of the learner's conversation."),
      ).toBeInTheDocument()
      expect(screen.getByText('Which targets were hit and when.')).toBeInTheDocument()
      expect(screen.getByText('Guidance for how to improve their conversation')).toBeInTheDocument()
    })

    it('renders "Add AI metric" button when fewer than 5 metrics', () => {
      renderSection()
      expect(screen.getByTestId('evaluation-metrics-add-button')).toBeInTheDocument()
    })

    it('hides "Add AI metric" button at max capacity (5 metrics)', () => {
      const fiveMetrics: EvaluationMetric[] = [
        ...DEFAULT_METRICS,
        {name: 'Custom 1', description: 'Desc 1', enabled: true, visible_to_learners: false},
        {name: 'Custom 2', description: 'Desc 2', enabled: true, visible_to_learners: false},
      ]
      renderSection(fiveMetrics)
      expect(screen.queryByTestId('evaluation-metrics-add-button')).not.toBeInTheDocument()
    })

    it('Summary checkbox is disabled (locked)', () => {
      renderSection()
      expect(screen.getByTestId('evaluation-metric-enabled-0')).toBeDisabled()
    })

    it('does not show remove button for default metrics', () => {
      renderSection()
      expect(screen.queryByTestId('evaluation-metric-remove-0')).not.toBeInTheDocument()
      expect(screen.queryByTestId('evaluation-metric-remove-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('evaluation-metric-remove-2')).not.toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onChange when enabled checkbox is toggled for a non-locked metric', () => {
      const onChange = vi.fn()
      renderSection(DEFAULT_METRICS, onChange)
      fireEvent.click(screen.getByTestId('evaluation-metric-enabled-1'))
      expect(onChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({name: 'Learning targets met', enabled: false}),
        ]),
      )
    })

    it('removes a custom metric when remove button is clicked', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const metricsWithCustom: EvaluationMetric[] = [
        ...DEFAULT_METRICS,
        {
          name: 'My metric',
          description: 'My description',
          enabled: true,
          visible_to_learners: false,
        },
      ]
      renderSection(metricsWithCustom, onChange)
      const removeWrapper = screen.getByTestId('evaluation-metric-remove-3')
      await user.click(removeWrapper.querySelector('button')!)
      const updated = onChange.mock.calls[0][0] as EvaluationMetric[]
      expect(updated).toHaveLength(3)
      expect(updated.find(m => m.name === 'My metric')).toBeUndefined()
    })
  })

  describe('Add AI metric modal', () => {
    it('opens modal when "Add AI metric" is clicked', async () => {
      renderSection()
      fireEvent.click(screen.getByTestId('evaluation-metrics-add-button'))
      await waitFor(() => {
        expect(screen.getByTestId('add-metric-modal')).toBeInTheDocument()
      })
    })

    it('closes modal when Cancel is clicked', async () => {
      renderSection()
      fireEvent.click(screen.getByTestId('evaluation-metrics-add-button'))
      await waitFor(() => screen.getByTestId('add-metric-modal'))
      fireEvent.click(screen.getByTestId('add-metric-cancel-button'))
      await waitFor(() => {
        expect(screen.queryByTestId('add-metric-modal')).not.toBeInTheDocument()
      })
    })

    it('shows validation errors when Add is clicked with empty fields', async () => {
      renderSection()
      fireEvent.click(screen.getByTestId('evaluation-metrics-add-button'))
      await waitFor(() => screen.getByTestId('add-metric-modal'))
      fireEvent.click(screen.getByTestId('add-metric-add-button'))
      await waitFor(() => {
        expect(screen.getByText('Metric name is required')).toBeInTheDocument()
        expect(screen.getByText('Metric description is required')).toBeInTheDocument()
      })
    })

    it('calls onChange with new metric when Add is clicked with valid inputs', async () => {
      const onChange = vi.fn()
      renderSection(DEFAULT_METRICS, onChange)
      fireEvent.click(screen.getByTestId('evaluation-metrics-add-button'))
      await waitFor(() => screen.getByTestId('add-metric-modal'))

      fireEvent.change(screen.getByLabelText(/Metric name/i), {target: {value: 'Aha moment'}})
      fireEvent.change(screen.getByLabelText(/Metric description/i), {
        target: {value: 'Tell me when a learner really grasped the material.'},
      })
      fireEvent.click(screen.getByTestId('add-metric-add-button'))

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'Aha moment',
              description: 'Tell me when a learner really grasped the material.',
              enabled: true,
            }),
          ]),
        )
      })
    })

    it('closes modal after successfully adding a metric', async () => {
      renderSection()
      fireEvent.click(screen.getByTestId('evaluation-metrics-add-button'))
      await waitFor(() => screen.getByTestId('add-metric-modal'))

      fireEvent.change(screen.getByLabelText(/Metric name/i), {target: {value: 'Aha moment'}})
      fireEvent.change(screen.getByLabelText(/Metric description/i), {
        target: {value: 'Some description'},
      })
      fireEvent.click(screen.getByTestId('add-metric-add-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('add-metric-modal')).not.toBeInTheDocument()
      })
    })
  })
})
