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

// Regression coverage for the eportfolio section save innerHTML sink.
// On form submit, `processData` reads each section's `.edit_section`
// textarea (for html-type sections) and writes the result into
// `.section_content` via jQuery `.html(...)`. Defense-in-depth requires
// that no <script> tags or event-handler attributes survive in the
// rendered DOM, regardless of what shape the input HTML took.
// The shared @canvas/sanitize-html (DOMPurify) helper is the final pass
// at the sink.

import $ from 'jquery'

vi.mock('@canvas/rce/RichContentEditor', () => ({
  default: {
    preloadRemoteModule: vi.fn(),
    loadNewEditor: vi.fn(),
    destroyRCE: vi.fn(),
    callOnRCE: vi.fn(() => ''),
  },
}))

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

// Minimal DOM that mirrors the shipping eportfolio edit page enough to
// exercise the html-section save branch in `processData`. The section
// presents an "html" type with a `.edit_section` textarea (the input)
// and a `.section_content` div (the innerHTML sink). On form submit,
// processData reads the textarea, sanitizes its value, and writes the
// result into `.section_content`.
const buildFixture = (htmlPayload: string) => {
  const fixture = document.createElement('div')
  fixture.id = 'eportfolio_fixture'
  fixture.innerHTML = `
    <div id="content"><h2><span class="name">My Page</span></h2></div>
    <div id="page_name_mount"></div>
    <div id="page_button_mount"></div>
    <div id="side_button_mount"></div>
    <a class="edit_content_link" href="#">Edit</a>
    <div class="edit_content_link_holder"></div>
    <div id="page_sidebar"></div>
    <div id="page_comments_holder"></div>
    <form id="edit_page_form" action="/x" onsubmit="return false">
      <div id="page_content">
        <div class="section" id="page_section_1">
          <span class="section_type">html</span>
          <div class="section_content"></div>
          <div class="edit_html_content">
            <textarea class="edit_section"></textarea>
          </div>
        </div>
      </div>
    </form>
    <div id="edit_content_templates" style="display:none">
      <div class="edit_html_content">
        <textarea class="edit_section"></textarea>
      </div>
      <div class="edit_rich_text_content">
        <textarea class="edit_section"></textarea>
      </div>
    </div>
  `
  document.body.appendChild(fixture)
  // .val() puts the payload as the textarea's value (treated as text, not
  // HTML), so the malicious payload survives as a string until the
  // sanitizer at the .html() sink processes it.
  $(fixture).find('#page_section_1 .edit_section').val(htmlPayload)
  return fixture
}

describe('eportfolio jquery index — XSS regression', () => {
  let fixture: HTMLElement

  beforeEach(() => {
    delete (window as any).__xss_fired
    vi.resetModules()
  })

  afterEach(() => {
    fixture?.remove()
    document.body.innerHTML = ''
    delete (window as any).__xss_fired
  })

  const bootstrap = async () => {
    await import('../index')
    // jQuery's $(document).ready(...) defers to a microtask in jsdom; flush.
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  const submitFormWithPayload = async (payload: string) => {
    fixture = buildFixture(payload)
    await bootstrap()
    // Trigger the form-submit handler that the module wired via formSubmit;
    // the `processData` callback runs first and writes
    // sanitizeHTML(.edit_section) into .section_content via .html(...).
    $(fixture).find('#edit_page_form').trigger('submit')
  }

  it('strips <script> tags from the saved section_content', async () => {
    await submitFormWithPayload(
      '<p>before</p><script>window.__xss_fired = true</script><p>after</p>',
    )

    const sectionContent = fixture.querySelector<HTMLElement>('#page_section_1 .section_content')!
    expect(sectionContent.querySelector('script')).toBeNull()
    expect(sectionContent.innerHTML.toLowerCase()).not.toContain('<script')
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips inline event handlers from the saved section_content', async () => {
    await submitFormWithPayload('<p>hi <img src=x onerror="window.__xss_fired = true"></p>')

    const sectionContent = fixture.querySelector<HTMLElement>('#page_section_1 .section_content')!
    expectNoEventHandlers(sectionContent)
    expect(sectionContent.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', async () => {
    // Defense-in-depth shape: even if the input text contains tag-like content
    // inside a title attribute and a downstream string mutator were to break
    // the attribute boundary, the sink-level sanitizer must strip any
    // resulting on* handler in the rendered DOM.
    await submitFormWithPayload(
      '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
    )

    const sectionContent = fixture.querySelector<HTMLElement>('#page_section_1 .section_content')!
    expectNoEventHandlers(sectionContent)
    expect((window as any).__xss_fired).toBeUndefined()
  })
})
