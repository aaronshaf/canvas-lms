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

import React, {useState, useRef} from 'react'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Heading} from '@instructure/ui-heading'
import {Checkbox} from '@instructure/ui-checkbox'
import {Button, CloseButton} from '@instructure/ui-buttons'
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
    description: 'Key themes from conversation',
    enabled: true,
    visible_to_learners: true,
  },
  {
    name: 'Objectives',
    description: 'Student activity on required talking points',
    enabled: true,
    visible_to_learners: true,
  },
  {
    name: 'Opportunities',
    description: 'Areas for improved learning',
    enabled: true,
    visible_to_learners: true,
  },
]

interface EvaluationMetricsSectionProps {
  metrics: EvaluationMetric[]
  onChange: (metrics: EvaluationMetric[]) => void
  readOnly?: boolean
  showHeading?: boolean
  showDescription?: boolean
}

interface AddMetricModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (metric: EvaluationMetric) => void
}

const AddMetricModal: React.FC<AddMetricModalProps> = ({isOpen, onClose, onAdd}) => {
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibleToLearners, setVisibleToLearners] = useState(true)
  const [nameError, setNameError] = useState('')
  const [descriptionError, setDescriptionError] = useState('')

  const handleAdd = () => {
    let valid = true
    if (!name.trim()) {
      setNameError(I18n.t('Insight name is required'))
      valid = false
    } else if (name.trim().length > 255) {
      setNameError(I18n.t('Insight name must be 255 characters or fewer'))
      valid = false
    } else {
      setNameError('')
    }
    const trimmedDescription = description.trim()
    if (!trimmedDescription) {
      setDescriptionError(I18n.t('Insight description is required'))
      valid = false
    } else if (trimmedDescription.length < 10) {
      setDescriptionError(I18n.t('Insight description must be at least 10 characters'))
      valid = false
    } else if (trimmedDescription.length > 1000) {
      setDescriptionError(I18n.t('Insight description must be 1000 characters or fewer'))
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
      label={I18n.t('Add insight')}
      data-testid="add-metric-modal"
      defaultFocusElement={() => nameInputRef.current}
    >
      <Modal.Header>
        <Heading>{I18n.t('Add insight')}</Heading>
      </Modal.Header>
      <Modal.Body>
        <View as="div" margin="0 0 medium 0">
          <Text>
            {I18n.t("Set up your own insight and we'll generate it based on the following:")}
          </Text>
        </View>
        <View as="div" margin="0 0 medium 0">
          <TextInput
            data-testid="add-metric-name-input"
            renderLabel={I18n.t('Insight name')}
            isRequired
            value={name}
            onChange={(_e, val) => setName(val)}
            messages={nameError ? [{type: 'newError', text: nameError}] : []}
            inputRef={(el: HTMLInputElement | null) => {
              nameInputRef.current = el
            }}
          />
        </View>
        <View as="div" margin="0 0 medium 0">
          <TextArea
            data-testid="add-metric-description-input"
            label={I18n.t('Insight description')}
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
  showHeading = true,
  showDescription = true,
}) => {
  const [modalOpen, setModalOpen] = useState(false)
  const closeButtonRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map())
  const addButtonRef = useRef<HTMLButtonElement | null>(null)

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
    const customIndices = metrics
      .map((m, i) => i)
      .filter(i => i !== index && !isDefaultMetric(metrics[i]))

    const nextIdx = customIndices.find(i => i > index)
    const prevIdx = [...customIndices].reverse().find(i => i < index)

    // After removal, metrics after the removed index shift down by 1
    const postRemovalIndex =
      nextIdx !== undefined ? nextIdx - 1 : prevIdx !== undefined ? prevIdx : null

    onChange(metrics.filter((_, i) => i !== index))

    // Defer focus until after the re-render
    setTimeout(() => {
      if (postRemovalIndex !== null) {
        closeButtonRefs.current.get(postRemovalIndex)?.focus()
      } else {
        addButtonRef.current?.focus()
      }
    }, 0)
  }

  return (
    <View as="div" data-testid="evaluation-metrics-section">
      {showHeading && (
        <Heading level="h3" margin="0 0 x-small 0">
          {I18n.t('Evaluate with AI')}
        </Heading>
      )}
      {showDescription && (
        <View as="div" margin="0 0 medium 0">
          <Text size="medium">
            {I18n.t(
              'Choose up to %{max} metrics that AI can provide evaluation support on these conversations.',
              {max: MAX_METRICS},
            )}
          </Text>
        </View>
      )}

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
                <Flex.Item shouldGrow shouldShrink>
                  <Checkbox
                    data-testid={`evaluation-metric-enabled-${index}`}
                    label={metric.name}
                    checked={locked ? true : metric.enabled}
                    disabled={locked || readOnly}
                    onChange={() => handleToggleEnabled(index)}
                  />
                </Flex.Item>
                {!readOnly && !isDefaultMetric(metric) && (
                  <Flex.Item>
                    <CloseButton
                      data-testid={`evaluation-metric-remove-${index}`}
                      size="small"
                      screenReaderLabel={I18n.t('Remove %{name}', {name: metric.name})}
                      onClick={() => handleRemoveMetric(index)}
                      elementRef={(el: Element | null) => {
                        closeButtonRefs.current.set(index, el as HTMLButtonElement | null)
                      }}
                    />
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
          elementRef={(el: Element | null) => {
            addButtonRef.current = el as HTMLButtonElement | null
          }}
        >
          {I18n.t('Add insight')}
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
