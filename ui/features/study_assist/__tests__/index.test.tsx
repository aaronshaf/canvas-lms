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
import {act, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {StudyAssistTrigger} from '../index'

describe('StudyAssistTrigger', () => {
  const getTriggerButton = () => screen.getByTestId('study-assist-trigger')

  it('labels the button "IgniteAI Study Tools" for screen readers', () => {
    render(<StudyAssistTrigger />)
    expect(getTriggerButton()).toHaveAccessibleName('IgniteAI Study Tools')
  })

  it('shows an "IgniteAI Study Tools" tooltip on hover', async () => {
    const user = userEvent.setup()
    render(<StudyAssistTrigger />)

    await user.hover(getTriggerButton())

    expect(await screen.findByRole('tooltip')).toHaveTextContent('IgniteAI Study Tools')
  })

  it('dispatches the study-assist:open event when clicked', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    window.addEventListener('study-assist:open', handler)

    render(<StudyAssistTrigger />)
    await user.click(getTriggerButton())

    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener('study-assist:open', handler)
  })

  it('marks the button as a collapsed dialog trigger by default', () => {
    render(<StudyAssistTrigger />)

    const button = getTriggerButton()
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).not.toHaveAttribute('aria-controls')
  })

  it('reflects the open tray when the study-assist panel becomes active', () => {
    render(<StudyAssistTrigger />)

    act(() => {
      window.dispatchEvent(
        new CustomEvent('student-study-drawer:state', {detail: {activePanel: 'study-assist'}}),
      )
    })

    const button = getTriggerButton()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', 'student-study-drawer-tray')
  })

  it('stays collapsed when a different panel (notebook) is active', () => {
    render(<StudyAssistTrigger />)

    act(() => {
      window.dispatchEvent(
        new CustomEvent('student-study-drawer:state', {detail: {activePanel: 'notebook'}}),
      )
    })

    const button = getTriggerButton()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).not.toHaveAttribute('aria-controls')
  })

  it('collapses again when the tray closes', () => {
    render(<StudyAssistTrigger />)

    act(() => {
      window.dispatchEvent(
        new CustomEvent('student-study-drawer:state', {detail: {activePanel: 'study-assist'}}),
      )
    })
    act(() => {
      window.dispatchEvent(
        new CustomEvent('student-study-drawer:state', {detail: {activePanel: null}}),
      )
    })

    expect(getTriggerButton()).toHaveAttribute('aria-expanded', 'false')
  })
})
