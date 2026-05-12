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

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * Replaces bad urls with harmless urls in cases where bad urls might cause harm.
 *
 * Uses an allowlist of schemes safe for <a href>, <iframe src>, and similar
 * attributes. Relative URLs pass through. Everything else (data:, vbscript:,
 * blob:, javascript:, malformed input) is replaced with about:blank.
 *
 * Mirrors ui/shared/util/sanitizeUrl.ts — when CFA-959 ships a published
 * @instructure/platform-sanitize package, replace this with that import.
 */
export function sanitizeUrl(url: string): string {
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
