/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import React, {useState, useEffect, useMemo} from 'react'
import {InstUISettingsProvider} from '@instructure/emotion'
import {useScope as createI18nScope} from '@canvas/i18n'
import {TextInput} from '@instructure/ui-text-input'
import {TextArea} from '@instructure/ui-text-area'
import {View} from '@instructure/ui-view'
import {Heading} from '@instructure/ui-heading'
import {Text} from '@instructure/ui-text'
import {Alert} from '@instructure/ui-alerts'
import type {GlobalEnv} from '@canvas/global/env/GlobalEnv'
import {AIExperience, AIExperienceFormData, EvaluationMetric} from '../../../types'
import FormHeader from './FormHeader'
import ConfigurationSection from './ConfigurationSection'
import EvaluationMetricsSection, {
  DEFAULT_METRICS,
} from '@canvas/ai-experiences/react/components/EvaluationMetricsSection'
import type {ContextFile} from '@canvas/canvas-file-upload/react/types'
import {roundedTheme} from '@canvas/ai-experiences/react/brand'

declare const ENV: GlobalEnv & {AI_EXPERIENCES_FIELD_MAX_LENGTH?: number}

const I18n = createI18nScope('ai_experiences_edit')

// Source of truth is AiExperience::TEACHER_AUTHORED_FIELD_MAX, served via
// js_env. The literal here is a fallback when ENV isn't populated (tests,
// dev paths that skip the controller). Keep both numbers aligned if changed.
export const TEACHER_AUTHORED_FIELD_MAX_FALLBACK = 10_000
export const TEACHER_AUTHORED_FIELD_MAX =
  ENV?.AI_EXPERIENCES_FIELD_MAX_LENGTH ?? TEACHER_AUTHORED_FIELD_MAX_FALLBACK

// Mirrors the model validator `validates :title, length: { maximum: 255 }`.
export const TITLE_MAX_LENGTH = 255

interface AIExperienceFormProps {
  aiExperience?: AIExperience | null
  onSubmit: (data: AIExperienceFormData) => void
  isLoading: boolean
  onCancel?: () => void
}

const AIExperienceForm: React.FC<AIExperienceFormProps> = ({
  aiExperience,
  onSubmit,
  isLoading,
  onCancel,
}) => {
  const [formData, setFormData] = useState<AIExperienceFormData>({
    title: '',
    description: '',
    facts: '',
    learning_objective: '',
    pedagogical_guidance: '',
  })
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [evaluationMetrics, setEvaluationMetrics] = useState<EvaluationMetric[]>(DEFAULT_METRICS)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)
  const [showErrorBanner, setShowErrorBanner] = useState(false)

  useEffect(() => {
    if (aiExperience) {
      setFormData({
        title: aiExperience.title || '',
        description: aiExperience.description || '',
        facts: aiExperience.facts || '',
        learning_objective: aiExperience.learning_objective || '',
        pedagogical_guidance: aiExperience.pedagogical_guidance || '',
      })
      if (aiExperience.context_files) {
        setContextFiles(aiExperience.context_files as ContextFile[])
      }
      if (aiExperience.evaluation_metrics && aiExperience.evaluation_metrics.length > 0) {
        setEvaluationMetrics(aiExperience.evaluation_metrics)
      }
    }
  }, [aiExperience])

  const handleInputChange =
    (field: keyof AIExperienceFormData) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData(prev => ({
        ...prev,
        [field]: event.target.value,
      }))
      // Clear error for this field when user starts typing
      if (errors[field]) {
        setErrors(prev => {
          const newErrors = {...prev}
          delete newErrors[field]
          return newErrors
        })
        // Hide error banner if no errors remain
        if (Object.keys(errors).length === 1) {
          setShowErrorBanner(false)
        }
      }
    }

  const handleContextFilesChange = (files: ContextFile[]) => {
    setContextFiles(files)
  }

  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = I18n.t('Knowledge chat name required')
    } else if (formData.title.length > TITLE_MAX_LENGTH) {
      newErrors.title = I18n.t('Knowledge chat name must be %{max} characters or fewer', {
        max: TITLE_MAX_LENGTH,
      })
    }

    if (formData.description.length > TEACHER_AUTHORED_FIELD_MAX) {
      newErrors.description = I18n.t(
        'Knowledge chat description must be %{max} characters or fewer',
        {max: TEACHER_AUTHORED_FIELD_MAX},
      )
    }

    if (formData.facts.length > TEACHER_AUTHORED_FIELD_MAX) {
      newErrors.facts = I18n.t('Text source must be %{max} characters or fewer', {
        max: TEACHER_AUTHORED_FIELD_MAX,
      })
    }

    if (!formData.learning_objective.trim()) {
      newErrors.learning_objective = I18n.t('Please provide at least one learning objective')
    } else if (formData.learning_objective.length > TEACHER_AUTHORED_FIELD_MAX) {
      newErrors.learning_objective = I18n.t(
        'Learning objective targets must be %{max} characters or fewer',
        {max: TEACHER_AUTHORED_FIELD_MAX},
      )
    }

    if (!formData.pedagogical_guidance.trim()) {
      newErrors.pedagogical_guidance = I18n.t('Please provide pedagogical guidance')
    } else if (formData.pedagogical_guidance.length > TEACHER_AUTHORED_FIELD_MAX) {
      newErrors.pedagogical_guidance = I18n.t(
        'Pedagogical guidance must be %{max} characters or fewer',
        {max: TEACHER_AUTHORED_FIELD_MAX},
      )
    }

    return newErrors
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const validationErrors = validateForm()
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      setShowErrors(true)
      setShowErrorBanner(true)
      return
    }

    const dataToSubmit: AIExperienceFormData = {
      ...formData,
      context_file_ids: contextFiles.map(f => f.id),
      evaluation_metrics: evaluationMetrics,
    }
    onSubmit(dataToSubmit)
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      window.history.back()
    }
  }

  const isEdit = useMemo(() => !!aiExperience?.id, [aiExperience?.id])

  return (
    <InstUISettingsProvider theme={roundedTheme}>
      <View as="div" maxWidth="1000px" margin="0 auto" padding="medium">
        {aiExperience?.failed_context_file_names?.length && (
          <Alert
            variant="error"
            renderCloseButtonLabel={false}
            margin="0 0 medium 0"
            data-testid="ai-experience-edit-index-failed-notice"
          >
            {I18n.t(
              "Activity couldn't be loaded. A source file has an issue. To try again, remove %{names} from your configurations.",
              {names: aiExperience.failed_context_file_names.join(', ')},
            )}
          </Alert>
        )}

        {showErrorBanner && showErrors && Object.keys(errors).length > 0 && (
          <Alert
            variant="error"
            renderCloseButtonLabel={I18n.t('Close')}
            onDismiss={() => setShowErrorBanner(false)}
            margin="0 0 medium 0"
          >
            {I18n.t(
              "The information you entered wasn't accepted. Update these fields to save your changes.",
            )}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate={true}>
          <FormHeader
            isEdit={isEdit}
            title={aiExperience?.title}
            onCancel={handleCancel}
            isLoading={isLoading}
          />

          <View
            as="div"
            background="primary"
            borderWidth="small"
            borderRadius="medium"
            padding="medium"
            margin="0 0 large 0"
          >
            <Heading level="h2" margin="0 0 x-small 0">
              <strong>{I18n.t('Content')}</strong>
            </Heading>
            <View as="div" margin="0 0 large 0">
              <Text size="medium">
                {I18n.t('Provide context and learning expectations to learners.')}
              </Text>
            </View>

            <View as="div" margin="0 0 medium 0">
              <TextInput
                data-testid="ai-experience-edit-title-input"
                renderLabel={I18n.t('Knowledge chat name')}
                value={formData.title}
                onChange={handleInputChange('title')}
                isRequired
                messages={
                  showErrors && errors.title ? [{type: 'newError', text: errors.title}] : []
                }
              />
            </View>

            <TextArea
              data-testid="ai-experience-edit-description-input"
              label={I18n.t('Knowledge chat description')}
              value={formData.description}
              onChange={handleInputChange('description')}
              resize="vertical"
              height="120px"
              messages={
                showErrors && errors.description
                  ? [{type: 'newError', text: errors.description}]
                  : []
              }
            />
          </View>

          <ConfigurationSection
            formData={formData}
            onChange={handleInputChange}
            showErrors={showErrors}
            errors={errors}
            contextFiles={contextFiles}
            onContextFilesChange={handleContextFilesChange}
            courseId={((window as any).ENV?.COURSE_ID || '').toString()}
            initialFailedFileNames={aiExperience?.failed_context_file_names}
          />

          <View
            as="div"
            background="primary"
            borderWidth="small"
            borderRadius="medium"
            padding="medium"
            margin="large 0 large 0"
          >
            <EvaluationMetricsSection metrics={evaluationMetrics} onChange={setEvaluationMetrics} />
          </View>
        </form>
      </View>
    </InstUISettingsProvider>
  )
}

export default AIExperienceForm
