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
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {Table} from '@instructure/ui-table'
import Criterion from '../Criterion'
import {rubrics, assessments} from './fixtures'

const openLongDescription = async (long_description: string) => {
  const user = userEvent.setup()
  const criterion = {...rubrics.freeForm.criteria[1], long_description}
  const {baseElement} = render(
    <Table caption="Test rubric">
      <Table.Body>
        <Criterion
          assessment={assessments.freeForm.data[1]}
          criterion={criterion}
          freeForm={true}
        />
      </Table.Body>
    </Table>,
  )
  await user.click(screen.getByText('view longer description'))
  return baseElement
}

describe('Criterion long description modal XSS mitigation', () => {
  it('strips dangerous attributes from HTML', async () => {
    const baseElement = await openLongDescription('<img src="x" onerror="window.__xss_fired=true">')
    expect(baseElement.innerHTML).not.toContain('onerror')
  })

  it('renders safe HTML as rich content', async () => {
    const baseElement = await openLongDescription('<p><strong>bold</strong></p>')
    expect(baseElement.querySelector('strong')?.textContent).toBe('bold')
  })
})
