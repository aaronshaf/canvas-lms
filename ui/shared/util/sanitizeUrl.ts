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

/**
 * Replaces bad urls with harmless urls in cases where bad urls might cause harm.
 *
 * Uses an allowlist of schemes considered safe to navigate to from an `<a href>`,
 * `<iframe src>`, or similar attribute. Anything else (data:, vbscript:, file:,
 * unknown schemes, malformed input) is replaced with about:blank. Relative URLs
 * resolve through window.location.origin and pass as http(s).
 */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export default function sanitizeUrl(url: string): string {
  const defaultUrl = 'about:blank'
  try {
    const parsedUrl = new URL(url, window.location.origin)

    if (!SAFE_SCHEMES.has(parsedUrl.protocol)) {
      return defaultUrl
    }
    return url
  } catch (e) {
    // URL() throws TypeError if url is not a valid URL
    return defaultUrl
  }
}
