/*
 * Copyright (C) 2017 - present Instructure, Inc.
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
import moment from 'moment'
import type {Moment} from 'moment'
import axios from '@canvas/axios'
import type {CancelTokenSource} from 'axios'
import {useScope as createI18nScope} from '@canvas/i18n'
import * as tz from '@instructure/moment-utils'

import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'
import {Spinner} from '@instructure/ui-spinner'
import CanvasDateInput2 from '@canvas/datetime/react/components/DateInput2'
import {showFlashError} from '@canvas/alerts/react/FlashAlert'

const I18n = createI18nScope('last_attended')

function formatDate(date: Date): string {
  return tz.format(date, 'date.formats.medium_with_weekday') || ''
}

interface StudentLastAttendedProps {
  defaultDate: string | null | undefined
  courseID: string
  studentID: string
}

interface StudentLastAttendedState {
  selectedDate: string | null
  loading: boolean
}

export default class StudentLastAttended extends React.Component<
  StudentLastAttendedProps,
  StudentLastAttendedState
> {
  static defaultProps = {
    defaultDate: null,
  }

  private source!: CancelTokenSource

  constructor(props: StudentLastAttendedProps) {
    super(props)
    const defaultDate = moment(this.props.defaultDate)
    const currentDate = defaultDate.isValid() ? defaultDate.toISOString() : null
    this.state = {
      selectedDate: currentDate,
      loading: false,
    }
  }

  componentDidMount() {
    this.createCancelToken()
  }

  onDateSubmit = (d: Date | null) => {
    if (!d) return
    const currentMoment = moment(d)
    if (moment(this.state.selectedDate).isSame(currentMoment)) return // No change, no need to hit the back end
    this.postDateToBackend(currentMoment.toISOString())
  }

  componentWillUnMount() {
    this.source.cancel()
  }

  // Used to allow us to cancel the axios call when posting date
  createCancelToken() {
    const cancelToken = axios.CancelToken
    this.source = cancelToken.source()
  }

  postDateToBackend(currentDate: string) {
    this.setState({loading: true})
    axios
      .put<{date: string}>(
        `/api/v1/courses/${this.props.courseID}/users/${this.props.studentID}/last_attended`,
        {
          date: currentDate,
          cancelToken: this.source.token,
        },
      )
      .then(r => {
        this.setState({loading: false, selectedDate: r?.data?.date})
      })
      .catch(() => {
        this.setState({loading: false})
        showFlashError(I18n.t('Failed To Change Last Attended Date'))()
      })
  }

  renderTitle() {
    return (
      <View display="block" margin="small 0">
        <Text>{I18n.t('Last day attended')}</Text>
      </View>
    )
  }

  render() {
    if (this.state.loading) {
      return (
        <View display="block" margin="small x-small">
          {this.renderTitle()}
          <View display="block" margin="small">
            <Spinner renderTitle={I18n.t('Loading last attended date')} size="small" />
          </View>
        </View>
      )
    }
    return (
      <View display="block" margin="small x-small" width="222px">
        {this.renderTitle()}
        <CanvasDateInput2
          renderLabel={I18n.t('Set Last Attended Date')}
          onSelectedDateChange={this.onDateSubmit}
          formatDate={formatDate}
          invalidDateMessage={value => I18n.t('%{value} is not a valid date', {value})}
          selectedDate={this.state.selectedDate}
          withRunningValue={true}
          interaction="enabled"
        />
      </View>
    )
  }
}
