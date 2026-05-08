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

// Regression coverage for the submission show page comment-render sink.
// Comment HTML is read from a `data-content` attribute on `.comment_content`
// and assigned to `innerHTML`; defense-in-depth requires that no <script>
// tags or event-handler attributes survive in the rendered DOM, regardless
// of what shape the input HTML took. The shared @canvas/sanitize-html
// (DOMPurify) helper is the final pass at the sink.

import $ from 'jquery'
import fakeENV from '@canvas/test-utils/fakeENV'
import '@canvas/jquery/jquery.ajaxJSON'
import '@canvas/media-comments'
import '@canvas/media-comments/jquery/mediaCommentThumbnail'
import {setup, teardown} from '../index'
import {waitFor} from '@testing-library/dom'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderWithCommentHtml = async htmlContent => {
  // The entry's ready() callback iterates `.comment_content` elements and
  // assigns the sanitized `data-content` to innerHTML. We seed one element
  // with the malicious payload, then run the module's setup() which fires
  // the same code path on document ready.
  document.body.innerHTML = `
    <div id="fixtures">
      <div id='preview_frame'>
        <div id='rubric_holder'></div>
        <div class='save_rubric_button'></div>
        <a class='update_submission_url' href='submission_data_url.com' title='POST'></a>
        <input type='text' class='grading_value' placeholder='-' />
        <div class='submission_header'></div>
        <div class='comments_link'></div>
        <div class='attach_comment_file_link'></div>
        <div class='delete_comment_attachment_link'></div>
        <div class='comments'>
          <div class='comment_list'>
            <div class='comment' id='submission_comment_xss'>
              <div class='comment'>
                <span class='comment_content' id='xss_target'></span>
              </div>
            </div>
          </div>
        </div>
        <textarea class='grading_comment'></textarea>
        <div id="textarea-error-container"></div>
        <input type='checkbox' id='submission_group_comment'>
        <div class='save_comment_button'></div>
      </div>
    </div>
  `
  // dataset.content is HTML-decoded text — assign through dataset directly so
  // raw markup (with quotes/brackets) round-trips through the data-* contract
  // exactly as production does.
  document.getElementById('xss_target').dataset.content = htmlContent

  setup()
  const readyCallback = vi.fn()
  $(document).ready(readyCallback)
  $(document).trigger('ready')
  await waitFor(() => expect(readyCallback).toHaveBeenCalled())
  return document.getElementById('xss_target')
}

describe('submissions show — XSS regression at comment_content sink', () => {
  beforeEach(() => {
    fakeENV.setup()
    window.ENV.SUBMISSION = {
      user_id: 1,
      assignment_id: 27,
      submission: {},
    }
    delete window.__xss_fired
  })

  afterEach(() => {
    teardown()
    fakeENV.teardown()
    delete window.__xss_fired
  })

  it('strips <script> tags from rendered comment HTML', async () => {
    const target = await renderWithCommentHtml(
      '<p>before<script>window.__xss_fired = true</script>after</p>',
    )
    expect(target.querySelector('script')).toBeNull()
    expect(target.innerHTML.toLowerCase()).not.toContain('<script')
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips inline event handlers from rendered comment HTML', async () => {
    const target = await renderWithCommentHtml(
      '<p>hi <img src=x onerror="window.__xss_fired = true"></p>',
    )
    expectNoEventHandlers(target)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', async () => {
    // Defense-in-depth shape: even if the input text contains tag-like content
    // inside a title attribute and a downstream string mutator were to break
    // the attribute boundary, the sink-level sanitizer must strip any
    // resulting on* handler in the rendered DOM.
    const target = await renderWithCommentHtml(
      '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
    )
    expectNoEventHandlers(target)
    expect(window.__xss_fired).toBeUndefined()
  })
})
