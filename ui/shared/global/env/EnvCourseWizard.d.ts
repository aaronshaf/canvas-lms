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

/**
 * From courses_controller.rb
 */
export interface EnvCourseWizard {
  COURSE_WIZARD: {
    checklist_states: {
      import_step: boolean
      assignment_step: boolean
      add_student_step: boolean
      navigation_step: boolean
      home_page_step: boolean
      calendar_event_step: boolean
      add_ta_step: boolean
      publish_step: boolean
    }
    urls: {
      content_import: string
      add_assignments: string
      add_students: string
      add_files: string
      select_navigation: string
      course_calendar: string
      add_tas: string
    }
    permissions: {
      can_change_course_publish_state: boolean
    }
    publish_course: string
  }
}
