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

import {sanitizeUrl as _sanitizeUrl} from '@instructure/platform-sanitize'

// Wrap to coerce non-string values: some callers pass DOM attr results
// (jQuery .attr() returns undefined for missing attrs) or typed-as-string
// API fields that arrive at runtime as other types.
export default function sanitizeUrl(url: string): string {
  return _sanitizeUrl(typeof url === 'string' ? url : String(url ?? ''))
}
