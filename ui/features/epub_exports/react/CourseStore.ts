/*
 * Copyright (C) 2015 - present Instructure, Inc.
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

import {each} from 'es-toolkit/compat'
import createStore from '@canvas/backbone/createStore'
import $ from 'jquery'

export interface EpubExportAttachment {
  url: string
  [key: string]: unknown
}

export interface EpubExportPermissions {
  download?: boolean
  regenerate?: boolean
  [key: string]: unknown
}

export interface EpubExport {
  id: number
  progress_id?: string
  workflow_state: string
  updated_at?: string
  epub_attachment?: EpubExportAttachment
  zip_attachment?: EpubExportAttachment
  permissions?: EpubExportPermissions
  [key: string]: unknown
}

export interface Course {
  id: number
  name: string
  epub_export?: EpubExport
  [key: string]: unknown
}

interface CoursesMap {
  [courseId: string]: Course
}

interface ApiResponse {
  courses: Course[]
}

const CourseEpubExportStore = createStore<CoursesMap>({})
const _courses: CoursesMap = {}

CourseEpubExportStore.getAll = function (): void {
  $.getJSON('/api/v1/epub_exports', (data: ApiResponse) => {
    each(data.courses, (course: Course) => {
      _courses[course.id] = course
    })
    CourseEpubExportStore.setState(_courses)
  })
}

CourseEpubExportStore.get = function (course_id: number, id: number): void {
  const url = '/api/v1/courses/' + course_id + '/epub_exports/' + id
  $.getJSON(url, (data: Course) => {
    _courses[data.id] = data
    CourseEpubExportStore.setState(_courses)
  })
}

CourseEpubExportStore.create = function (id: number): void {
  const url = '/api/v1/courses/' + id + '/epub_exports'
  $.post(
    url,
    {},
    (data: Course) => {
      _courses[data.id] = data
      CourseEpubExportStore.setState(_courses)
    },
    'json',
  )
}

export default CourseEpubExportStore
