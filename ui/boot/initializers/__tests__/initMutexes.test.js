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

import fakeENV from '@canvas/test-utils/fakeENV'

describe('initMutexes drawer_layout_mutex', () => {
  const drawer_layout_mutex = 'drawer-layout-mutex'
  let MutexManager

  beforeEach(() => {
    fakeENV.setup()
    document.body.innerHTML = ''
    jest.resetModules()
    MutexManager = require('@canvas/mutex-manager/MutexManager').default
    MutexManager.mutexes = {}
  })

  afterEach(() => {
    document.body.innerHTML = ''
    MutexManager.mutexes = {}
    fakeENV.teardown()
  })

  it('should create a drawer layout mutex if all conditions are met', () => {
    window.ENV.INIT_DRAWER_LAYOUT_MUTEX = drawer_layout_mutex

    const topNav = document.createElement('div')
    topNav.id = 'top-nav-tools-mount-point'
    document.body.appendChild(topNav)

    const drawerLayout = document.createElement('div')
    drawerLayout.id = 'drawer-layout-mount-point'
    document.body.appendChild(drawerLayout)

    require('../initMutexes')
    expect(MutexManager.mutexes[drawer_layout_mutex]).toBeDefined()
  })

  it('should not create a mutex if the ENV variable is not set', () => {
    const topNav = document.createElement('div')
    topNav.id = 'top-nav-tools-mount-point'
    document.body.appendChild(topNav)

    const drawerLayout = document.createElement('div')
    drawerLayout.id = 'drawer-layout-mount-point'
    document.body.appendChild(drawerLayout)

    require('../initMutexes')
    expect(MutexManager.mutexes[drawer_layout_mutex]).toBeUndefined()
  })

  it('should not create a mutex if the top nav mount point is not present', () => {
    window.ENV.INIT_DRAWER_LAYOUT_MUTEX = drawer_layout_mutex

    const drawerLayout = document.createElement('div')
    drawerLayout.id = 'drawer-layout-mount-point'
    document.body.appendChild(drawerLayout)

    require('../initMutexes')
    expect(MutexManager.mutexes[drawer_layout_mutex]).toBeUndefined()
  })

  it('should not create a mutex if the drawer layout mount point is not present', () => {
    window.ENV.INIT_DRAWER_LAYOUT_MUTEX = drawer_layout_mutex

    const topNav = document.createElement('div')
    topNav.id = 'top-nav-tools-mount-point'
    document.body.appendChild(topNav)

    require('../initMutexes')
    expect(MutexManager.mutexes[drawer_layout_mutex]).toBeUndefined()
  })
})
