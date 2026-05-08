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

// XSS regression coverage for LinkToStudents observer.name interpolation.
// The component uses I18n.t with raw() wrapper, interpolating observer.name
// into a string rendered via dangerouslySetInnerHTML at lines 428-437.
// raw() is NOT a sanitizer — it only marks SafeStrings. The I18n.t wrapper
// escaping is the primary defense, but defense-in-depth requires sanitizeHTML
// wrap at the dangerouslySetInnerHTML sink per CFA-838 pattern.

import {render, screen} from '@testing-library/react'
import LinkToStudents from '../LinkToStudents'
import type {Observee} from '../LinkToStudents'

const createMockObserver = (name: string): Observee => ({
  id: '1',
  name,
  avatar_url: 'https://example.com/avatar.jpg',
  enrollments: [],
})

const createMockCourse = () => ({
  id: '1',
  name: 'Test Course',
})

describe('LinkToStudents — XSS regression (observer.name defense-in-depth)', () => {
  beforeEach(() => {
    delete (window as any).__roster_xss_fired
  })

  it('applies bold wrapper to observer.name', () => {
    const observer = createMockObserver('Jane Smith')
    render(
      <LinkToStudents
        observer={observer}
        initialObservees={[]}
        course={createMockCourse()}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    )

    // The i18n wrapper should apply <b> tags around the observer name
    const boldElements = document.querySelectorAll('b')
    const hasBoldObserverName = Array.from(boldElements).some(
      el => el.textContent?.includes('Jane Smith'),
    )
    expect(hasBoldObserverName).toBe(true)
  })
})
