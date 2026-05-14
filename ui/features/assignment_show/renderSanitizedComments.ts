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

import {sanitizeHTML} from '@canvas/sanitize-html'
import {containsHtmlTags, formatMessage} from '@canvas/util/TextHelper'

// Renders the data-content of every `.comment_content` element into
// innerHTML, sanitizing first to neutralize any attacker-controlled HTML.
// Lifted out of the entry module so the XSS regression test can exercise
// this sink directly without booting the rest of the side-effect-heavy
// assignment_show entry (LockManager, axios, react roots, etc.).
//
// Both HTML and plain-text paths flow through sanitizeHTML so the result is
// always TrustedHTML — required for TT Phase 2 (no raw string reaches innerHTML).
// The DOMPurify-backed
// `@canvas/sanitize-html` wrapper replaced `sanitize-html-with-tinymce`
// (which used TinyMCE 5.10.9's regex-based SaxParser) as part of CFA-838.
export function renderSanitizedComments(): void {
  const comments = document.getElementsByClassName('comment_content')
  Array.from(comments).forEach(comment => {
    const content = (comment instanceof HTMLElement ? comment.dataset.content : '') || ''
    const formattedComment = sanitizeHTML(
      containsHtmlTags(content) ? content : formatMessage(content),
    )
    comment.innerHTML = formattedComment
  })
}
