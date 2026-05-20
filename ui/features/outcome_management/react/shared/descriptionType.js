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

import {stripHtmlTags} from '@canvas/util/TextHelper'

// Helper function (by Martin Yosifov) to detect what
// type the description is (html, html-text, text)
const descriptionType = description => {
  if (!description) return 'null'
  const pTags = (description.match(/<p[\s>]/gi) || []).length
  const divTags = (description.match(/<div[\s>]/gi) || []).length
  const textContent = stripHtmlTags(description) || ''
  const diff = description.length - textContent.length
  if (diff === 0) return 'text'
  if ((pTags === 1 && diff === 7) || (divTags === 1 && diff === 11)) return 'html_text'
  return 'html'
}

export default descriptionType
