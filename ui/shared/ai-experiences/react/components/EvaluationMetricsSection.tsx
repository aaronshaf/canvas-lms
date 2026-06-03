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

import React, {useState} from 'react'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Heading} from '@instructure/ui-heading'
import {Checkbox} from '@instructure/ui-checkbox'
import {Button} from '@instructure/ui-buttons'
import {TextInput} from '@instructure/ui-text-input'
import {TextArea} from '@instructure/ui-text-area'
import {Modal} from '@instructure/ui-modal'
import {IconPlusLine} from '@instructure/ui-icons'
import {useScope as createI18nScope} from '@canvas/i18n'
import {EvaluationMetric} from '../../types'

const I18n = createI18nScope('ai_experiences_edit')

const MAX_METRICS = 5
const LOCKED_METRIC_NAME = 'Summary'

export const DEFAULT_METRICS: EvaluationMetric[] = [
  {
    name: 'Summary',
    description: "An overall summary of the learner's conversation.",
    enabled: true,
    visible_to_learners: true,
  },
  {
    name: 'Learning targets met',
    description: 'Which targets were hit and when.',
    enabled: true,
    visible_to_learners: true,
  },
  {
    name: 'Areas for improvement',
    description: 'Guidance for how to improve their conversation',
    enabled: true,
    visible_to_learners: true,
  },
]

interface EvaluationMetricsSectionProps {
  metrics: EvaluationMetric[]
  onChange: (metrics: EvaluationMetric[]) => void
  readOnly?: boolean
}

interface AddMetricModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (metric: EvaluationMetric) => void
}

const AddMetricModal: React.FC<AddMetricModalProps> = ({isOpen, onClose, onAdd}) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibleToLearners, setVisibleToLearners] = useState(true)
  const [nameError, setNameError] = useState('')
  const [descriptionError, setDescriptionError] = useState('')

  const handleAdd = () => {
    let valid = true
    if (!name.trim()) {
      setNameError(I18n.t('Metric name is required'))
      valid = false
    } else if (name.trim().length > 255) {
      setNameError(I18n.t('Metric name must be 255 characters or fewer'))
      valid = false
    } else {
      setNameError('')
    }
    const trimmedDescription = description.trim()
    if (!trimmedDescription) {
      setDescriptionError(I18n.t('Metric description is required'))
      valid = false
    } else if (trimmedDescription.length < 10) {
      setDescriptionError(I18n.t('Metric description must be at least 10 characters'))
      valid = false
    } else if (trimmedDescription.length > 1000) {
      setDescriptionError(I18n.t('Metric description must be 1000 characters or fewer'))
      valid = false
    } else {
      setDescriptionError('')
    }
    if (!valid) return

    onAdd({
      name: name.trim(),
      description: description.trim(),
      enabled: true,
      visible_to_learners: visibleToLearners,
    })
    setName('')
    setDescription('')
    setVisibleToLearners(true)
    setNameError('')
    setDescriptionError('')
    onClose()
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setVisibleToLearners(true)
    setNameError('')
    setDescriptionError('')
    onClose()
  }

  return (
    <Modal
      open={isOpen}
      onDismiss={handleClose}
      size="small"
      label={I18n.t('Add AI metric')}
      data-testid="add-metric-modal"
    >
      <Modal.Header>
        <Heading>{I18n.t('Add AI metric')}</Heading>
      </Modal.Header>
      <Modal.Body>
        <View as="div" margin="0 0 medium 0">
          <Text>
            {I18n.t("Set up your own metric and we'll generate insights based on the following:")}
          </Text>
        </View>
        <View as="div" margin="0 0 medium 0">
          <TextInput
            data-testid="add-metric-name-input"
            renderLabel={I18n.t('Metric name')}
            isRequired
            value={name}
            onChange={(_e, val) => setName(val)}
            messages={nameError ? [{type: 'newError', text: nameError}] : []}
          />
        </View>
        <View as="div" margin="0 0 medium 0">
          <TextArea
            data-testid="add-metric-description-input"
            label={I18n.t('Metric description')}
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            resize="vertical"
            messages={descriptionError ? [{type: 'newError', text: descriptionError}] : []}
          />
        </View>
        {/* Visible to learners toggle — hidden until designed for release */}
      </Modal.Body>
      <Modal.Footer>
        <Button data-testid="add-metric-cancel-button" onClick={handleClose} margin="0 x-small 0 0">
          {I18n.t('Cancel')}
        </Button>
        <Button data-testid="add-metric-add-button" color="primary" onClick={handleAdd}>
          {I18n.t('Add')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

const isDefaultMetric = (metric: EvaluationMetric) =>
  DEFAULT_METRICS.some(d => d.name === metric.name)

const EvaluationMetricsSection: React.FC<EvaluationMetricsSectionProps> = ({
  metrics,
  onChange,
  readOnly = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false)

  const handleToggleEnabled = (index: number) => {
    onChange(metrics.map((m, i) => (i === index ? {...m, enabled: !m.enabled} : m)))
  }

  const handleToggleVisible = (index: number) => {
    onChange(
      metrics.map((m, i) =>
        i === index ? {...m, visible_to_learners: !m.visible_to_learners} : m,
      ),
    )
  }

  const handleAddMetric = (metric: EvaluationMetric) => {
    onChange([...metrics, metric])
  }

  const handleRemoveMetric = (index: number) => {
    onChange(metrics.filter((_, i) => i !== index))
  }

  return (
    <View as="div" data-testid="evaluation-metrics-section">
      <Heading level="h3" margin="0 0 x-small 0">
        {I18n.t('Evaluate with AI')}
      </Heading>
      <View as="div" margin="0 0 medium 0">
        <Text size="medium">
          {I18n.t(
            'Choose up to %{max} metrics that AI can provide evaluation support on these conversations.',
            {max: MAX_METRICS},
          )}
        </Text>
      </View>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {metrics.map((metric, index) => {
          const locked = metric.name === LOCKED_METRIC_NAME
          return (
            <div
              key={index}
              data-testid={`evaluation-metric-card-${index}`}
              style={{
                border: '1px solid #C7CDD1',
                borderRadius: '6px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <Flex alignItems="start" gap="x-small">
                <Flex.Item>
                  <Checkbox
                    data-testid={`evaluation-metric-enabled-${index}`}
                    label=""
                    checked={locked ? true : metric.enabled}
                    disabled={locked || readOnly}
                    onChange={() => handleToggleEnabled(index)}
                  />
                </Flex.Item>
                <Flex.Item shouldGrow shouldShrink>
                  <Text weight="bold">{metric.name}</Text>
                </Flex.Item>
                {!readOnly && !isDefaultMetric(metric) && (
                  <Flex.Item>
                    <Button
                      data-testid={`evaluation-metric-remove-${index}`}
                      size="small"
                      color="secondary"
                      withBackground={false}
                      onClick={() => handleRemoveMetric(index)}
                      aria-label={I18n.t('Remove metric')}
                    >
                      ×
                    </Button>
                  </Flex.Item>
                )}
              </Flex>

              <Text size="small" color="secondary">
                {metric.description}
              </Text>

              {/* Visible to learners toggle — hidden until designed for release */}
            </div>
          )
        })}
      </div>

      {!readOnly && metrics.length < MAX_METRICS && (
        <Button
          data-testid="evaluation-metrics-add-button"
          renderIcon={<IconPlusLine />}
          color="primary"
          onClick={() => setModalOpen(true)}
        >
          {I18n.t('Add AI metric')}
        </Button>
      )}

      <AddMetricModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAddMetric}
      />
    </View>
  )
}

export default EvaluationMetricsSection
