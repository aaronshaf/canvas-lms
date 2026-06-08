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

import React from 'react'

interface HighlightedTextProps {
  // Optional because some callers (e.g. discussion getDisplayName) can yield
  // undefined when an entry has no author/displayName/shortName.
  text?: string
  searchTerm?: string
}

const HIGHLIGHT_STYLE: React.CSSProperties = {
  fontWeight: 'bold',
  backgroundColor: 'rgba(0,142,226,0.2)',
  borderRadius: '.25rem',
  paddingBottom: '3px',
  paddingTop: '1px',
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Splits `text` on case-insensitive matches of `searchTerm` and wraps each
// match in a styled <span>. No HTML parsing, no innerHTML, no sanitization
// surface — the text never leaves React's escaped-string handling.
export function HighlightedText({text, searchTerm}: HighlightedTextProps) {
  if (!searchTerm || !text) {
    return <>{text}</>
  }

  const pattern = new RegExp(escapeRegExp(searchTerm), 'gi')
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null = pattern.exec(text)

  while (match) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <span key={key++} data-testid="highlighted-search-item" style={HIGHLIGHT_STYLE}>
        {match[0]}
      </span>,
    )
    lastIndex = match.index + match[0].length
    // Guard against zero-width matches.
    if (match[0].length === 0) pattern.lastIndex++
    match = pattern.exec(text)
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <>{parts}</>
}
