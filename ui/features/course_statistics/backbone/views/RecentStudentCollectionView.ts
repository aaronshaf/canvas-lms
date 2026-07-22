/*
 * Copyright (C) 2023 - present Instructure, Inc.
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

import {extend} from '@canvas/backbone/utils'
import PaginatedView from '@canvas/pagination/backbone/views/PaginatedView'
import RecentStudentView from './RecentStudentView'
import type Backbone from '@canvas/backbone'

interface RecentStudentCollection extends Backbone.Collection {
  course_id?: string
}

interface RecentStudentCollectionViewOptions extends Backbone.ViewOptions<Backbone.Model> {
  collection: RecentStudentCollection
}

// @ts-expect-error - Backbone extend pattern not fully typed
extend(RecentStudentCollectionView, PaginatedView)

function RecentStudentCollectionView(this: any) {
  this.renderUser = this.renderUser.bind(this)
  this.render = this.render.bind(this)
  // @ts-expect-error - Backbone __super__ pattern
  return RecentStudentCollectionView.__super__.constructor.apply(this, arguments)
}

RecentStudentCollectionView.prototype.initialize = function (
  this: {
    collection: RecentStudentCollection
    $el: JQuery
    paginationScrollContainer?: JQuery
  },
  _options: RecentStudentCollectionViewOptions,
) {
  // @ts-expect-error - Backbone collection event methods
  this.collection.on('add', this.renderUser)
  // @ts-expect-error - Backbone collection event methods
  this.collection.on('reset', this.render)
  this.paginationScrollContainer = this.$el
  // @ts-expect-error - Backbone __super__ pattern
  return RecentStudentCollectionView.__super__.initialize.apply(this, arguments)
}

RecentStudentCollectionView.prototype.render = function (this: {
  collection: RecentStudentCollection
  renderUser: (user: Backbone.Model) => void
}) {
  // @ts-expect-error - Backbone __super__ pattern
  const ret = RecentStudentCollectionView.__super__.render.apply(this, arguments)
  // @ts-expect-error - Backbone collection methods
  this.collection.each(
    (function (_this) {
      return function (user: Backbone.Model) {
        return _this.renderUser(user)
      }
    })(this),
  )
  return ret
}

RecentStudentCollectionView.prototype.renderUser = function (
  this: {collection: RecentStudentCollection; $el: JQuery},
  user: Backbone.Model,
) {
  user.set('course_id', this.collection.course_id, {
    silent: true,
  })
  return this.$el.append(
    // @ts-expect-error - Backbone view constructor pattern
    new RecentStudentView({
      model: user,
    }).render().el,
  )
}

export default RecentStudentCollectionView
