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

import React, {Component} from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {useScope as createI18nScope} from '@canvas/i18n'
import select from '@canvas/obj-select'

import {Text} from '@instructure/ui-text'
import {Spinner} from '@instructure/ui-spinner'
import SyncHistoryItem from '@canvas/blueprint-courses/react/components/SyncHistoryItem'

import actions from '@canvas/blueprint-courses/react/actions'
import propTypes from '@canvas/blueprint-courses/react/propTypes'
import LoadStates from '@canvas/blueprint-courses/react/loadStates'

const I18n = createI18nScope('blueprint_settingsSyncHistory')

const {func, bool} = PropTypes

interface Migration {
  id: string
  [key: string]: any
}

interface SyncHistoryProps {
  migrations: Migration[]
  associations: any[]
  isLoadingHistory: boolean
  hasLoadedHistory: boolean
  hasLoadedAssociations: boolean
  isLoadingAssociations: boolean
  loadHistory: () => void
  loadAssociations: () => void
}

export default class SyncHistory extends Component<SyncHistoryProps> {
  static propTypes = {
    migrations: propTypes.migrationList,
    loadHistory: func.isRequired,
    isLoadingHistory: bool.isRequired,
    hasLoadedHistory: bool.isRequired,
    associations: propTypes.courseList,
    loadAssociations: func.isRequired,
    isLoadingAssociations: bool.isRequired,
    hasLoadedAssociations: bool.isRequired,
  }

  static defaultProps = {
    migrations: [],
    associations: [],
  }

  constructor(props: SyncHistoryProps) {
    super(props)
    this.state = {
      associations: this.mapAssociations(props.associations),
    }
  }

  componentDidMount() {
    if (!this.props.hasLoadedHistory) {
      this.props.loadHistory()
    }
    if (!this.props.hasLoadedAssociations) {
      this.props.loadAssociations()
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: SyncHistoryProps) {
    this.setState({
      associations: this.mapAssociations(nextProps.associations),
    })
  }

  mapAssociations(assocs: any[] = []) {
    return assocs.reduce(
      (map, asc) => Object.assign(map, {[asc.id]: asc}),
      {} as Record<string, any>,
    )
  }

  renderLoading() {
    if (this.props.isLoadingHistory || this.props.isLoadingAssociations) {
      const title = I18n.t('Loading Sync History')
      return (
        <div style={{textAlign: 'center'}}>
          <Spinner renderTitle={title} />
          <Text as="p">{title}</Text>
        </div>
      )
    }

    return null
  }

  render() {
    // inject course data into exceptions
    const migrations = this.props.migrations.map((mig: Migration) => {
      mig.changes?.map((change: any) => {
        change.exceptions?.map((ex: any) =>
          Object.assign(ex, (this.state as any).associations[ex.course_id] || {}),
        )
        return change
      })
      return mig
    })

    return (
      <div className="bcs__history">
        {this.renderLoading() ||
          migrations.map((migration: Migration) => (
            // @ts-expect-error - Migration type compatibility
            <SyncHistoryItem key={migration.id} migration={migration} />
          ))}
      </div>
    )
  }
}

const connectState = (state: any) => {
  const selectedChange = state.selectedChangeLog && state.changeLogs[state.selectedChangeLog]
  const historyState = selectedChange
    ? {
        hasLoadedHistory: (LoadStates as any).hasLoaded(selectedChange.status),
        isLoadingHistory: (LoadStates as any).isLoading(selectedChange.status),
        migrations: selectedChange.data ? [selectedChange.data] : [],
      }
    : select(state, ['hasLoadedHistory', 'isLoadingHistory', 'migrations'])

  return Object.assign(
    select(state, [
      'hasLoadedAssociations',
      'isLoadingAssociations',
      ['existingAssociations', 'associations'],
    ]),
    historyState,
  )
}
const connectActions = (dispatch: any) => bindActionCreators(actions, dispatch)
export const ConnectedSyncHistory = connect(connectState, connectActions)(SyncHistory)
