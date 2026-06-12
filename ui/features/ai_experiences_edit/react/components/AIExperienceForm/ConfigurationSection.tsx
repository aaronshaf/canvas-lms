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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {TextArea} from '@instructure/ui-text-area'
import {View} from '@instructure/ui-view'
import {Heading} from '@instructure/ui-heading'
import {Text} from '@instructure/ui-text'
import {AIExperienceFormData} from '../../../types'
import CanvasFileUpload from '@canvas/canvas-file-upload/react/CanvasFileUpload'
import type {ContextFile} from '@canvas/canvas-file-upload/react/types'
import type {GlobalEnv} from '@canvas/global/env/GlobalEnv'
import {lightBlueButtonTheme, navyButtonTheme} from '@canvas/ai-experiences/react/brand'
import LearningObjectivesInput from './LearningObjectivesInput'

declare const ENV: GlobalEnv & {
  CONTEXT_FILE_MAX_SIZE_MB?: number
}

const I18n = createI18nScope('ai_experiences_edit')

interface ConfigurationSectionProps {
  formData: AIExperienceFormData
  onChange: (
    field: keyof AIExperienceFormData,
  ) => (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  onObjectivesChange: (objectives: string[]) => void
  showErrors: boolean
  errors: Record<string, string>
  contextFiles: ContextFile[]
  onContextFilesChange: (files: ContextFile[]) => void
  courseId: string
  initialFailedFileNames?: string[]
}

const ConfigurationSection: React.FC<ConfigurationSectionProps> = ({
  formData,
  onChange,
  onObjectivesChange,
  showErrors,
  errors,
  contextFiles,
  onContextFilesChange,
  courseId,
  initialFailedFileNames,
}) => {
  return (
    <View as="div" margin="large 0 0 0">
      <View
        as="div"
        background="primary"
        borderWidth="small"
        borderRadius="medium"
        padding="medium"
      >
        <Heading level="h2" margin="0 0 large 0">
          <strong>{I18n.t('2. AI guidance')}</strong>
        </Heading>

        {/* Learning objectives */}
        <View as="div">
          <View as="div">
            <Text weight="bold">{I18n.t('Talking points')}</Text>
          </View>
          <View as="div" margin="0 0 small 0">
            <Text size="small" color="secondary">
              {I18n.t('Used to create required talking points')}
            </Text>
          </View>
          <LearningObjectivesInput
            objectives={formData.learning_objectives}
            onChange={onObjectivesChange}
            error={showErrors ? errors.learning_objectives : undefined}
          />
        </View>

        {/* AI prompt */}
        <View as="div" margin="large 0 0 0">
          <TextArea
            data-testid="ai-experience-edit-pedagogical-guidance-input"
            label={I18n.t('AI prompt')}
            value={formData.pedagogical_guidance}
            onChange={onChange('pedagogical_guidance')}
            required
            resize="vertical"
            height="80px"
            maxHeight="300px"
            messages={
              showErrors && errors.pedagogical_guidance
                ? [{type: 'newError' as const, text: errors.pedagogical_guidance}]
                : []
            }
          />
        </View>

        {/* Text sources */}
        <View as="div" margin="large 0 0 0">
          <TextArea
            data-testid="ai-experience-edit-facts-input"
            label={I18n.t('Text sources')}
            value={formData.facts}
            onChange={onChange('facts')}
            resize="vertical"
            height="200px"
            maxHeight="400px"
            messages={
              showErrors && errors.facts ? [{type: 'newError' as const, text: errors.facts}] : []
            }
          />
        </View>

        {/* File sources */}
        <View as="div" margin="large 0 0 0">
          <CanvasFileUpload
            files={contextFiles}
            onFilesChange={onContextFilesChange}
            courseId={courseId}
            allowedFileTypes={['.docx', '.xlsx', '.xls', '.pptx', '.pdf', '.txt', '.html']}
            maxFileSizeMB={ENV?.CONTEXT_FILE_MAX_SIZE_MB ?? 300}
            maxFiles={10}
            initialFailedFileNames={initialFailedFileNames}
            primaryButtonThemeOverride={navyButtonTheme}
            secondaryButtonThemeOverride={lightBlueButtonTheme}
          />
        </View>
      </View>
    </View>
  )
}

export default ConfigurationSection
