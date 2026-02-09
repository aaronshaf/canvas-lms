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

import $ from 'jquery'
import ready from '@instructure/ready'
import UserCollection from '@canvas/users/backbone/collections/UserCollection'
import progressionsIndexTemplate from './jst/ProgressionsIndex.handlebars'
import PaginatedCollectionView from '@canvas/pagination/backbone/views/PaginatedCollectionView'
import ProgressionStudentView from './backbone/views/ProgressionStudentView'

import React from 'react'
import {createRoot} from 'react-dom/client'
import ProgressionModuleHeader from './react/components/ProgressionModuleHeader'

ready(() => {
  class IndexView extends PaginatedCollectionView {
    // @ts-expect-error
    constructor(options) {
      super(options)
      // @ts-expect-error
      this.root = null
    }

    // needed to render the react component at the top of the page
    // in the right lifecycle method of backbone
    afterRender() {
      const container = document.getElementById('progression-module-header-root')
      if (container) {
        // @ts-expect-error
        this.root = createRoot(container)
        // @ts-expect-error
        this.root.render(<ProgressionModuleHeader bridge={this.collection} />)
      }
    }

    remove() {
      // @ts-expect-error
      if (this.root) {
        // @ts-expect-error
        this.root.unmount()
      }
      super.remove()
    }
  }

  let students
  $(document.body).addClass('context_modules2')

  // @ts-expect-error
  if (ENV.RESTRICTED_LIST) {
    // @ts-expect-error
    students = new UserCollection(ENV.VISIBLE_STUDENTS)
    // @ts-expect-error
    students.urls = null
  } else {
    students = new UserCollection(null, {
      params: {
        per_page: 50,
        enrollment_type: 'student',
      },
    })
  }

  const indexView = new IndexView({
    collection: students,
    itemView: ProgressionStudentView,
    template: progressionsIndexTemplate,
    // @ts-expect-error
    modules_url: ENV.MODULES_URL,
    autoFetch: true,
  })

  // @ts-expect-error
  if (!ENV.RESTRICTED_LIST) {
    // attach the view's scroll container once it's populated
    // @ts-expect-error
    students.fetch({
      success() {
        // @ts-expect-error
        if (students.length === 0) return
        indexView.resetScrollContainer(
          // @ts-expect-error
          indexView.$el.find('#progression_students .collectionViewItems'),
        )
      },
    })
  }

  // we need to have the backbone view in the dom before we can render the react component
  // @ts-expect-error
  indexView.$el.appendTo($('#content'))

  // @ts-expect-error
  indexView.render()

  // @ts-expect-error
  if (ENV.RESTRICTED_LIST && ENV.VISIBLE_STUDENTS.length === 1) {
    // @ts-expect-error
    indexView.$el.find('#progression_students').hide()
  }
})
