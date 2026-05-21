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

import * as browser from '../browser'

function makeBrowserEnv(isIE = false, isEdge = false) {
  return {browser: {isIE: () => isIE, isEdge: () => isEdge}}
}

afterEach(() => {
  browser.set(makeBrowserEnv(false, false))
})

describe('browser', () => {
  it('set() reads from env.browser methods, not deprecated env.ie/env.edge (regression: 196657474f4f)', () => {
    // Before fix: used deprecated env.ie / env.edge property access (tinymce Env v5 API).
    // After fix: uses env.browser.isIE() / env.browser.isEdge() (tinymce Env v6+ API).
    browser.set(makeBrowserEnv(true, false))
    expect(browser.ie()).toBe(true)
    expect(browser.edge()).toBe(false)
  })

  it('set() correctly reports Edge', () => {
    browser.set(makeBrowserEnv(false, true))
    expect(browser.ie()).toBe(false)
    expect(browser.edge()).toBe(true)
  })

  it('reset() sets both flags to false', () => {
    browser.set(makeBrowserEnv(true, true))
    browser.reset()
    expect(browser.ie()).toBe(false)
    expect(browser.edge()).toBe(false)
  })

  it('setFromTinymce() delegates to set() using tinymce.Env', () => {
    browser.setFromTinymce({Env: makeBrowserEnv(true, false)})
    expect(browser.ie()).toBe(true)
    expect(browser.edge()).toBe(false)
  })
})
