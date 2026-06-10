/*
 * Copyright (C) 2013 - present Instructure, Inc.
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

import WikiPage from '@canvas/wiki/backbone/models/WikiPage'
import WikiPageContentView from '../WikiPageContentView'
import {subscribe} from 'jquery-tinypubsub'

describe('WikiPageContentView', () => {
  let wikiPage
  let contentView

  beforeEach(() => {
    wikiPage = new WikiPage()
    contentView = new WikiPageContentView()
  })

  test('setModel causes a re-render', () => {
    const renderSpy = vi.spyOn(contentView, 'render')
    contentView.setModel(wikiPage)
    expect(renderSpy).toHaveBeenCalled()
  })

  test('setModel binds to the model change:title trigger', () => {
    vi.spyOn(contentView, 'render')
    contentView.setModel(wikiPage)
    wikiPage.set('title', 'A New Title')
    expect(contentView.render).toHaveBeenCalled()
  })

  test('setModel binds to the model change:body trigger', () => {
    vi.spyOn(contentView, 'render')
    contentView.setModel(wikiPage)
    wikiPage.set('body', 'A New Body')
    expect(contentView.render).toHaveBeenCalled()
  })

  test('render publishes a "userContent/change" (to enhance user content)', () => {
    const mockSubscriber = vi.fn()
    subscribe('userContent/change', mockSubscriber)
    contentView.render()
    expect(mockSubscriber).toHaveBeenCalled()
  })

  // guards the handlebars ../ depth fix (broke on the handlebars 1.3 -> 4.x
  // upgrade): the module-prerequisite link is inside {{#each prerequisites}}
  // and references the root-level modules_path, so the ../ depth must resolve
  // to the page root. previously this branch fell through to plain text.
  test('renders module prerequisite links when locked by module prerequisites', () => {
    const lockedPage = new WikiPage({
      title: 'Locked Page',
      locked_for_user: true,
      lock_info: {
        context_module: {
          prerequisites: [{type: 'context_module', name: 'Module A', id: '7'}],
        },
      },
    })
    const view = new WikiPageContentView({
      model: lockedPage,
      modules_path: '/courses/1/modules',
    })
    view.render()

    const link = view.$el.find('a[href="/courses/1/modules/7"]')
    expect(link.length).toBe(1)
    expect(link.text().trim()).toBe('Module A')
  })
})
