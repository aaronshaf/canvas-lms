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
import {render} from '@testing-library/react'
import {HighlightedText} from '../HighlightedText'

describe('HighlightedText', () => {
  it('renders plain text when no searchTerm is provided', () => {
    const {container, queryAllByTestId} = render(<HighlightedText text="Harry Potter" />)
    expect(container.textContent).toBe('Harry Potter')
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(0)
  })

  it('wraps case-insensitive matches in a highlighted span', () => {
    const {queryAllByTestId} = render(<HighlightedText text="Harry Potter" searchTerm="harry" />)
    const hits = queryAllByTestId('highlighted-search-item')
    expect(hits).toHaveLength(1)
    expect(hits[0].textContent).toBe('Harry')
  })

  it('highlights every occurrence of the term', () => {
    const {queryAllByTestId} = render(<HighlightedText text="ana banana" searchTerm="ana" />)
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(2)
  })

  it('renders the surrounding text alongside the highlights', () => {
    const {container} = render(<HighlightedText text="Harry Potter" searchTerm="Potter" />)
    expect(container.textContent).toBe('Harry Potter')
  })

  it('does not use dangerouslySetInnerHTML — HTML in the input renders as text', () => {
    const evil = '<img src=x onerror="alert(1)">'
    const {container} = render(<HighlightedText text={evil} searchTerm="img" />)
    // No <img> element is created; the angle brackets are part of the text.
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe(evil)
  })

  it('escapes regex metacharacters in searchTerm', () => {
    // The literal string "." should match only a literal "." — not every char.
    const {queryAllByTestId} = render(<HighlightedText text="abc.def" searchTerm="." />)
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(1)
  })

  it('renders empty output for an empty text', () => {
    const {container} = render(<HighlightedText text="" searchTerm="anything" />)
    expect(container.textContent).toBe('')
  })
})
