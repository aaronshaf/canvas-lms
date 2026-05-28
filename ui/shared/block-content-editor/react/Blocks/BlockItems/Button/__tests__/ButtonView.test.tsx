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
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {ButtonView} from '../ButtonView'
import {ButtonData} from '../types'

const defaultButtonData: ButtonData = {
  id: 1,
  text: 'Test Button',
  url: 'https://example.com',
  linkOpenMode: 'new-tab',
  primaryColor: '#000000',
  secondaryColor: '#FFFFFF',
  style: 'filled',
}

const defaultProps = {
  ...defaultButtonData,
  isFullWidth: false,
}

describe('ButtonView', () => {
  it('shows tooltip for new-tab links with URL', async () => {
    const user = userEvent.setup()
    render(<ButtonView {...defaultProps} />)

    const button = screen.getByRole('link')
    await user.hover(button)
    expect(screen.getByText('Opens in new window')).toBeInTheDocument()
  })

  it('does not show tooltip when URL is empty', () => {
    const propsWithoutUrl = {...defaultProps, url: ''}
    render(<ButtonView {...propsWithoutUrl} />)
    expect(screen.queryByText('Opens in new window')).not.toBeInTheDocument()
  })

  it('does not show tooltip for same-tab links', () => {
    const sameTabProps = {...defaultProps, linkOpenMode: 'same-tab' as const}
    render(<ButtonView {...sameTabProps} />)
    expect(screen.queryByText('Opens in new window')).not.toBeInTheDocument()
  })

  it('renders with proper href and target attributes', () => {
    render(<ButtonView {...defaultProps} />)
    const button = screen.getByRole('link')
    expect(button).toHaveAttribute('href', 'https://example.com')
    expect(button).toHaveAttribute('target', '_blank')
    expect(button).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('neutralizes javascript: hrefs to prevent stored XSS', () => {
    const xssProps = {...defaultProps, url: 'javascript:alert(document.cookie)'}
    const {container} = render(<ButtonView {...xssProps} />)
    // The unsafe scheme must never reach the DOM as a navigable href.
    const hrefs = Array.from(container.querySelectorAll('[href]')).map(
      el => el.getAttribute('href') ?? '',
    )
    expect(hrefs.some(h => /^\s*(javascript|data):/i.test(h))).toBe(false)
  })

  it('neutralizes data: hrefs to prevent stored XSS', () => {
    const xssProps = {
      ...defaultProps,
      linkOpenMode: 'same-tab' as const,
      url: 'data:text/html,<script>alert(1)</script>',
    }
    const {container} = render(<ButtonView {...xssProps} />)
    const hrefs = Array.from(container.querySelectorAll('[href]')).map(
      el => el.getAttribute('href') ?? '',
    )
    expect(hrefs.some(h => /^\s*(javascript|data):/i.test(h))).toBe(false)
  })
})
