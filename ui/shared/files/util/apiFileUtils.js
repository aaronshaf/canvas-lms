// Copyright (C) 2017 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.

import doFetchApi from '@canvas/do-fetch-api-effect'

export function getRootFolder(contextType, contextId) {
  return doFetchApi({
    path: `/api/v1/${contextType}/${contextId}/folders/root`,
  }).then(({json}) => ({data: json}))
}

function createFormData(data) {
  const formData = new FormData()
  Object.keys(data).forEach(key => formData.append(key, data[key]))
  return formData
}

function onFileUploadInfoReceived(file, uploadInfo, onSuccess, onFailure) {
  const formData = createFormData({...uploadInfo.upload_params, file})
  // External upload URL (e.g. S3) — skip CSRF headers to avoid CORS preflight rejection
  doFetchApi({
    path: uploadInfo.upload_url,
    method: 'POST',
    body: formData,
    includeCSRFToken: false,
  })
    .then(({json, text}) => onSuccess(json ?? text))
    .catch(e => onFailure(e))
}

export function uploadFile(file, folderId, onSuccess, onFailure) {
  doFetchApi({
    path: `/api/v1/folders/${folderId}/files`,
    method: 'POST',
    body: {
      name: file.name,
      size: file.size,
      parent_folder_id: folderId,
      on_duplicate: 'rename',
    },
  })
    .then(({json}) => onFileUploadInfoReceived(file, json, onSuccess, onFailure))
    .catch(e => onFailure(e))
}
