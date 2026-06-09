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
import {InstUISettingsProvider} from '@instructure/emotion'
import {Flex} from '@instructure/ui-flex'
import AIExperienceRow from './AIExperienceRow'
import {roundedTheme} from '@canvas/ai-experiences/react/brand'
import type {AiExperience} from '../types'

interface AIExperienceListProps {
  canManage: boolean
  experiences: AiExperience[]
  totalStudents?: number
  onEdit: (id: number) => void
  onPublishChange: (id: number, newState: 'published' | 'unpublished') => void
  onDelete: (id: number) => void
}

const AIExperienceList: React.FC<AIExperienceListProps> = ({
  canManage,
  experiences,
  totalStudents,
  onEdit,
  onPublishChange,
  onDelete,
}) => {
  return (
    <InstUISettingsProvider theme={roundedTheme}>
      <Flex direction="column" gap="small">
        {experiences.map(experience => (
          <Flex.Item key={experience.id}>
            <AIExperienceRow
              canManage={canManage}
              id={experience.id}
              title={experience.title}
              description={experience.description}
              workflowState={experience.workflow_state}
              canUnpublish={experience.can_unpublish ?? true}
              contextReady={experience.context_ready ?? true}
              createdAt={experience.created_at}
              submissionStatus={experience.submission_status}
              completedCount={experience.completed_count}
              totalStudents={totalStudents}
              onEdit={onEdit}
              onPublishChange={onPublishChange}
              onDelete={onDelete}
            />
          </Flex.Item>
        ))}
      </Flex>
    </InstUISettingsProvider>
  )
}

export default AIExperienceList
