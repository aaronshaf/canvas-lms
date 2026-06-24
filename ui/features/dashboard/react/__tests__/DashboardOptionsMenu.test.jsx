/*
 * Copyright (C) 2016 - present Instructure, Inc.
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
import PropTypes from 'prop-types'
import {act, render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardOptionsMenu from '../DashboardOptionsMenu'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'

const server = setupServer(
  http.post('/users/toggle_hide_dashcard_color_overlays', () => HttpResponse.json({})),
)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const FakeDashboard = function ({
  menuRef,
  view = 'cards',
  planner_enabled = false,
  onDashboardChange = () => {},
}) {
  return (
    <div>
      <DashboardOptionsMenu
        ref={menuRef}
        view={view}
        planner_enabled={planner_enabled}
        onDashboardChange={onDashboardChange}
      />
      {planner_enabled && (
        <div>
          <div id="dashboard-planner" data-testid="dashboard-planner" style={{display: 'block'}} />
          <div
            id="dashboard-planner-header"
            data-testid="dashboard-planner-header"
            style={{display: 'block'}}
          />
        </div>
      )}
      <div id="dashboard-activity" data-testid="dashboard-activity" style={{display: 'block'}} />
      <div
        id="DashboardCard_Container"
        data-testid="dashboard-card-container"
        style={{display: 'none'}}
      >
        <div className="ic-DashboardCard__header">
          <div className="ic-DashboardCard__header_image">
            <div className="ic-DashboardCard__header_hero" style={{opacity: 0.6}} />
          </div>
          <div className="ic-DashboardCard__header-button-bg" style={{opacity: 0}} />
        </div>
      </div>
    </div>
  )
}

FakeDashboard.propTypes = {
  menuRef: PropTypes.func,
  view: PropTypes.string,
  planner_enabled: PropTypes.bool,
  onDashboardChange: PropTypes.func,
}

describe('Dashboard Options Menu', () => {
  let user

  beforeEach(() => {
    user = userEvent.setup({delay: null})
  })

  it('renders the menu button', () => {
    const {getByTestId} = render(<DashboardOptionsMenu onDashboardChange={() => {}} />)
    expect(getByTestId('dashboard-options-button')).toBeInTheDocument()
  })

  it('calls onDashboardChange when new view is selected', async () => {
    const onDashboardChange = vi.fn()
    const {getByTestId} = render(
      <DashboardOptionsMenu view="planner" onDashboardChange={onDashboardChange} />,
    )

    await user.click(getByTestId('dashboard-options-button'))
    await user.click(getByTestId('card-view-menu-item'))

    expect(onDashboardChange).toHaveBeenCalledWith('cards')
  })

  it('does not call onDashboardChange when current view is selected', async () => {
    const onDashboardChange = vi.fn()
    const {getByTestId} = render(
      <DashboardOptionsMenu view="activity" onDashboardChange={onDashboardChange} />,
    )

    await user.click(getByTestId('dashboard-options-button'))
    await user.click(getByTestId('recent-activity-menu-item'))

    expect(onDashboardChange).not.toHaveBeenCalled()
  })

  it('includes List View when Student Planner is enabled', async () => {
    const {getByTestId} = render(
      <DashboardOptionsMenu planner_enabled={true} onDashboardChange={() => {}} />,
    )

    await user.click(getByTestId('dashboard-options-button'))
    expect(getByTestId('list-view-menu-item')).toBeInTheDocument()
  })

  it('includes Homeroom View when Elementary dashboard can be enabled', async () => {
    const {getByTestId} = render(
      <DashboardOptionsMenu canEnableElementaryDashboard={true} onDashboardChange={() => {}} />,
    )

    await user.click(getByTestId('dashboard-options-button'))
    expect(getByTestId('homeroom-view-menu-item')).toBeInTheDocument()
  })

  it('displays color overlay option in card view', async () => {
    const {getByTestId} = render(<DashboardOptionsMenu onDashboardChange={() => {}} />)

    await user.click(getByTestId('dashboard-options-button'))
    expect(getByTestId('color-overlay-menu-item')).toBeInTheDocument()
  })

  it('does not display color overlay option in activity view', async () => {
    const {getByTestId, queryByTestId} = render(
      <DashboardOptionsMenu view="activity" onDashboardChange={() => {}} />,
    )

    await user.click(getByTestId('dashboard-options-button'))
    expect(queryByTestId('color-overlay-menu-item')).not.toBeInTheDocument()
  })

  it('toggles color overlays', async () => {
    let dashboardMenu = null
    render(
      <FakeDashboard
        menuRef={c => {
          dashboardMenu = c
        }}
        view="cards"
      />,
    )

    // Turn off color overlay
    await act(async () => {
      dashboardMenu.handleColorOverlayOptionSelect(false)
    })
    expect(document.getElementsByClassName('ic-DashboardCard__header_hero')[0].style.opacity).toBe(
      '0',
    )
    expect(
      document.getElementsByClassName('ic-DashboardCard__header-button-bg')[0].style.opacity,
    ).toBe('1')

    // Turn on color overlay
    await act(async () => {
      dashboardMenu.handleColorOverlayOptionSelect(true)
    })
    expect(document.getElementsByClassName('ic-DashboardCard__header_hero')[0].style.opacity).toBe(
      '0.6',
    )
    expect(
      document.getElementsByClassName('ic-DashboardCard__header-button-bg')[0].style.opacity,
    ).toBe('0')
  })
})
