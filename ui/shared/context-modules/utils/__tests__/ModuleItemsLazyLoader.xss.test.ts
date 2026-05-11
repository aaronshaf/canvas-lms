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

// XSS regression tests for ModuleItemsLazyLoader.renderResult().
// Verifies that server-rendered module HTML is passed through
// sanitizeHTML before insertion into the DOM, so a Flavor-2
// entity-decode regression in the backend renderer cannot execute
// script via event-handler attributes.

import {ModuleItemsLazyLoader} from '../ModuleItemsLazyLoader'
import {ModuleItemsStore} from '../ModuleItemsStore'

const courseId = '1'
const accountId = '2'
const userId = '3'
const moduleId = '9001'

function createModuleDOM(id: string) {
  document.body.innerHTML = `
    <div id="context_module_${id}">
      <div id="context_module_content_${id}">
        <ul class="context_module_items"></ul>
      </div>
    </div>
  `
}

describe('ModuleItemsLazyLoader XSS hardening', () => {
  let loader: ModuleItemsLazyLoader

  beforeEach(() => {
    const store = new ModuleItemsStore(courseId, accountId, userId)
    loader = new ModuleItemsLazyLoader(courseId, vi.fn(), store)
    createModuleDOM(moduleId)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('strips onerror event handlers from img tags in module item HTML', () => {
    const xssPayload = '<ul><li><img src="x" onerror="window.__xss_fired=true"></li></ul>'
    loader.renderResult(moduleId, xssPayload)

    const img = document.querySelector(
      `#context_module_content_${moduleId} img`,
    ) as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img?.getAttribute('onerror')).toBeNull()
    expect((window as unknown as Record<string, unknown>).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs from anchor tags in module item HTML', () => {
    const xssPayload = '<ul><li><a href="javascript:window.__xss_link=true">click me</a></li></ul>'
    loader.renderResult(moduleId, xssPayload)

    const anchor = document.querySelector(
      `#context_module_content_${moduleId} a`,
    ) as HTMLAnchorElement | null
    expect(anchor).not.toBeNull()
    // DOMPurify either removes the href entirely or replaces it — either way
    // it must not contain a javascript: URI.
    const href = anchor?.getAttribute('href') ?? ''
    expect(href).not.toMatch(/^javascript:/i)
  })

  it('preserves legitimate module item HTML structure', () => {
    const safePayload =
      '<ul class="context_module_items"><li class="context_module_item"><a href="/courses/1/assignments/1">Assignment 1</a></li></ul>'
    loader.renderResult(moduleId, safePayload)

    const item = document.querySelector(`#context_module_content_${moduleId} .context_module_item`)
    expect(item).not.toBeNull()
    const link = item?.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/courses/1/assignments/1')
    expect(link?.textContent).toBe('Assignment 1')
  })
})
