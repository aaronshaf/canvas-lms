/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

export interface EnvDiscussions {
  AMOUNT_OF_SIDE_COMMENT_DISCUSSIONS?: string
  discussion_ai_survey_link: string
  DISCUSSION_TOPIC: {
    ATTRIBUTES: Record<string, any>
  }
  discussion_pin_post: string
  ASSIGNMENT_SECURE_PARAMS?: string
  DISCUSSION_CHECKPOINTS_ENABLED?: boolean
  /**
   * Set in DiscussionTopicsController for discussion topic insights
   * Used by ui/features/discussion_topics_post/react/components/DiscussionSummary/DiscussionSummary.tsx
   */
  context_type?: string
  context_id?: string | number
  discussion_topic_id?: string | number
  DISCUSSION?: {
    MANUAL_MARK_AS_READ?: boolean
    PERMISSIONS?: {
      CAN_ATTACH_TOPIC?: boolean
      CAN_READ_REPLIES?: boolean
      CAN_REPLY?: boolean
      CAN_SUBSCRIBE?: boolean
    }
    TOPIC?: {
      ID?: string | number
      IS_SUBSCRIBED?: boolean
      CAN_UNPUBLISH?: boolean
      IS_PUBLISHED?: boolean
      IS_ANNOUNCEMENT?: boolean
      TITLE?: string
      COURSE_SECTIONS?: any[]
    }
    ROOT_URL?: string
    THREADED?: boolean
    ENTRY_ROOT_URL?: string
    ROOT_REPLY_URL?: string
    REPLY_URL?: string
    DELETE_URL?: string
    MARK_READ_URL?: string
    MARK_UNREAD_URL?: string
    RATE_URL?: string
    CURRENT_USER?: any
    STUDENT_ID?: string
    SPEEDGRADER_URL_TEMPLATE?: string
    HIDE_STUDENT_NAMES?: boolean
    CAN_SUBSCRIBE?: boolean
    IS_ASSIGNMENT?: boolean
    ASSIGNMENT_ID?: string | number
    IS_GROUP?: boolean
    APP_URL?: string
    SEQUENCE?: {
      ASSET_TYPE?: string
      ASSET_ID?: string | number
      COURSE_ID?: string | number
    }
    INITIAL_POST_REQUIRED?: boolean
  }
  TOTAL_USER_COUNT?: number
}
