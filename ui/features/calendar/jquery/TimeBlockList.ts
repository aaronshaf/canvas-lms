/*
 * Copyright (C) 2012 - present Instructure, Inc.
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
import {useScope as createI18nScope} from '@canvas/i18n'
import TimeBlockListManager from '@canvas/calendar/TimeBlockListManager'
import TimeBlockRow from './TimeBlockRow'
import '@canvas/jquery/jquery.instructure_forms'
import '@instructure/date-js'
import type moment from 'moment'

const I18n = createI18nScope('calendar')

export default class TimeBlockList {
  element: JQuery
  splitterDiv: JQuery
  blocksManager: TimeBlockListManager
  blankRow: any
  rows: TimeBlockRow[]

  constructor(element: any, splitterSelector: string, blocks: any, blankRow: any) {
    this.element = $(element)
    this.splitterDiv = $(splitterSelector)
    this.blocksManager = new TimeBlockListManager(blocks)
    this.splitterDiv.find('.split-link').click(this.handleSplitClick)
    this.blankRow = blankRow
    this.rows = []

    this.element.on('change', 'input', event => {
      if ($(event.currentTarget).closest('tr').is(':last-child')) this.addRow()
    })
    this.render()
  }

  render(): TimeBlockRow {
    this.rows = []
    this.element.empty()
    this.blocksManager.blocks.forEach(block => this.addRow(block))
    // only default to custom blank values if there's no existing timeblocks
    const blankRow = this.blocksManager.blocks.length === 0 ? this.blankRow : null
    return this.addRow(blankRow) // add a blank row at the bottom
  }

  rowRemoved(rowToRemove: TimeBlockRow): TimeBlockRow | undefined {
    this.rows = this.rows.filter(row => row !== rowToRemove)
    const aNonLockedRowExists = this.rows.some(row => !row.locked)

    if (!aNonLockedRowExists) return this.addRow()
  }

  addRow = (data?: any): TimeBlockRow => {
    const row = new TimeBlockRow(this, data)
    this.element.append(row.$row)
    this.rows.push(row)
    return row
  }

  handleSplitClick = (event: JQuery.Event): void => {
    event.preventDefault()
    const duration = this.splitterDiv.find('[name=duration]').val()
    return this.split(duration)
  }

  split(minutes: string): void {
    const value = parseFloat(minutes)
    if (value > 0 && this.validate()) {
      this.blocksManager.split(value)
      return this.render()
    }
  }

  // weird side-effect: populates the blocksManager
  validate(): boolean {
    let valid = true
    this.blocksManager.reset()
    this.rows.forEach(row => {
      if (row.validate() && !row.incomplete()) {
        if (!row.blank()) {
          this.blocksManager.add.bind(this.blocksManager)(...row.getData())
        }
      } else {
        valid = false
      }
    })

    if (this.blocksManager.blocks.length === 0) {
      window.alert(I18n.t('no_dates_error', 'You need to specify at least one date and time'))
      valid = false
    } else if (!valid) {
      window.alert(I18n.t('time_block_errors', 'There are errors in your time block selections.'))
    }
    return valid
  }

  blocks(): [moment.Moment, moment.Moment][] {
    return this.blocksManager.blocks
      .filter(range => !range.locked)
      .map(range => [range.start, range.end])
  }
}
