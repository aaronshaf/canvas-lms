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

import $ from 'jquery'
import React from 'react'
import {createRoot, type Root} from 'react-dom/client'
import '@canvas/jquery/jquery.ajaxJSON'

import OutcomeGradebookView from '../backbone/views/OutcomeGradebookView'
import GradebookMenu from '@canvas/gradebook-menu'
import Paginator from '@canvas/instui-bindings/react/Paginator'

interface Section {
  id: string
  name: string
}

interface Settings {
  filter_rows_by?: {
    section_id?: string | null
  }
}

interface LearningMasteryOptions {
  sections?: Section[]
  settings?: Settings
  settings_update_url: string
  context_url: string
}

function normalizeSections(options: LearningMasteryOptions): Section[] {
  const sections = options.sections || []
  return sections.sort((a, b) => Number(a.id) - Number(b.id))
}

function currentSectionIdFromSettings(settings?: Settings): string | null {
  return settings?.filter_rows_by?.section_id || null
}

export default class LearningMastery {
  options: LearningMasteryOptions
  paginatorRoot: Root | null = null
  gradebookMenuRoot: Root | null = null
  view: OutcomeGradebookView
  data: {
    currentSectionId: string | null
    sections: Section[]
  }

  constructor(options: LearningMasteryOptions) {
    this.options = options
    this.paginatorRoot = null
    this.gradebookMenuRoot = null

    this.view = new OutcomeGradebookView({
      el: $('.outcome-gradebook'),
      learningMastery: this,
    })

    this.data = {
      currentSectionId: currentSectionIdFromSettings(options.settings),
      sections: normalizeSections(options),
    }
  }

  getSections(): Section[] {
    return this.data.sections
  }

  getCurrentSectionId(): string | null {
    return this.data.currentSectionId
  }

  updateCurrentSectionId(_sectionId: string | null): void {
    // As of this writing, the section filter returns '0' for "All Sections"
    const sectionId = _sectionId === '0' ? null : _sectionId
    const currentSectionId = this.getCurrentSectionId()

    if (currentSectionId !== sectionId) {
      this._setCurrentSectionId(sectionId)
      this.saveSettings()
    }
  }

  renderPagination(page = 0, pageCount = 0): void {
    const loadPage = this.view.loadPage.bind(this.view)
    const container = document.getElementById('outcome-gradebook-paginator')

    if (!container) return

    if (!this.paginatorRoot) {
      this.paginatorRoot = createRoot(container)
    }
    this.paginatorRoot.render(<Paginator page={page} pageCount={pageCount} loadPage={loadPage} />)
  }

  saveSettings(): void {
    const data = {
      gradebook_settings: {
        filter_rows_by: {
          section_id: this.getCurrentSectionId(),
        },
      },
    }

    $.ajaxJSON(this.options.settings_update_url, 'PUT', data)
  }

  start(): void {
    this.view.render()
    this._renderGradebookMenu()
    this.renderPagination()
    this.view.onShow()
  }

  destroy(): void {
    this.view.remove()
    if (this.gradebookMenuRoot) {
      this.gradebookMenuRoot.unmount()
    }
    if (this.paginatorRoot) {
      this.paginatorRoot.unmount()
    }
  }

  // PRIVATE

  _renderGradebookMenu(): void {
    // This only needs to render once.
    const container = document.querySelector('[data-component="GradebookMenu"]')

    if (!container) return

    const props = {
      courseUrl: this.options.context_url,
      learningMasteryEnabled: true,
      variant: 'DefaultGradebookLearningMastery' as const,
    }

    if (!this.gradebookMenuRoot) {
      this.gradebookMenuRoot = createRoot(container)
    }
    this.gradebookMenuRoot.render(<GradebookMenu {...props} />)
  }

  _setCurrentSectionId(sectionId: string | null): void {
    this.data.currentSectionId = sectionId
  }
}
