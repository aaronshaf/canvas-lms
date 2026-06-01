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

import {render} from '@testing-library/react'
import React from 'react'
import {CommentText} from '../Comments'

const renderComment = (comments_html: string) =>
  render(
    <CommentText assessment={{criterion_id: 'crit1', comments_html, points: {}}} weight="normal" />,
  )

describe('CommentText XSS mitigation', () => {
  it('strips dangerous attributes from HTML', () => {
    const {baseElement} = renderComment('<img src="x" onerror="window.__xss_fired=true">')
    expect(baseElement.innerHTML).not.toContain('onerror')
  })

  it('renders safe HTML as rich content', () => {
    const {baseElement} = renderComment('<strong>bold</strong> and <em>italics</em>')
    expect(baseElement.querySelector('strong')?.textContent).toBe('bold')
    expect(baseElement.querySelector('em')?.textContent).toBe('italics')
  })
})
