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

// The `@canvas/publish-icon-view` -> `@canvas/publish-button-view` ->
// `DelayedPublishDialog.jsx` -> `@canvas/canvas-error-page` chain explodes at
// import time because the current snapshot of
// `@instructure/platform-generic-error-page` no longer exports
// `createErrorReporter`. Stubbing the `publish-button-view` backbone module
// short-circuits that chain so the QuizItemView template can render.
//
// Both mocks must be declared even though only the publish-button-view stub is
// strictly evaluated — vitest's resolver only intercepts the
// `@canvas/publish-button-view` alias when the `@canvas/publish-icon-view`
// alias is also mocked at the file's top level.
vi.mock('@canvas/publish-icon-view', async () => {
  // We keep the real publish-icon-view but only after the publish-button-view
  // mock below has neutralized the canvas-error-page poison.
  const actual: {default: unknown} = await vi.importActual('@canvas/publish-icon-view')
  return actual
})

vi.mock('@canvas/publish-button-view', async () => {
  // Re-implement publish-button-view as a minimal Backbone.View so the real
  // publish-icon-view (which extends it) can still walk the __super__ chain.
  // We avoid loading the real module because it imports DelayedPublishDialog,
  // which transitively pulls in `@canvas/canvas-error-page` whose module
  // initialization throws under the current platform-generic-error-page
  // snapshot ("createErrorReporter is not a function").
  const {default: Backbone} = (await vi.importActual('@canvas/backbone')) as {default: any}
  const StubButtonView = Backbone.View.extend({
    initialize() {},
    render() {
      return this
    },
  })
  return {default: StubButtonView, __esModule: true}
})

// Same `canvas-error-page` poison flows through the shared Tray module that
// `DirectShareCourseTray` / `DirectShareUserModal` depend on. Stub those
// React components to a no-op render so the QuizItemView module evaluates.
vi.mock('@canvas/direct-sharing/react/components/DirectShareCourseTray', () => ({
  __esModule: true,
  default: () => null,
}))

vi.mock('@canvas/direct-sharing/react/components/DirectShareUserModal', () => ({
  __esModule: true,
  default: () => null,
}))

import $ from 'jquery'
import CyoeHelper from '@canvas/conditional-release-cyoe-helper'
import PublishIconView from '@canvas/publish-icon-view'
import Quiz from '@canvas/quizzes/backbone/models/Quiz'
import fakeENV from '@canvas/test-utils/fakeENV'
import QuizItemView from '../backbone/views/QuizItemView'

$.fn.tooltip = vi.fn() as unknown as typeof $.fn.tooltip
// @ts-expect-error - simulate is a test-only jQuery extension
$.fn.simulate = vi.fn()

type CreateQuizOptions = {
  id?: number | string
  title?: string
  permissions?: Record<string, boolean>
  [key: string]: unknown
}

type CreateViewOptions = {
  canManage?: boolean
  canCreate?: boolean
  DIRECT_SHARE_ENABLED?: boolean
}

// QuizItemView is an untyped Backbone view; describe the slice of its instance
// API that these tests touch so we can cast its default export.
type QuizItemViewInstance = {
  $: (selector: string) => JQuery<HTMLElement>
  $el: JQuery<HTMLElement>
  render: () => QuizItemViewInstance
}

const createQuiz = (options: CreateQuizOptions = {}) => {
  const permissions = {
    delete: true,
    ...options.permissions,
  }
  return new (Quiz as unknown as new (attrs: Record<string, unknown>) => unknown)({
    permissions,
    ...options,
  })
}

const createView = (quiz: ReturnType<typeof createQuiz>, options: CreateViewOptions = {}) => {
  const icon = new (PublishIconView as unknown as new (props: unknown) => unknown)({model: quiz})

  // ENV is typed as the global account env; these Backbone views read a
  // different permissions/flags shape, so narrow ENV to the slice we set here.
  const env = ENV as unknown as {
    PERMISSIONS: {manage?: boolean; create?: boolean}
    FEATURES: Record<string, boolean>
    FLAGS: {DIRECT_SHARE_ENABLED: boolean}
    context_asset_string: string
  }
  env.PERMISSIONS = {
    manage: options.canManage,
    create: options.canCreate || options.canManage,
  }
  env.FEATURES = env.FEATURES || {}

  env.FLAGS = {
    DIRECT_SHARE_ENABLED: options.DIRECT_SHARE_ENABLED || false,
  }

  env.context_asset_string = 'course_1'

  const view = new (
    QuizItemView as unknown as new (viewOptions: {
      model: unknown
      publishIconView: unknown
    }) => QuizItemViewInstance
  )({model: quiz, publishIconView: icon})
  const $fixtures = $('<div id="fixtures" />').appendTo(document.body)
  view.$el.appendTo($fixtures)
  return view.render()
}

describe('QuizItemView direct share menu', () => {
  let $fixtures: JQuery<HTMLElement>

  beforeEach(() => {
    $fixtures = $('<div id="fixtures" />').appendTo(document.body)
    fakeENV.setup({
      CONDITIONAL_RELEASE_ENV: {
        active_rules: [],
      },
    })
    CyoeHelper.reloadEnv()
  })

  afterEach(() => {
    $fixtures.remove()
    fakeENV.teardown()
  })

  it('shows "Send to..." in the manage menu when DIRECT_SHARE_ENABLED and canManage', () => {
    const quiz = createQuiz({id: 1, title: 'Math Quiz!'})
    const view = createView(quiz, {canManage: true, DIRECT_SHARE_ENABLED: true})

    const sendLinks = view.$('.quiz-send-to')
    expect(sendLinks).toHaveLength(1)
    expect(sendLinks.text()).toContain('Send to...')
  })

  it('shows "Copy to..." in the manage menu when DIRECT_SHARE_ENABLED and canManage', () => {
    const quiz = createQuiz({id: 1, title: 'Math Quiz!'})
    const view = createView(quiz, {canManage: true, DIRECT_SHARE_ENABLED: true})

    const copyLinks = view.$('.quiz-copy-to')
    expect(copyLinks).toHaveLength(1)
    expect(copyLinks.text()).toContain('Copy to...')
  })

  it('omits direct share options from the manage menu when DIRECT_SHARE_ENABLED is false', () => {
    const quiz = createQuiz({id: 1, title: 'Math Quiz!'})
    const view = createView(quiz, {canManage: true, DIRECT_SHARE_ENABLED: false})

    expect(view.$('.quiz-send-to')).toHaveLength(0)
    expect(view.$('.quiz-copy-to')).toHaveLength(0)
  })
})
