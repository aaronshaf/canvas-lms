/*
 * Copyright (C) 2016 - present Instructure, Inc.
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

import React from 'react'
import $ from 'jquery'
import {IconButton} from '@instructure/ui-buttons'
import {IconEditLine, IconTrashLine} from '@instructure/ui-icons'
import axios from '@canvas/axios'
import {useScope as createI18nScope} from '@canvas/i18n'
import DateHelper from '@canvas/datetime/dateHelper'
import '@canvas/jquery/jquery.instructure_misc_helpers'
import replaceTags from '@canvas/util/replaceTags'
import {windowConfirm} from '@canvas/util/globalUtils'
import type {GradingPeriod} from './GradingPeriodForm'

const I18n = createI18nScope('AccountGradingPeriod')

interface Permissions {
  read: boolean
  create: boolean
  update: boolean
  delete: boolean
}

interface AccountGradingPeriodProps {
  period: GradingPeriod & {
    id: string
    title: string
    startDate: Date
    endDate: Date
    closeDate: Date
  }
  weighted?: boolean
  onEdit: (period: AccountGradingPeriodProps['period']) => void
  actionsDisabled?: boolean
  readOnly: boolean
  permissions: Permissions
  onDelete: (id: string) => void
  deleteGradingPeriodURL: string
}

export default class AccountGradingPeriod extends React.Component<AccountGradingPeriodProps> {
  // Other components in this feature access these refs off the instance.
  editButtonRef: {current: HTMLElement | null} = {current: null}
  deleteButtonRef: {current: HTMLElement | null} = {current: null}
  weightRef = React.createRef<HTMLSpanElement>()
  titleRef = React.createRef<HTMLSpanElement>()
  startDateRef = React.createRef<HTMLSpanElement>()
  endDateRef = React.createRef<HTMLSpanElement>()
  closeDateRef = React.createRef<HTMLSpanElement>()

  // Instructure UI's onClick uses its own event typing; keep this permissive.
  promptDeleteGradingPeriod = (event: any) => {
    event.stopPropagation()
    const confirmMessage = I18n.t('Are you sure you want to delete this grading period?')
    if (!windowConfirm(confirmMessage)) return
    const url = replaceTags(this.props.deleteGradingPeriodURL, 'id', this.props.period.id)

    axios
      .delete(url)
      .then(() => {
        $.flashMessage(I18n.t('The grading period was deleted'))
        this.props.onDelete(this.props.period.id)
      })
      .catch(() => {
        $.flashError(I18n.t('An error occured while deleting the grading period'))
      })
  }

  onEdit = (e: any) => {
    e.stopPropagation()
    this.props.onEdit(this.props.period)
  }

  renderEditButton() {
    if (this.props.permissions.update && !this.props.readOnly) {
      return (
        <IconButton
          elementRef={el => {
            this.editButtonRef.current = el as HTMLElement | null
          }}
          disabled={this.props.actionsDisabled}
          onClick={this.onEdit}
          withBackground={false}
          withBorder={false}
          title={I18n.t('Edit %{title}', {title: this.props.period.title})}
          screenReaderLabel={I18n.t('Edit %{title}', {title: this.props.period.title})}
        >
          <IconEditLine />
        </IconButton>
      )
    }
  }

  renderDeleteButton() {
    if (this.props.permissions.delete && !this.props.readOnly) {
      return (
        <IconButton
          elementRef={el => {
            this.deleteButtonRef.current = el as HTMLElement | null
          }}
          disabled={this.props.actionsDisabled}
          onClick={this.promptDeleteGradingPeriod}
          withBackground={false}
          withBorder={false}
          title={I18n.t('Delete %{title}', {title: this.props.period.title})}
          screenReaderLabel={I18n.t('Delete %{title}', {title: this.props.period.title})}
        >
          <IconTrashLine />
        </IconButton>
      )
    }
  }

  renderWeight() {
    if (this.props.weighted) {
      const weight =
        typeof this.props.period.weight === 'number' ? this.props.period.weight : undefined
      return (
        <div className="GradingPeriodList__period__attribute col-xs-12 col-md-8 col-lg-2">
          <span ref={this.weightRef}>
            {I18n.t('Weight:')} {weight !== undefined ? I18n.n(weight, {percentage: true}) : ''}
          </span>
        </div>
      )
    }
  }

  render() {
    return (
      <div className="GradingPeriodList__period">
        <div className="GradingPeriodList__period__attributes grid-row">
          <div className="GradingPeriodList__period__attribute col-xs-12 col-md-8 col-lg-4">
            <span ref={this.titleRef}>{this.props.period.title}</span>
          </div>
          <div className="GradingPeriodList__period__attribute col-xs-12 col-md-8 col-lg-2">
            <span ref={this.startDateRef}>
              {I18n.t('Starts:')} {DateHelper.formatDateForDisplay(this.props.period.startDate)}
            </span>
          </div>
          <div className="GradingPeriodList__period__attribute col-xs-12 col-md-8 col-lg-2">
            <span ref={this.endDateRef}>
              {I18n.t('Ends:')} {DateHelper.formatDateForDisplay(this.props.period.endDate)}
            </span>
          </div>
          <div className="GradingPeriodList__period__attribute col-xs-12 col-md-8 col-lg-2">
            <span ref={this.closeDateRef}>
              {I18n.t('Closes:')} {DateHelper.formatDateForDisplay(this.props.period.closeDate)}
            </span>
          </div>
          {this.renderWeight()}
        </div>
        <div className="GradingPeriodList__period__actions">
          {this.renderEditButton()}
          {this.renderDeleteButton()}
        </div>
      </div>
    )
  }
}
