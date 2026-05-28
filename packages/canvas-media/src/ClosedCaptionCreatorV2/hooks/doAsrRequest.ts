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

import {getCsrfToken} from '../../shared/getCsrfToken'
import type {CaptionUploadConfig} from '../types'

export async function doAsrRequest(
  uploadConfig: CaptionUploadConfig | undefined,
  locale: string,
): Promise<void> {
  const {mediaObjectId, attachmentId} = uploadConfig ?? {}

  let url: string
  if (attachmentId) {
    url = `/api/v1/media_attachments/${attachmentId}/asr`
  } else if (mediaObjectId) {
    url = `/api/v1/media_objects/${mediaObjectId}/asr`
  } else {
    throw new Error('Either mediaObjectId or attachmentId must be provided')
  }

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken(),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({locale}),
  })

  if (!response.ok) {
    throw new Error(`Request failed with status code ${response.status}`)
  }
}
