/*
 * Copyright (C) 2025 - present Instructure, Inc.
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
import AssignmentDescription from '../AssignmentDescription'
import apiUserContent from '@canvas/util/jquery/apiUserContent'

vi.mock('@canvas/util/jquery/apiUserContent', () => ({
  default: {
    convert: vi.fn((content: string) => content),
  },
}))

describe('AssignmentDescription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with description prop', () => {
    const description = '<p>This is an assignment description</p>'
    const {getByTestId} = render(<AssignmentDescription description={description} />)

    const descriptionElement = getByTestId('assignments-2-assignment-description')
    expect(descriptionElement).toBeInTheDocument()
    expect(descriptionElement).toHaveClass('user_content')
  })

  it('renders fallback text when no description is provided', () => {
    const {getByTestId} = render(<AssignmentDescription />)

    const descriptionElement = getByTestId('assignments-2-assignment-description')
    expect(descriptionElement).toBeInTheDocument()
    expect(descriptionElement.innerHTML).toBe(
      'No additional details were added for this assignment.',
    )
  })

  it('renders fallback text when description is empty string', () => {
    const {getByTestId} = render(<AssignmentDescription description="" />)

    const descriptionElement = getByTestId('assignments-2-assignment-description')
    expect(descriptionElement).toBeInTheDocument()
    expect(descriptionElement.innerHTML).toBe(
      'No additional details were added for this assignment.',
    )
  })

  it('calls apiUserContent.convert when description is provided', () => {
    const description = '<p>Test description</p>'

    render(<AssignmentDescription description={description} />)

    expect(apiUserContent.convert).toHaveBeenCalledWith(description)
  })

  it('does not call apiUserContent.convert when no description is provided', () => {
    render(<AssignmentDescription />)

    expect(apiUserContent.convert).not.toHaveBeenCalled()
  })

  describe('XSS regression', () => {
    // AssignmentDescription is shared across many assignment views.
    // It pipes teacher-authored description HTML through
    // dangerouslySetInnerHTML. Backend CanvasSanitize allowlists the
    // title attribute, so attribute-value mXSS payloads can survive
    // backend sanitization. CFA-897 wraps the sink with
    // @canvas/sanitize-html as defense-in-depth.

    afterEach(() => {
      delete (window as any).__xss_fired
    })

    it('strips inline event handlers from description', () => {
      const {getByTestId} = render(
        <AssignmentDescription description='<p>before <img src=x onerror="window.__xss_fired = true"> after</p>' />,
      )
      const el = getByTestId('assignments-2-assignment-description')
      expect(el.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('strips <script> tags from description', () => {
      const {getByTestId} = render(
        <AssignmentDescription description="<p>before</p><script>window.__xss_fired = true</script><p>after</p>" />,
      )
      const el = getByTestId('assignments-2-assignment-description')
      expect(el.querySelector('script')).toBeNull()
      expect(el.innerHTML).not.toMatch(/<script/i)
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('strips javascript: hrefs from description', () => {
      const {getByTestId} = render(
        <AssignmentDescription description='<p><a href="javascript:window.__xss_fired = true">click</a></p>' />,
      )
      const el = getByTestId('assignments-2-assignment-description')
      const anchor = el.querySelector('a')
      if (anchor) {
        expect(anchor.getAttribute('href') || '').not.toMatch(/^javascript:/i)
      }
      expect(el.innerHTML).not.toMatch(/javascript:/i)
      expect((window as any).__xss_fired).toBeUndefined()
    })
  })
})
