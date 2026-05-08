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

// Regression coverage for the assignment show page comment-render sink.
// Comment HTML is read from a `data-content` attribute on `.comment_content`
// and assigned to `innerHTML`; defense-in-depth requires that no <script>
// tags or event-handler attributes survive in the rendered DOM, regardless
// of what shape the input HTML took. The shared @canvas/sanitize-html
// (DOMPurify) helper is the final pass at the sink. The entry-point's
// `renderSanitizedComments` helper is exported for direct exercise here so
// we don't have to boot the rest of the side-effect-heavy entry module.

import {renderSanitizedComments} from '../renderSanitizedComments'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderWithCommentHtml = (htmlContent: string) => {
  document.body.innerHTML = `
    <div class='comments'>
      <span class='comment_content' id='xss_target'></span>
    </div>
  `
  document.getElementById('xss_target')!.dataset.content = htmlContent
  renderSanitizedComments()
  return document.getElementById('xss_target')!
}

describe('assignment_show — XSS regression at comment_content sink', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
    document.body.innerHTML = ''
  })

  it('strips <script> tags from rendered comment HTML', () => {
    const target = renderWithCommentHtml(
      '<p>before<script>window.__xss_fired = true</script>after</p>',
    )
    expect(target.querySelector('script')).toBeNull()
    expect(target.innerHTML.toLowerCase()).not.toContain('<script')
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips inline event handlers from rendered comment HTML', () => {
    const target = renderWithCommentHtml(
      '<p>hi <img src=x onerror="window.__xss_fired = true"></p>',
    )
    expectNoEventHandlers(target)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', () => {
    // Defense-in-depth shape: even if the input text contains tag-like content
    // inside a title attribute and a downstream string mutator were to break
    // the attribute boundary, the sink-level sanitizer must strip any
    // resulting on* handler in the rendered DOM.
    const target = renderWithCommentHtml(
      '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
    )
    expectNoEventHandlers(target)
    expect((window as any).__xss_fired).toBeUndefined()
  })
})
