//
// Copyright (C) 2013 - present Instructure, Inc.
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

import {each} from 'es-toolkit/compat'
import PaginatedCollection from '@canvas/pagination/backbone/collections/PaginatedCollection'

export default class SyllabusCalendarEventsCollection extends PaginatedCollection {
  // @ts-expect-error
  initialize(context_codes, type = 'event') {
    this.parse = this.parse.bind(this)
    // @ts-expect-error
    this.context_codes = context_codes
    // @ts-expect-error
    this.type = type
    return super.initialize(...arguments)
  }

  fetch(options = {}) {
    // @ts-expect-error
    if (options.remove == null) options.remove = false
    // @ts-expect-error
    if (options.data == null) options.data = {}

    // @ts-expect-error
    options.data.type = this.type
    // @ts-expect-error
    options.data.context_codes = this.context_codes
    // @ts-expect-error
    if (options.data.all_events == null) {
      // @ts-expect-error
      options.data.all_events = '1'
    }
    // @ts-expect-error
    options.data.excludes = ['assignment', 'description', 'child_events']

    return super.fetch(options)
  }

  // Overridden to make the id unique when aggregated in
  // a collection with other models, and to exclude
  // 'hidden' events
  // @ts-expect-error
  parse(...args) {
    // @ts-expect-error
    let normalize
    // @ts-expect-error
    const eventType = this.type
    switch (eventType) {
      case 'assignment':
        // @ts-expect-error
        normalize = function (ev) {
          ev.related_id = ev.id

          let overridden = false
          each(ev.assignment_overrides != null ? ev.assignment_overrides : [], override => {
            if (!overridden) {
              ev.id = `${ev.id}_override_${override.id}`
              return (overridden = true)
            }
          })
          return ev
        }
        break
      case 'sub_assignment':
        // @ts-expect-error
        normalize = function (ev) {
          ev.related_id = ev.id

          let overridden = false
          each(ev.sub_assignment_overrides != null ? ev.sub_assignment_overrides : [], override => {
            if (!overridden) {
              ev.id = `${ev.id}_override_${override.id}`
              return (overridden = true)
            }
          })
          return ev
        }
        break
      case 'event':
        // @ts-expect-error
        normalize = function (ev) {
          ev.related_id = ev.id = `${eventType}_${ev.id}`
          if (ev.parent_event_id) {
            ev.related_id = `${eventType}_${ev.parent_event_id}`
          }
          return ev
        }
        break
    }

    // @ts-expect-error
    const result = []
    // @ts-expect-error
    each(super.parse(...args), ev => {
      // @ts-expect-error
      if (!ev.hidden) result.push(normalize(ev))
    })
    // @ts-expect-error
    return result
  }
}
// @ts-expect-error
SyllabusCalendarEventsCollection.prototype.url = '/api/v1/calendar_events'
