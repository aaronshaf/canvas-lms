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

/**
 * Returns a safe CSS url('…') string for use in backgroundImage style props,
 * or null if the URL is invalid or uses a non-http(s) scheme.
 *
 * React does not sanitize CSS values, so bare template interpolation like
 * `url(${userUrl})` allows breakout via ')' or quote characters. This function
 * validates the scheme and escapes the URL for a CSS single-quoted string.
 */
export default function safeCssUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const {protocol} = new URL(url)
    if (protocol !== 'http:' && protocol !== 'https:') return null
    // Escape backslash first, then single quote, for CSS string context.
    const escaped = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `url('${escaped}')`
  } catch {
    return null
  }
}
