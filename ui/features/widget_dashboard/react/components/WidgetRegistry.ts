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

import {useScope as createI18nScope} from '@canvas/i18n'
import type {WidgetRegistry, WidgetRenderer} from '../types'
import {WIDGET_TYPES, EDUCATOR_WIDGET_ROLE} from '../constants'
import CourseGradesWidget from './widgets/CourseGradesWidget/CourseGradesWidget'
import TodoListWidget from './widgets/TodoListWidget/TodoListWidget'
import RecentGradesWidget from './widgets/RecentGradesWidget/RecentGradesWidget'
import {
  AnnouncementsWidget,
  CourseWorkCombinedWidget,
  InboxWidget,
  PeopleWidget,
  ProgressOverviewWidget,
  EducatorAnnouncementCreationWidget,
  EducatorTodoListWidget,
  EducatorContentQualityWidget,
} from '@instructure/platform-widget-dashboard'
import {renderAnnouncementMessageEditor} from './widgets/EducatorAnnouncementCreationWidget/AnnouncementMessageEditor'
import {renderPeopleMessageModal} from './widgets/PeopleWidget/renderMessageModal'

const I18n = createI18nScope('widget_dashboard')

const widgetRegistry: WidgetRegistry = {
  [WIDGET_TYPES.COURSE_WORK_COMBINED]: {
    component: CourseWorkCombinedWidget,
    get displayName() {
      return I18n.t('Course work')
    },
    get description() {
      return I18n.t('View course work statistics and assignments in one comprehensive view')
    },
  },
  [WIDGET_TYPES.COURSE_GRADES]: {
    component: CourseGradesWidget,
    get displayName() {
      return I18n.t('Course grades')
    },
    get description() {
      return I18n.t('Track your grades and academic progress across all courses')
    },
  },
  [WIDGET_TYPES.ANNOUNCEMENTS]: {
    component: AnnouncementsWidget,
    get displayName() {
      return I18n.t('Announcements')
    },
    get description() {
      return I18n.t('Stay updated with the latest announcements from your courses')
    },
  },
  [WIDGET_TYPES.PEOPLE]: {
    component: PeopleWidget,
    get displayName() {
      return I18n.t('People')
    },
    get description() {
      return I18n.t('View and contact your course instructors and teaching assistants')
    },
    props: {
      renderMessageModal: renderPeopleMessageModal,
    },
  },
  [WIDGET_TYPES.TODO_LIST]: {
    component: TodoListWidget,
    get displayName() {
      return I18n.t('To-do list')
    },
    get description() {
      return I18n.t('View and manage your planner items and upcoming tasks')
    },
  },
  [WIDGET_TYPES.RECENT_GRADES]: {
    component: RecentGradesWidget,
    get displayName() {
      return I18n.t('Recent grades & feedback')
    },
    get description() {
      return I18n.t('View your recently graded assignments and submissions')
    },
  },
  [WIDGET_TYPES.PROGRESS_OVERVIEW]: {
    component: ProgressOverviewWidget,
    get displayName() {
      return I18n.t('Progress overview')
    },
    get description() {
      return I18n.t('Track your progress across courses with module and assignment statistics')
    },
  },
  [WIDGET_TYPES.INBOX]: {
    component: InboxWidget,
    get displayName() {
      return I18n.t('Inbox')
    },
    get description() {
      return I18n.t('View recent messages from your Canvas conversations')
    },
  },
  [WIDGET_TYPES.EDUCATOR_ANNOUNCEMENT_CREATION]: {
    component: EducatorAnnouncementCreationWidget,
    get displayName() {
      return I18n.t('Announcement creation')
    },
    get description() {
      return I18n.t('Create and post announcements to your courses')
    },
    roles: [EDUCATOR_WIDGET_ROLE],
    props: {
      renderMessageEditor: renderAnnouncementMessageEditor,
    },
  },
  [WIDGET_TYPES.EDUCATOR_TODO_LIST]: {
    component: EducatorTodoListWidget,
    get displayName() {
      return I18n.t('Todo List')
    },
    get description() {
      return I18n.t('Review and grade student submissions organized by assignment')
    },
    roles: [EDUCATOR_WIDGET_ROLE],
  },
  [WIDGET_TYPES.EDUCATOR_CONTENT_QUALITY]: {
    component: EducatorContentQualityWidget,
    get displayName() {
      return I18n.t('Content Quality')
    },
    get description() {
      return I18n.t('Monitor and improve content quality and accessibility across your courses')
    },
    roles: [EDUCATOR_WIDGET_ROLE],
  },
}

export const registerWidget = (type: string, renderer: WidgetRenderer): void => {
  widgetRegistry[type] = renderer
}

export const getWidget = (type: string): WidgetRenderer | undefined => {
  return widgetRegistry[type]
}

// Returns all registered widgets regardless of role, including educator-only widgets.
// Prefer getWidgetsForRole() when rendering widgets for a specific user.
export const getAllWidgets = (): WidgetRegistry => {
  return {...widgetRegistry}
}

// Widgets without a roles field are treated as learner widgets
const isLearnerWidget = (renderer: WidgetRenderer) => !renderer.roles?.length
const matchesRole = (renderer: WidgetRenderer, role?: string) =>
  role ? renderer.roles?.includes(role) : isLearnerWidget(renderer)

export const getWidgetsForRole = (role?: string): WidgetRegistry =>
  Object.fromEntries(
    Object.entries(widgetRegistry).filter(([_key, renderer]) => matchesRole(renderer, role)),
  )

export const isRegisteredWidget = (type: string): boolean => {
  return type in widgetRegistry
}

export default widgetRegistry
