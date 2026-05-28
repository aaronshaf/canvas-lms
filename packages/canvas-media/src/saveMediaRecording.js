/*
 * Copyright (C) 2019 - present Instructure, Inc.
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

import {K5Uploader} from '@instructure/k5uploader'
import FileSizeError from './shared/FileSizeError'
import {getCsrfToken} from './shared/getCsrfToken'
import {isSameOrigin} from './shared/isSameOrigin'

function xhrPostWithProgress(url, body, headers, onUploadProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)
    xhr.setRequestHeader('Content-Type', 'application/json')
    if (isSameOrigin(url)) {
      xhr.setRequestHeader('X-CSRF-Token', getCsrfToken())
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
    }
    if (headers) {
      Object.entries(headers).forEach(([key, val]) => xhr.setRequestHeader(key, val))
    }
    if (onUploadProgress) {
      xhr.upload.addEventListener('progress', e =>
        onUploadProgress({loaded: e.loaded, total: e.total}),
      )
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null)
        } catch (e) {
          reject(e)
        }
      } else {
        const error = new Error(`Request failed with status code ${xhr.status}`)
        error.response = {status: xhr.status}
        reject(error)
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(JSON.stringify(body))
  })
}

async function fetchJson(url, options) {
  const sameOriginHeaders = isSameOrigin(url)
    ? {'X-CSRF-Token': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest'}
    : {}
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...sameOriginHeaders,
      ...options?.headers,
    },
  })
  if (!response.ok) {
    const error = new Error(`Request failed with status code ${response.status}`)
    error.response = {status: response.status}
    throw error
  }
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  return {data}
}

export const VIDEO_SIZE_OPTIONS = {height: '432px', width: '768px'}
const STARTING_PROGRESS_VALUE = 33

function mediaObjectsUrl(rcsConfig) {
  return rcsConfig.origin ? `${rcsConfig.origin}/api/media_objects` : '/api/v1/media_objects'
}

function mediaAttachmentsUrl(rcsConfig) {
  return rcsConfig.origin
    ? `${rcsConfig.origin}/api/media_attachments`
    : '/api/v1/media_attachments'
}

function generateUploadOptions(mediatypes, sessionData) {
  const sessionDataCopy = JSON.parse(JSON.stringify(sessionData))
  delete sessionDataCopy.kaltura_setting
  return {
    kaltura_session: sessionDataCopy,
    allowedMediaTypes: mediatypes,
    uploadUrl: sessionData.kaltura_setting.uploadUrl,
    entryUrl: sessionData.kaltura_setting.entryUrl,
    uiconfUrl: sessionData.kaltura_setting.uiconfUrl,
    entryDefaults: {
      partnerData: sessionData.kaltura_setting.partner_data,
    },
  }
}

function addUploaderReadyEventListeners(uploader, file) {
  uploader.addEventListener('K5.ready', () => {
    uploader.uploadFile(file)
  })
}

function addUploaderProgressEventListeners(uploader, onProgress) {
  uploader.addEventListener('K5.progress', progress => {
    const percentUploaded = Math.round(progress.loaded / progress.total) * STARTING_PROGRESS_VALUE
    onProgress(STARTING_PROGRESS_VALUE + percentUploaded)
  })
}

function addUploaderFileErrorEventListeners(uploader, done, file) {
  uploader.addEventListener('K5.fileError', error => {
    uploader.destroy()
    doDone(done, error, {uploadedFile: file})
  })
}

// See the method of the same name in kaltura_client_v3.rb
function mediaTypeToSymbol(type) {
  switch (type) {
    case '2':
      return 'image'
    case '5':
      return 'audio'
    default: // 1
      return 'video'
  }
}

function addUploaderFileCompleteEventListeners(uploader, rcsConfig, file, done, onProgress) {
  uploader.addEventListener('K5.complete', async mediaServerMediaObject => {
    const type = mediaTypeToSymbol(mediaServerMediaObject.mediaType || mediaServerMediaObject.type)
    const body = {
      id: mediaServerMediaObject.entryId,
      type,
      context_code: `${rcsConfig.contextType}_${rcsConfig.contextId}`,
      title: file.name,
      user_entered_title: file.userEnteredTitle || file.name,
    }

    try {
      const onUploadProgress = onProgress
        ? progressEvent => {
            const startingValue = 2 * STARTING_PROGRESS_VALUE
            const percentUploaded =
              progressEvent.total > 0
                ? Math.round(
                    (progressEvent.loaded / progressEvent.total) * (STARTING_PROGRESS_VALUE + 1),
                  )
                : 0
            onProgress(startingValue + percentUploaded)
          }
        : null

      const mediaObjectJson = await xhrPostWithProgress(
        mediaObjectsUrl(rcsConfig),
        body,
        rcsConfig.headers,
        onUploadProgress,
      )
      uploader.destroy()
      doDone(done, null, {mediaObject: mediaObjectJson, uploadedFile: file})
    } catch (ex) {
      uploader.destroy()
      doDone(done, ex, {uploadedFile: file})
    }
  })
}

export default async function saveMediaRecording(file, rcsConfig, done, onProgress) {
  try {
    window.addEventListener('beforeunload', handleUnloadWhileUploading)

    // this works w/o rcsConfig.origin and headers because the api path
    // is the same for the RCS as Canvas. Doing it this way means
    // saveMediaRecording can be called w/o having to import anything
    // from @instructure/canvas-rce
    const mediaServerSession = await fetchJson(
      `${rcsConfig.origin || ''}/api/v1/services/kaltura_session?include_upload_config=1`,
      {method: 'POST', headers: rcsConfig.headers},
    )
    if (onProgress) {
      onProgress(STARTING_PROGRESS_VALUE)
    }
    const session = generateUploadOptions(
      ['video', 'audio', 'webm', 'video/webm', 'audio/webm'],
      mediaServerSession.data,
    )
    const k5UploaderSession = new K5Uploader(session)
    addUploaderReadyEventListeners(k5UploaderSession, file)
    if (onProgress) {
      addUploaderProgressEventListeners(k5UploaderSession, onProgress)
    }
    addUploaderFileErrorEventListeners(k5UploaderSession, done, file)
    addUploaderFileCompleteEventListeners(k5UploaderSession, rcsConfig, file, done, onProgress)
    return k5UploaderSession
  } catch (err) {
    doDone(done, err, {uploadedFile: file})
  }
}

/*
 * @media_object_id: id of the media_object we're assigning CC to
 * @subtitles: [{locale: string locale, file: JS File object}]
 * @rcsConfig: {origin, headers, method} where method=PUT for update or POST for create
 * @maxBytes: The max bytes allowed for the caption file
 */
export async function saveClosedCaptions(media_object_id, subtitles, rcsConfig, maxBytes) {
  const url = `${mediaObjectsUrl(rcsConfig)}/${media_object_id}/media_tracks`
  return executeSubtitlesRequests({subtitles, url, rcsConfig, maxBytes})
}

/*
 * @attachmentId: id of the media attachment we're assigning CC to
 * @subtitles: [{locale: string locale, file: JS File object}]
 * @rcsConfig: {origin, headers, method} where method=PUT for update or POST for create
 * @maxBytes: The max bytes allowed for the caption file
 */
export async function saveClosedCaptionsForAttachment(
  attachmentId,
  subtitles,
  rcsConfig,
  maxBytes,
) {
  // read all the subtitle files' contents
  const url = `${mediaAttachmentsUrl(rcsConfig)}/${attachmentId}/media_tracks`
  return executeSubtitlesRequests({subtitles, url, rcsConfig, maxBytes})
}

function doDone(done, ...rest) {
  window.removeEventListener('beforeunload', handleUnloadWhileUploading)
  done(...rest)
}

function handleUnloadWhileUploading(e) {
  e.preventDefault()
  e.returnValue = ''
}

function subtitleToPromise(subtitle, maxBytes) {
  if (subtitle.isNew) {
    return new Promise((resolve, reject) => {
      if (maxBytes && subtitle.file.size > maxBytes) {
        reject(new FileSizeError({maxBytes, actualBytes: subtitle.file.size}))
      }

      const reader = new FileReader()
      reader.onload = function (e) {
        resolve({locale: subtitle.locale, content: e.target.result})
      }
      reader.onerror = function (e) {
        e.target.abort()
        reject(e.target.error || e)
      }
      reader.readAsText(subtitle.file)
    })
  } else {
    return Promise.resolve({locale: subtitle.locale})
  }
}

function executeSubtitlesRequests({url, subtitles, rcsConfig, maxBytes}) {
  // once all the promises from reading the subtitles' files
  // have resolved, PUT/POST the resulting subtitle objects to the RCS
  // when that completes, the update_promise will resolve
  const subtitlesPromises = subtitles.map(st => subtitleToPromise(st, maxBytes))
  return new Promise((resolve, reject) => {
    Promise.all(subtitlesPromises)
      .then(closed_captions =>
        fetchJson(url, {
          method: rcsConfig.method || 'PUT',
          headers: {'Content-Type': 'application/json', ...rcsConfig.headers},
          body: JSON.stringify(closed_captions),
        })
          .then(resolve)
          .catch(reject),
      )
      .catch(e => reject(e))
  })
}
