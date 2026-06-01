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

// Mock the broken `createErrorReporter` transitive dependency. The
// `@instructure/platform-generic-error-page` package shipped in the current
// snapshot does not export `createErrorReporter`, which causes
// `ui/shared/canvas-error-page/index.tsx` to throw at module-evaluation time
// when `@canvas/publish-button-view` is loaded indirectly via
// `DelayedPublishDialog.jsx` -> `@canvas/canvas-error-page`.
vi.mock('@instructure/platform-generic-error-page', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@instructure/platform-generic-error-page',
  )
  return {
    ...actual,
    createErrorReporter: () => () => Promise.resolve(),
  }
})

import $ from 'jquery'
import Backbone from '@canvas/backbone'
import PublishButtonView from '@canvas/publish-button-view'

class PublishableQuiz extends Backbone.Model {
  defaults() {
    return {
      published: false,
      publishable: true,
      unpublishable: true,
      publish_at: null,
      disabledForModeration: false,
    }
  }

  publish() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this as any).set('published', true)
    const dfrd = $.Deferred()
    dfrd.resolve()
    return dfrd
  }

  unpublish() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this as any).set('published', false)
    const dfrd = $.Deferred()
    dfrd.resolve()
    return dfrd
  }

  disabledMessage() {
    return "can't unpublish"
  }
}

describe('#quiz-publish-link via PublishButtonView (quiz show page)', () => {
  let $button: ReturnType<typeof $>

  beforeEach(() => {
    $button = $('<button id="quiz-publish-link" class="btn quiz-publish-button"></button>')
    $button.appendTo(document.body)
  })

  afterEach(() => {
    $button?.remove()
    document.body.innerHTML = ''
  })

  it('shows "Unpublish" when hovered while the quiz is published', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = new (PublishableQuiz as any)({published: true, unpublishable: true})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = new (PublishButtonView as any)({model, el: $button}).render()

    expect(view.$text.html()).toMatch(/Published/)
    expect(view.$text.html()).not.toMatch(/Unpublish[^e]/)

    view.$el.trigger('mouseenter')

    expect(view.$text.text()).toMatch(/Unpublish/)
  })

  it('restores "Published" text when the pointer leaves the hovered published button', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = new (PublishableQuiz as any)({published: true, unpublishable: true})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = new (PublishButtonView as any)({model, el: $button}).render()

    view.$el.trigger('mouseenter')
    expect(view.$text.text()).toMatch(/Unpublish/)

    view.$el.trigger('mouseleave')
    expect(view.$text.text()).toMatch(/Published/)
  })
})
