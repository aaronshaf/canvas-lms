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

vi.mock('@instructure/ready', () => ({default: (fn: () => void) => fn()}))
vi.mock('@canvas/react', () => ({render: vi.fn()}))

async function loadModule() {
  const mod = await import('@canvas/react')
  const mockRender = mod.render as ReturnType<typeof vi.fn>
  mockRender.mockClear()
  vi.resetModules()
  await import('../index')
  return mockRender
}

describe('notebook trigger mounting', () => {
  let desktopMount: HTMLElement
  let mobileMount: HTMLElement

  beforeEach(() => {
    window.ENV = {...window.ENV, FEATURES: {notebook: true}}
    desktopMount = document.createElement('div')
    desktopMount.id = 'notebook_mount_point'
    mobileMount = document.createElement('div')
    mobileMount.id = 'notebook_mobile_mount_point'
    document.body.appendChild(desktopMount)
    document.body.appendChild(mobileMount)
  })

  afterEach(() => {
    desktopMount.remove()
    mobileMount.remove()
  })

  it('mounts the notebook button in both desktop and mobile mount points', async () => {
    const mockRender = await loadModule()
    const calls = mockRender.mock.calls as Array<[React.ReactElement, HTMLElement]>
    const mountedIds = calls.map(([, el]) => el.id)
    expect(mountedIds).toContain('notebook_mount_point')
    expect(mountedIds).toContain('notebook_mobile_mount_point')
  })

  it('passes isMobile=false for the desktop mount and isMobile=true for the mobile mount', async () => {
    const mockRender = await loadModule()
    const calls = mockRender.mock.calls as Array<[React.ReactElement, HTMLElement]>
    const byId = Object.fromEntries(calls.map(([el, mount]) => [mount.id, el.props]))
    expect(byId['notebook_mount_point'].isMobile).toBe(false)
    expect(byId['notebook_mobile_mount_point'].isMobile).toBe(true)
  })

  it('does not mount when the notebook feature flag is off', async () => {
    window.ENV.FEATURES = {notebook: false}
    const mockRender = await loadModule()
    expect(mockRender).not.toHaveBeenCalled()
  })
})
