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

/**
 * ENV variables for K5 Dashboard features
 */

type CreateCoursesPermissions = {
  PERMISSION: boolean
  RESTRICT_TO_MCC_ACCOUNT: boolean
}

type AccountCalendarContext = {
  asset_string: string
  name: string
  type: string
}

export interface EnvK5Dashboard {
  /**
   * Whether the student planner feature is enabled
   */
  STUDENT_PLANNER_ENABLED?: boolean

  /**
   * Whether to hide the grades tab for students in K5 dashboard
   */
  HIDE_K5_DASHBOARD_GRADES_TAB?: boolean

  /**
   * Permissions for creating courses
   */
  CREATE_COURSES_PERMISSIONS?: CreateCoursesPermissions

  /**
   * Selected context codes for calendar filtering
   */
  SELECTED_CONTEXT_CODES?: string[]

  /**
   * Limit for selected contexts
   */
  SELECTED_CONTEXTS_LIMIT?: number

  /**
   * Whether to open teacher todos in a new tab
   */
  OPEN_TEACHER_TODOS_IN_NEW_TAB?: boolean

  /**
   * Account-level calendar contexts
   */
  ACCOUNT_CALENDAR_CONTEXTS?: AccountCalendarContext[]

  /**
   * Initial number of K5 course cards to display
   */
  INITIAL_NUM_K5_CARDS?: number
}
