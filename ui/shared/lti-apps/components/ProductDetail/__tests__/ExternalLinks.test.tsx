/*
 * Copyright (C) 2024 - present Instructure, Inc.
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
import ExternalLinks from '../ExternalLinks'
import {product} from '../../common/__tests__/data'

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe('ExternalLinks', () => {
  it('renders as expected', () => {
    const {getByText} = render(<ExternalLinks product={product[0]} />)
    expect(getByText('Partner Privacy Policy')).toBeInTheDocument()
    expect(getByText('Accessibility Documentation')).toBeInTheDocument()
  })

  it('sanitizes non-allowlist URL schemes to about:blank', () => {
    const maliciousProduct = {
      ...product[0],
      privacy_policy_url: 'javascript:alert(1)',
      terms_of_service_url: 'data:text/html,<script>alert(1)</script>',
      accessibility_url: 'javascript:void(0)',
    }
    const {getAllByRole} = render(<ExternalLinks product={maliciousProduct} />)
    const links = getAllByRole('link')
    links.forEach(link => {
      expect(link).not.toHaveAttribute('href', expect.stringMatching(/^javascript:/i))
      expect(link).not.toHaveAttribute('href', expect.stringMatching(/^data:/i))
    })
  })
})
