/*
 * Copyright (C) 2017 - present Instructure, Inc.
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

export interface Permissions {
  create?: boolean
  manage_course_content_edit?: boolean
  manage_course_content_delete?: boolean
  moderate?: boolean
}

export interface RssFeed {
  id: string
  display_name: string
  external_feed_entries_count: number
  url: string
}

export interface Author {
  id: string
  name: string
  avatar_image_url?: string
  html_url: string
}

export interface AnnouncementPermissions {
  update?: boolean
}

export interface Announcement {
  id: string
  position: number
  published: boolean
  title: string
  message: string
  posted_at?: string
  delayed_post_at?: string
  author: Author
  read_state?: 'read' | 'unread'
  discussion_subentry_count: number
  unread_count: number
  locked: boolean
  html_url: string
  permissions?: AnnouncementPermissions
}

export interface MasterCourse {
  id: string | number
}

export interface MasterCourseData {
  canManageCourse?: boolean
  canAutoPublishCourses?: boolean
  isChildCourse?: boolean
  isMasterCourse?: boolean
  accountId?: string | number
  masterCourse?: MasterCourse
}
