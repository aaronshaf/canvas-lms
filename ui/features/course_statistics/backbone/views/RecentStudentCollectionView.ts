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

// @ts-expect-error
extend(RecentStudentCollectionView, PaginatedView)

// @ts-expect-error
function RecentStudentCollectionView() {
  // @ts-expect-error
  this.renderUser = this.renderUser.bind(this)
  // @ts-expect-error
  this.render = this.render.bind(this)
  // @ts-expect-error
  return RecentStudentCollectionView.__super__.constructor.apply(this, arguments)
}

// @ts-expect-error
RecentStudentCollectionView.prototype.initialize = function (_options) {
  this.collection.on('add', this.renderUser)
  this.collection.on('reset', this.render)
  this.paginationScrollContainer = this.$el
  // @ts-expect-error
  return RecentStudentCollectionView.__super__.initialize.apply(this, arguments)
}

RecentStudentCollectionView.prototype.render = function () {
  // @ts-expect-error
  const ret = RecentStudentCollectionView.__super__.render.apply(this, arguments)
  this.collection.each(
    (function (_this) {
      // @ts-expect-error
      return function (user) {
        return _this.renderUser(user)
      }
    })(this),
  )
  return ret
}

// @ts-expect-error
RecentStudentCollectionView.prototype.renderUser = function (user) {
  user.set('course_id', this.collection.course_id, {
    silent: true,
  })
  return this.$el.append(
    // @ts-expect-error
    new RecentStudentView({
      model: user,
    }).render().el,
  )
}

export default RecentStudentCollectionView
