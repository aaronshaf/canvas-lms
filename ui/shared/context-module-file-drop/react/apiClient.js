/*
 * Copyright (C) 2020 - present Instructure, Inc.
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

import doFetchApi from '@canvas/do-fetch-api-effect'
import FilesystemObject from '@canvas/files/backbone/models/FilesystemObject'

function combine(left, right) {
  return Promise.all([left, right]).then(([files1, files2]) => files1.concat(files2))
}

function parse(items) {
  return Promise.resolve(items.map(f => new FilesystemObject(f)))
}

function fetchFiles(url) {
  return doFetchApi({path: url}).then(({json, link}) => {
    const next = link?.next?.url
    if (next) {
      return combine(parse(json), fetchFiles(next))
    } else {
      return parse(json)
    }
  })
}

export function getFolderFiles(folderId) {
  return fetchFiles(`/api/v1/folders/${folderId}/files?only[]=names`)
}

export function getCourseRootFolder(courseId) {
  return doFetchApi({path: `/api/v1/courses/${courseId}/folders/root`}).then(({json}) => json)
}
