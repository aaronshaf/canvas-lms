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

import {useScope as createI18nScope} from '@canvas/i18n'

import Backbone from '@canvas/backbone'
import template from '../../jst/ProgressionModuleView.handlebars'

const I18n = createI18nScope('context_modules')

type ModuleState = 'started' | 'completed' | 'unlocked' | 'locked'

type ItemType =
  | 'ModuleItem'
  | 'File'
  | 'Page'
  | 'Discussion'
  | 'Assignment'
  | 'Quiz'
  | 'ExternalTool'
  | 'Lti::MessageHandler'

type ModuleItem = {
  type: ItemType
  icon_class?: string
}

type ModuleJSON = {
  student_id: string
  state: ModuleState
  status_text: string
  show_items: boolean
  items?: ModuleItem[]
  [key: string]: any
}

export default class ProgressionModuleView extends Backbone.View {
  static tagName = 'li'
  static className = 'progressionModule'
  static template = template

  statuses: Record<ModuleState, string> = {
    started: I18n.t('module_started', 'In Progress'),
    completed: I18n.t('module_complete', 'Complete'),
    unlocked: I18n.t('module_unlocked', 'Unlocked'),
    locked: I18n.t('module_locked', 'Locked'),
  }

  iconClasses: Record<ItemType, string> = {
    ModuleItem: 'icon-module',
    File: 'icon-paperclip',
    Page: 'icon-document',
    Discussion: 'icon-discussion',
    Assignment: 'icon-assignment',
    Quiz: 'icon-quiz',
    ExternalTool: 'icon-link',
    'Lti::MessageHandler': 'icon-link',
  }

  toJSON(): ModuleJSON {
    // @ts-expect-error - Backbone super method doesn't have type definitions
    const json: ModuleJSON = super.toJSON(...arguments)
    json.student_id = this.model.collection.student_id
    json.status_text = this.statuses[json.state]
    json[json.state] = true

    json.show_items = json.state === 'started' && json.items
    if (json.show_items && json.items) {
      for (const item of json.items) {
        item.icon_class = this.iconClasses[item.type] || this.iconClasses.ModuleItem
      }
    }
    return json
  }

  afterRender() {
    // @ts-expect-error - Backbone super method doesn't have type definitions
    super.afterRender(...arguments)
    return this.model.collection.syncHeight()
  }
}

ProgressionModuleView.prototype.tagName = 'li'
ProgressionModuleView.prototype.className = 'progressionModule'
ProgressionModuleView.prototype.template = template
