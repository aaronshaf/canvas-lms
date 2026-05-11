/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import {sanitizeHTML} from '@canvas/sanitize-html'

export default function sanitizeData(data, dataItems = ['message']) {
  const sanitizedData = {...data}

  dataItems.forEach(item => {
    if (!sanitizedData[item]) return

    // Coerce to plain string so JSON.stringify serializes correctly.
    // sanitizeHTML() returns TrustedHTML (not a plain string) in browsers
    // that support the Trusted Types API. JSON.stringify cannot serialize
    // TrustedHTML and would produce {} for the field, causing silent data
    // loss when Backbone sends the object to the server.
    sanitizedData[item] = String(sanitizeHTML(sanitizedData[item]))
  })

  return sanitizedData
}
