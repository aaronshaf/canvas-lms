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

import * as DateFunctions from '@canvas/datetime/date-functions'
import SpeedGrader from '../speed_grader'

describe('SpeedGrader EG.handleSGMessages', () => {
  let label: HTMLElement

  beforeEach(() => {
    label = document.createElement('span')
    label.id = 'submitted_at_label'
    document.body.appendChild(label)
  })

  afterEach(() => {
    label.remove()
    vi.restoreAllMocks()
  })

  describe('SG.handleHighlightedEntryChange', () => {
    it('does not parse HTML returned by datetimeString into the DOM', () => {
      vi.spyOn(DateFunctions, 'datetimeString').mockReturnValue('<img src=x onerror=alert(1)>')
      SpeedGrader.EG.handleSGMessages(
        new MessageEvent('message', {
          data: {
            subject: 'SG.handleHighlightedEntryChange',
            entryTimestamp: '2026-01-01T00:00:00Z',
          },
        }),
      )
      expect(label.querySelector('img')).toBeNull()
      expect(label.textContent).toBe('<img src=x onerror=alert(1)>')
    })
  })
})
