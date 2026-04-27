/*
 * Copyright (C) 2017 - present Instructure, Inc.
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
import {act, render, fireEvent, waitFor} from '@testing-library/react'
import DashboardCardMenu from '../DashboardCardMenu'

const defaultProps = () => ({
  trigger: <button type="button">menu</button>,
  assetString: 'course_1',
  afterUpdateColor: () => {},
  currentColor: '#8a8a8a',
  nicknameInfo: {
    nickname: 'foos',
    originalName: 'foosball',
    courseId: '1',
    onNicknameChange: () => {},
  },
  applicationElement: () => document.getElementById('fixtures'),
})

const defaultMovementMenuProps = () => ({
  menuOptions: {
    canMoveLeft: false,
    canMoveRight: true,
    canMoveToBeginning: false,
    canMoveToEnd: true,
  },
})

describe('DashboardCardMenu - reordering', () => {
  // FOO-3822
  it('it should render a tabList with colorpicker and movement menu', async () => {
    const ref = React.createRef()
    const {getByText} = render(
      <DashboardCardMenu {...defaultProps()} {...defaultMovementMenuProps()} ref={ref} />,
    )

    fireEvent.click(getByText('menu'))

    await waitFor(() => {
      expect(ref.current._tabList).toBeTruthy()
      expect(ref.current._colorPicker).toBeTruthy()
    })

    fireEvent.click(getByText('Move'))
    await waitFor(() => expect(ref.current._movementMenu).toBeTruthy())
  })

  it('it should close the popover on close button click', async () => {
    const ref = React.createRef()
    const {getByText} = render(
      <DashboardCardMenu {...defaultProps()} {...defaultMovementMenuProps()} ref={ref} />,
    )

    fireEvent.click(getByText('menu'))
    await waitFor(() => expect(ref.current.state.show).toBe(true))

    fireEvent.click(ref.current._closeButton)
    await waitFor(() => expect(ref.current.state.show).toBe(false))
  })

  it('it should close the popover on color picker close', async () => {
    const ref = React.createRef()
    const {getByText} = render(
      <DashboardCardMenu {...defaultProps()} {...defaultMovementMenuProps()} ref={ref} />,
    )

    fireEvent.click(getByText('menu'))
    await waitFor(() => expect(ref.current.state.show).toBe(true))

    await act(async () => {
      ref.current._colorPicker.closeModal()
    })
    await waitFor(() => expect(ref.current.state.show).toBe(false))
  })

  // FOO-3822
  it('it should close the popover on movement menu option select', async () => {
    const ref = React.createRef()
    const {getByText} = render(
      <DashboardCardMenu {...defaultProps()} {...defaultMovementMenuProps()} ref={ref} />,
    )

    fireEvent.click(getByText('menu'))
    await waitFor(() => expect(ref.current.state.show).toBe(true))

    fireEvent.click(getByText('Move'))

    await waitFor(() => {
      const menuItems = document.querySelectorAll('[role="menuitem"]')
      expect(menuItems.length).toBeGreaterThan(0)
    })
    fireEvent.click(document.querySelectorAll('[role="menuitem"]')[0])
    await waitFor(() => expect(ref.current.state.show).toBe(false))
  })
})
