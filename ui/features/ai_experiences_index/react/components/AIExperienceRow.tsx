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
import {useScope as useI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Link} from '@instructure/ui-link'
import {IconButton} from '@instructure/ui-buttons'
import {Menu} from '@instructure/ui-menu'
import {Pill} from '@instructure/ui-pill'
import {IconMoreLine} from '@instructure/ui-icons'
import AIExperiencePublishButton from '@canvas/ai-experiences/react/components/AIExperiencePublishButton'

interface AIExperienceRowProps {
  canManage: boolean
  id: number
  title: string
  description?: string
  workflowState: 'published' | 'unpublished'
  canUnpublish: boolean
  contextReady: boolean
  createdAt: string
  submissionStatus?: 'not_started' | 'in_progress' | 'completed'
  completedCount?: number
  totalStudents?: number
  onEdit: (id: number) => void
  onPublishChange: (id: number, newState: 'published' | 'unpublished') => void
  onDelete: (id: number) => void
}

const AIExperienceRow: React.FC<AIExperienceRowProps> = ({
  canManage,
  id,
  title,
  description,
  workflowState,
  canUnpublish,
  contextReady,
  createdAt,
  submissionStatus,
  completedCount,
  totalStudents,
  onEdit,
  onPublishChange,
  onDelete,
}) => {
  const I18n = useI18nScope('ai_experiences')
  const isPublished = workflowState === 'published'
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (canManage) {
    return (
      <View
        as="div"
        background="primary"
        padding="x-small small"
        borderWidth="small"
        borderColor="primary"
        borderRadius="medium"
      >
        <Flex justifyItems="space-between" alignItems="center">
          <Flex.Item shouldGrow shouldShrink>
            <View as="div" margin="0 0 0 small">
              <Link
                data-testid="ai-experiences-index-show-link"
                href={`/courses/${ENV.COURSE_ID}/ai_experiences/${id}`}
                isWithinText={false}
                themeOverride={{
                  color: 'inherit',
                  hoverColor: 'inherit',
                  fontWeight: 700,
                }}
                style={{
                  fontSize: '1.125rem',
                  textDecoration: 'none',
                }}
              >
                {title}
              </Link>
              <View as="div">
                <Text size="small" color="secondary">
                  {I18n.t('Created on %{date}', {date: formattedDate})}
                </Text>
              </View>
            </View>
          </Flex.Item>

          <Flex.Item>
            <Flex alignItems="center" gap="small">
              {completedCount !== undefined && totalStudents !== undefined && (
                <Flex.Item>
                  <Text size="small" color="secondary" data-testid="ai-experience-completion-count">
                    {I18n.t('%{completed}/%{total} completed', {
                      completed: completedCount,
                      total: totalStudents,
                    })}
                  </Text>
                </Flex.Item>
              )}
              <Flex.Item>
                <AIExperiencePublishButton
                  experienceId={String(id)}
                  courseId={ENV.COURSE_ID!}
                  isPublished={isPublished}
                  canUnpublish={canUnpublish}
                  contextReady={contextReady}
                  onPublishChange={newState => onPublishChange(id, newState)}
                />
              </Flex.Item>
              <Flex.Item>
                <Menu
                  trigger={
                    <IconButton
                      size="small"
                      withBackground={false}
                      withBorder={false}
                      screenReaderLabel={I18n.t('Knowledge Chat Options')}
                      data-testid="ai-experience-menu"
                    >
                      <IconMoreLine />
                    </IconButton>
                  }
                >
                  <Menu.Item
                    data-testid="ai-experiences-index-edit-menu-item"
                    onSelect={() => onEdit(id)}
                  >
                    {I18n.t('Edit')}
                  </Menu.Item>
                  <Menu.Item
                    data-testid="ai-experiences-index-delete-menu-item"
                    onSelect={() => onDelete(id)}
                  >
                    {I18n.t('Delete')}
                  </Menu.Item>
                </Menu>
              </Flex.Item>
            </Flex>
          </Flex.Item>
        </Flex>
      </View>
    )
  }

  return (
    <View
      as="div"
      background="primary"
      padding="medium small"
      borderWidth="small"
      borderColor="primary"
      borderRadius="large"
    >
      <Flex justifyItems="space-between" alignItems="start">
        <Flex.Item shouldGrow shouldShrink>
          <View as="div" margin="0 0 0 small">
            <Link
              data-testid="ai-experiences-index-show-link"
              href={`/courses/${ENV.COURSE_ID}/ai_experiences/${id}`}
              isWithinText={false}
              themeOverride={{
                color: 'inherit',
                hoverColor: 'inherit',
              }}
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {title}
            </Link>
            {description && (
              <View as="div" margin="xx-small 0 0 0">
                <Text color="secondary">{description}</Text>
              </View>
            )}
          </View>
        </Flex.Item>

        {submissionStatus && submissionStatus !== 'in_progress' ? (
          <Flex.Item>
            <View as="div" margin="0 small 0 0">
              <Pill
                color={submissionStatus === 'completed' ? 'success' : undefined}
                data-testid="ai-experience-submission-status"
              >
                <Text as="span" weight="bold">
                  {submissionStatus === 'completed' && I18n.t('Completed')}
                  {submissionStatus === 'not_started' && I18n.t('Not Started')}
                </Text>
              </Pill>
            </View>
          </Flex.Item>
        ) : submissionStatus === 'in_progress' ? (
          <Flex.Item>
            <View as="div" margin="0 small 0 0">
              <Pill color="info" data-testid="ai-experience-submission-status">
                <Text as="span" weight="bold">
                  {I18n.t('In Progress')}
                </Text>
              </Pill>
            </View>
          </Flex.Item>
        ) : null}
      </Flex>
    </View>
  )
}

export default AIExperienceRow
