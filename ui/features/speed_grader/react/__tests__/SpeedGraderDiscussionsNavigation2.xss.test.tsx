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
import {render, waitFor} from '@testing-library/react'
import {SpeedGraderDiscussionsNavigation2} from '../SpeedGraderDiscussionsNavigation2'

const dispatchTabMessage = (origin: string, subject: string) => {
  window.dispatchEvent(new MessageEvent('message', {data: {subject}, origin}))
}

describe('SpeedGraderDiscussionsNavigation2 — XSS regression at postMessage origin', () => {
  beforeEach(() => {
    ;(window as any).jsonData = {
      student_entries: {
        s1: [100, 200, 300, 400],
      },
    }
  })

  afterEach(() => {
    delete (window as any).jsonData
  })

  const expectReplyIndex = (container: HTMLElement, idx: number) => {
    expect(container.textContent ?? '').toMatch(new RegExp(`Reply\\s+${idx}\\s+of\\s+4`))
  }

  it('ignores DT.nextStudentReplyTab from a foreign origin', async () => {
    const {container} = render(<SpeedGraderDiscussionsNavigation2 studentId="s1" />)
    expectReplyIndex(container, 1)

    dispatchTabMessage('https://evil.example', 'DT.nextStudentReplyTab')
    await new Promise(r => setTimeout(r, 10))

    // Position must not have advanced.
    expectReplyIndex(container, 1)
  })

  it('ignores DT.previousStudentReplyTab from a typosquat origin', async () => {
    const {container} = render(<SpeedGraderDiscussionsNavigation2 studentId="s1" />)
    expectReplyIndex(container, 1)

    dispatchTabMessage(window.location.origin, 'DT.nextStudentReplyTab')
    await waitFor(() => expectReplyIndex(container, 2))

    dispatchTabMessage('https://canvas.instructurer.com', 'DT.previousStudentReplyTab')
    await new Promise(r => setTimeout(r, 10))

    // Position must not have changed back.
    expectReplyIndex(container, 2)
  })

  it('ignores DT.nextStudentReplyTab from origin "" (sandbox iframe)', async () => {
    const {container} = render(<SpeedGraderDiscussionsNavigation2 studentId="s1" />)
    expectReplyIndex(container, 1)

    dispatchTabMessage('', 'DT.nextStudentReplyTab')
    await new Promise(r => setTimeout(r, 10))

    expectReplyIndex(container, 1)
  })

  it('still accepts DT.nextStudentReplyTab from the same Canvas origin', async () => {
    const {container} = render(<SpeedGraderDiscussionsNavigation2 studentId="s1" />)
    expectReplyIndex(container, 1)

    dispatchTabMessage(window.location.origin, 'DT.nextStudentReplyTab')
    await waitFor(() => expectReplyIndex(container, 2))
  })
})
