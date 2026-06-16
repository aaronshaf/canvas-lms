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
import {NotebookTrigger} from '../index'

describe('NotebookTrigger', () => {
  const getTriggerButton = () => screen.getByTestId('notebook-button')

  it('marks the button as a collapsed dialog trigger by default', () => {
    render(<NotebookTrigger isMobile={false} />)

    const button = getTriggerButton()
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).not.toHaveAttribute('aria-controls')
  })

  it('reflects the open tray when the notebook panel becomes active', () => {
    render(<NotebookTrigger isMobile={false} />)

    act(() => {
      window.dispatchEvent(
        new CustomEvent('student-study-drawer:state', {detail: {activePanel: 'notebook'}}),
      )
    })

    const button = getTriggerButton()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', 'student-study-drawer-tray')
  })

  it('stays collapsed when a different panel (study-assist) is active', () => {
    render(<NotebookTrigger isMobile={false} />)

    act(() => {
      window.dispatchEvent(
        new CustomEvent('student-study-drawer:state', {detail: {activePanel: 'study-assist'}}),
      )
    })

    const button = getTriggerButton()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).not.toHaveAttribute('aria-controls')
  })
})
