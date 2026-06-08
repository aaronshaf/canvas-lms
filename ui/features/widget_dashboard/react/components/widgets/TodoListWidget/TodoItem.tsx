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

import React, {useEffect, useRef} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Button, IconButton} from '@instructure/ui-buttons'
import {AccessibleContent} from '@instructure/ui-a11y-content'
import {View} from '@instructure/ui-view'
import {Link} from '@instructure/ui-link'
import {IconCheckPlusLine, IconCheckLine, IconEditLine} from '@instructure/ui-icons'
import {Spinner} from '@instructure/ui-spinner'
import type {PlannerItem, PlannerOverride} from './types'
import {
  formatDate,
  formatAnnouncementDate,
  getPlannableTypeLabel,
  isOverdue,
  isClosed,
} from './utils'
import {usePlannerOverride} from './hooks/usePlannerOverride'
import {useWidgetTheme} from '../../../theme/WidgetThemeContext'

const I18n = createI18nScope('widget_dashboard')

interface TodoItemProps {
  item: PlannerItem
  onItemUpdate?: (plannableId: string, plannableType: string, override: PlannerOverride) => void
  onEdit?: (item: PlannerItem) => void
  readOnly?: boolean
}

const TodoItem: React.FC<TodoItemProps> = ({item, onItemUpdate, onEdit, readOnly = false}) => {
  const isAnnouncement = item.plannable_type === 'announcement'
  // Only self-authored planner notes can be edited by the student.
  const isPlannerNote = item.plannable_type === 'planner_note'
  const dateText = isAnnouncement
    ? formatAnnouncementDate(item.plannable_date)
    : formatDate(item.plannable_date)
  const isItemOverdue = isAnnouncement ? false : isOverdue(item.plannable_date)
  const isItemClosed = !isAnnouncement && isClosed(item.plannable.lock_at)
  const typeLabel = getPlannableTypeLabel(item.plannable_type)
  const {toggleComplete, isLoading} = usePlannerOverride({
    onSuccess: (override, {item: toggledItem}) => {
      onItemUpdate?.(toggledItem.plannable_id, toggledItem.plannable_type, override)
    },
  })
  const {colors, isDark} = useWidgetTheme()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const previousLoadingRef = useRef<boolean>(false)

  const isSubmissionObject = typeof item.submissions === 'object'

  const isExcused = item.submissions && isSubmissionObject && item.submissions.excused === true

  const isMarkedComplete = item.planner_override
    ? item.planner_override.marked_complete
    : item.submissions &&
      isSubmissionObject &&
      item.submissions.submitted &&
      !item.submissions.redo_request

  // Excused items default to "complete" unless the student has explicitly
  // opted them back in by setting marked_complete: false on the override.
  const isExcusedAndNotOptedBack = isExcused && !(item.planner_override?.marked_complete === false)
  const effectiveComplete = !!(isMarkedComplete || isExcusedAndNotOptedBack)

  // For planner notes, course_id may be in plannable.course_id instead of item.course_id
  const courseId = item.course_id || item.plannable.course_id

  useEffect(() => {
    if (previousLoadingRef.current && !isLoading) {
      buttonRef.current?.focus()
    }
    previousLoadingRef.current = isLoading
  }, [isLoading])

  const handleCheckboxClick = () => {
    toggleComplete({
      item,
      markedComplete: !effectiveComplete,
    })
  }

  return (
    <View
      as="div"
      padding="small"
      margin="small 0"
      borderWidth="small"
      borderRadius="large"
      background="secondary"
      data-testid={`todo-item-${item.plannable_id}`}
      role="group"
      aria-label={item.plannable?.title ?? I18n.t('Unnamed To-Do')}
      themeOverride={{
        backgroundSecondary: colors.cardSecondary,
      }}
    >
      <Flex direction="column">
        <Flex.Item overflowY="visible" overflowX="visible">
          <Flex justifyItems="space-between" alignItems="start" gap="small">
            <Flex.Item shouldShrink>
              <Text size="small" color="secondary">
                {typeLabel}
              </Text>
            </Flex.Item>
            {isPlannerNote && !readOnly && (
              <Flex.Item overflowY="visible" overflowX="visible">
                <IconButton
                  screenReaderLabel={I18n.t('Edit %{title}', {title: item.plannable.title})}
                  renderIcon={IconEditLine}
                  onClick={() => onEdit?.(item)}
                  data-testid={`todo-edit-${item.plannable_id}`}
                  size="small"
                  withBackground={false}
                  withBorder={false}
                  themeOverride={
                    isDark
                      ? {
                          secondaryGhostColor: colors.textPrimary,
                          secondaryGhostHoverBackground: colors.cardBackground,
                        }
                      : undefined
                  }
                />
              </Flex.Item>
            )}
          </Flex>
        </Flex.Item>

        <Flex.Item overflowY="visible">
          <Link
            href={item.html_url}
            isWithinText={false}
            data-testid={`todo-link-${item.plannable_id}`}
          >
            <Text
              weight="bold"
              wrap="break-word"
              color={effectiveComplete ? 'secondary' : undefined}
            >
              {item.plannable.title}
            </Text>
          </Link>
        </Flex.Item>

        {item.plannable.details && (
          <Flex.Item>
            <Text size="small" color="secondary" wrap="break-word" lineHeight="condensed">
              {item.plannable.details}
            </Text>
          </Flex.Item>
        )}

        {courseId && item.context_name && (
          <Flex.Item overflowY="visible">
            <Link
              href={`/courses/${courseId}`}
              isWithinText={false}
              data-testid={`todo-item-course-link-${item.plannable_id}`}
            >
              <Text wrap="break-word" size="small" color="secondary">
                {item.context_name}
              </Text>
            </Link>
          </Flex.Item>
        )}

        <Flex.Item overflowY="visible">
          <Text size="small">
            {isExcused ? (
              <Text size="small" color="success">
                {I18n.t('Excused')}
              </Text>
            ) : isItemClosed ? (
              <Text size="small" color="secondary">
                {I18n.t('Closed')}
              </Text>
            ) : (
              dateText && (
                <Text size="small" color={isItemOverdue ? 'danger' : 'secondary'}>
                  {dateText}
                </Text>
              )
            )}
            {(isItemClosed || dateText) &&
              item.plannable.points_possible !== undefined &&
              item.plannable.points_possible !== null &&
              item.plannable.points_possible > 0 && (
                <Text size="small" color="secondary">
                  {' | '}
                </Text>
              )}
            {item.plannable.points_possible !== undefined &&
              item.plannable.points_possible !== null &&
              item.plannable.points_possible > 0 && (
                <Text size="small" color="secondary">
                  {I18n.t('%{points} points', {points: item.plannable.points_possible})}
                </Text>
              )}
          </Text>
        </Flex.Item>

        <Flex.Item margin="x-small 0 0 0" overflowY="visible" overflowX="visible">
          <Flex gap="small" alignItems="center">
            <Flex.Item overflowY="visible" overflowX="visible">
              {isLoading ? (
                <Spinner
                  renderTitle={I18n.t('Updating...')}
                  size="x-small"
                  data-testid={`todo-checkbox-loading-${item.plannable_id}`}
                />
              ) : (
                <Button
                  elementRef={(el: Element | null) => {
                    buttonRef.current = el as HTMLButtonElement | null
                  }}
                  color={effectiveComplete ? 'success' : 'secondary'}
                  renderIcon={effectiveComplete ? <IconCheckLine /> : <IconCheckPlusLine />}
                  onClick={handleCheckboxClick}
                  data-testid={`todo-checkbox-${item.plannable_id}`}
                  interaction={readOnly ? 'disabled' : 'enabled'}
                  themeOverride={
                    isDark && !effectiveComplete
                      ? {
                          secondaryBackground: colors.inputBackground,
                          secondaryBorderColor: colors.border,
                          secondaryColor: colors.textPrimary,
                          secondaryHoverBackground: colors.cardBackground,
                          secondaryActiveBackground: colors.pageBackground,
                        }
                      : undefined
                  }
                >
                  <AccessibleContent
                    alt={
                      effectiveComplete
                        ? I18n.t('Mark %{title} as incomplete', {title: item.plannable.title})
                        : I18n.t('Mark %{title} as complete', {title: item.plannable.title})
                    }
                  >
                    {effectiveComplete ? I18n.t('Done') : I18n.t('Mark as done')}
                  </AccessibleContent>
                </Button>
              )}
            </Flex.Item>
          </Flex>
        </Flex.Item>
      </Flex>
    </View>
  )
}

export default TodoItem
