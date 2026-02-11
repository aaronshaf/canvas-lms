/*
 * Copyright (C) 2020 - present Instructure, Inc.
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

import {useScope as createI18nScope} from '@canvas/i18n'
import $ from 'jquery'
import {map, find} from 'es-toolkit/compat'
import {View} from '@canvas/backbone'
import template from '../../jst/section_to_show_menu.handlebars'
import 'jquery-kyle-menu'
import 'jquery-tinypubsub'

const I18n = createI18nScope('gradebookSectionMenuView')

const boundMethodCheck = function (instance: any, Constructor: any): void {
  if (!(instance instanceof Constructor)) {
    throw new Error('Bound instance method accessed before binding')
  }
}

interface Section {
  id?: string
  name: string
  checked?: boolean
}

interface Course {
  name: string
}

interface SectionMenuViewOptions {
  sections: Section[]
  course?: Course
  showSections?: boolean
  disabled?: boolean
  currentSection?: string
}

class SectionMenuView extends View {
  sections: Section[]
  course?: Course
  showSections?: boolean
  disabled?: boolean
  currentSection?: string
  defaultSection: string

  determineDefaultSection(): string {
    let defaultSection: string
    if (this.showSections || !this.course) {
      defaultSection = I18n.t('all_sections', 'All Sections')
    } else {
      defaultSection = this.course.name
    }
    return defaultSection
  }

  constructor(options: SectionMenuViewOptions) {
    super(options)
    this.onSectionChange = this.onSectionChange.bind(this)
    this.defaultSection = this.determineDefaultSection()
    if (this.sections.length > 1) {
      this.sections.unshift({
        name: this.defaultSection,
        checked: !options.currentSection,
      })
    }
    this.updateSections()
  }

  render(): this {
    this.detachEvents()
    super.render()
    this.$('button').prop('disabled', this.disabled).kyleMenu()
    this.attachEvents()
    return this
  }

  detachEvents(): void {
    $.unsubscribe('currentSection/change', this.onSectionChange)
    this.$('.section-select-menu').off('menuselect')
  }

  attachEvents(): void {
    $.subscribe('currentSection/change', this.onSectionChange)
    this.$('.section-select-menu').on('click', function (e) {
      e.preventDefault()
    })
    this.$('.section-select-menu').on('menuselect', (event, ui) => {
      const section =
        this.$('[aria-checked=true] input[name=section_to_show_radio]').val() || undefined
      $.publish('currentSection/change', [section, this.cid])
      this.trigger('menuselect', event, ui, this.currentSection)
    })
  }

  onSectionChange(section: string, _author: string): void {
    boundMethodCheck(this, SectionMenuView)
    this.currentSection = section
    this.updateSections()
    this.render()
  }

  updateSections(): Section[] {
    return map(this.sections, section => {
      section.checked = section.id === this.currentSection
      return section
    })
  }

  toJSON(): {sections: Section[]; showSections?: boolean; currentSection: string} {
    const ref = find(this.sections, {
      id: this.currentSection,
    })
    return {
      sections: this.sections,
      showSections: this.showSections,
      currentSection: ref?.name || this.defaultSection,
    }
  }
}

SectionMenuView.optionProperty('sections')

SectionMenuView.optionProperty('course')

SectionMenuView.optionProperty('showSections')

SectionMenuView.optionProperty('disabled')

SectionMenuView.optionProperty('currentSection')

SectionMenuView.prototype.template = template

export default SectionMenuView
