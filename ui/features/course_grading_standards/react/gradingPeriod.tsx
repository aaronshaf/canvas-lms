/*
 * Copyright (C) 2015 - present Instructure, Inc.
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

import * as tz from '@instructure/moment-utils'
import React from 'react'
import $ from 'jquery'
import GradingPeriodTemplate from './gradingPeriodTemplate'
import DateHelper from '@canvas/datetime/dateHelper'
import {isMidnight} from '@instructure/moment-utils'

interface Permissions {
  update: boolean
  delete: boolean
}

interface Props {
  title: string
  weight?: number | null
  weighted?: boolean
  startDate: Date
  endDate: Date
  closeDate: Date
  id: string
  updateGradingPeriodCollection: (gradingPeriod: GradingPeriod) => void
  onDeleteGradingPeriod: (id: string) => void
  disabled: boolean
  readOnly: boolean
  permissions: Permissions
}

interface State {
  title: string
  startDate: Date
  endDate: Date
  weight: number | null
}

class GradingPeriod extends React.Component<Props, State> {
  private templateRef: GradingPeriodTemplate | null = null

  static defaultProps = {
    weight: null,
  }

  state: State = {
    title: this.props.title,
    startDate: this.props.startDate,
    endDate: this.props.endDate,
    weight: this.props.weight ?? null,
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    this.setState({
      title: nextProps.title,
      startDate: nextProps.startDate,
      endDate: nextProps.endDate,
      weight: nextProps.weight ?? null,
    })
  }

  onTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({title: event.target.value}, function (this: GradingPeriod) {
      this.props.updateGradingPeriodCollection(this)
    })
  }

  onDateChange = (dateType: string, id: string) => {
    const $date = $(`#${id}`)
    const isValidDate = !($date.data('invalid') || $date.data('blank'))
    let updatedDate = isValidDate ? $date.data('unfudged-date') : new Date('invalid date')

    if (dateType === 'endDate' && isMidnight(updatedDate)) {
      updatedDate = tz.changeToTheSecondBeforeMidnight(updatedDate)
    }

    const updatedState: Partial<State> = {}
    updatedState[dateType as keyof State] = updatedDate
    this.setState(updatedState as State, function (this: GradingPeriod) {
      this.replaceInputWithDate(dateType, $date)
      this.props.updateGradingPeriodCollection(this)
    })
  }

  replaceInputWithDate = (dateType: string, dateElement: JQuery) => {
    const date = this.state[dateType as keyof State]
    if (date instanceof Date) {
      dateElement.val(DateHelper.formatDatetimeForDisplay(date))
    }
  }

  render() {
    return (
      <GradingPeriodTemplate
        data-testid="grading-period"
        key={this.props.id}
        ref={c => (this.templateRef = c)}
        id={this.props.id}
        title={this.props.title}
        weight={this.props.weight}
        weighted={this.props.weighted}
        startDate={this.props.startDate}
        endDate={this.props.endDate}
        closeDate={this.props.closeDate || this.props.endDate}
        permissions={this.props.permissions}
        disabled={this.props.disabled}
        readOnly={this.props.readOnly}
        onDeleteGradingPeriod={this.props.onDeleteGradingPeriod}
        onDateChange={this.onDateChange}
        onTitleChange={this.onTitleChange}
      />
    )
  }
}

export default GradingPeriod
