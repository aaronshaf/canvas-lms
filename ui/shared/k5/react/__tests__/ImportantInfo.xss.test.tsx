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
import ImportantInfo from '../ImportantInfo'

const baseInfo = {
  courseId: '1',
  courseName: 'Test Course',
  canEdit: false,
  content: '',
}

describe('ImportantInfo — XSS regression', () => {
  it('strips event handlers from course important info content', () => {
    const {container} = render(
      <ImportantInfo
        infoDetails={{...baseInfo, content: '<img src=x onerror="window.__xss=1">'}}
      />,
    )
    container.querySelectorAll('*').forEach(el => {
      el.getAttributeNames().forEach(attr => {
        expect(attr).not.toMatch(/^on[a-z]+$/i)
      })
    })
    expect((window as any).__xss).toBeUndefined()
  })

  it('preserves benign content', () => {
    const {container} = render(
      <ImportantInfo infoDetails={{...baseInfo, content: '<p>Hello <strong>world</strong></p>'}} />,
    )
    expect(container.querySelector('strong')?.textContent).toBe('world')
  })
})
