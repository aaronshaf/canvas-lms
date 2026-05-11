//
// Copyright (C) 2012 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.
//

// xsslint safeString.identifier icon span a

import OutcomeIconBase from './OutcomeIconBase'

export default class OutcomeIconView extends OutcomeIconBase {
  render() {
    const title = this.model.get('title')
    this.$el.attr('data-id', this.model.get('id'))

    const a = document.createElement('a')
    a.href = '#'
    a.className = 'ellipsis'
    a.title = title

    const icon = document.createElement('i')
    icon.className = 'icon-outcomes'
    icon.setAttribute('aria-hidden', 'true')

    const span = document.createElement('span')
    span.textContent = title

    a.append(icon, span)
    this.$el.empty().append(a)

    return super.render(...arguments)
  }
}
OutcomeIconView.prototype.className = 'outcome-link'
