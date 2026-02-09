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

import {useScope as createI18nScope} from '@canvas/i18n'
import React, {Component} from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import select from '@canvas/obj-select'
import cx from 'classnames'
import '@canvas/rails-flash-notifications'

import {Text} from '@instructure/ui-text'
import {ProgressBar} from '@instructure/ui-progress'
import {Button} from '@instructure/ui-buttons'
import {IconRefreshLine} from '@instructure/ui-icons'

import MigrationStates from '@canvas/blueprint-courses/react/migrationStates'
import propTypes from '@canvas/blueprint-courses/react/propTypes'
import actions from '@canvas/blueprint-courses/react/actions'

const I18n = createI18nScope('blueprint_settingsMigrationSync')

export default class MigrationSync extends Component {
  static propTypes = {
    id: PropTypes.string,
    migrationStatus: propTypes.migrationState.isRequired,
    hasCheckedMigration: PropTypes.bool.isRequired,
    isLoadingBeginMigration: PropTypes.bool.isRequired,
    checkMigration: PropTypes.func.isRequired,
    beginMigration: PropTypes.func.isRequired,
    stopMigrationStatusPoll: PropTypes.func.isRequired,
    showProgress: PropTypes.bool,
    willSendNotification: PropTypes.bool,
    onClick: PropTypes.func,
  }

  static defaultProps = {
    id: 'migration_sync',
    showProgress: true,
    willSendNotification: false,
    onClick: null,
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  constructor(props) {
    super(props)
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.intId = null
  }

  UNSAFE_componentWillMount() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (!this.props.hasCheckedMigration) {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.props.checkMigration(true)
    }
  }

  componentWillUnmount() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.props.stopMigrationStatusPoll()
  }

  handleSyncClick = () => {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.props.beginMigration()
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.props.onClick) {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.props.onClick()
    }
  }

  render() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const {migrationStatus} = this.props
    const isSyncing =
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      MigrationStates.isLoadingState(migrationStatus) || this.props.isLoadingBeginMigration
    const iconClasses = cx({
      'bcs__sync-btn-icon': true,
      'bcs__sync-btn-icon__active': isSyncing,
    })
    return (
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      <div id={this.props.id} className="bcs__migration-sync">
        {
          // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
          this.props.showProgress && isSyncing && (
            <div className="bcs__migration-sync__loading">
              <Text as="p">{I18n.t('Processing')}</Text>
              <Text as="p" size="small">
                {I18n.t('This may take a bit...')}
              </Text>
              <ProgressBar
                screenReaderLabel={I18n.t('Sync in progress')}
                // @ts-expect-error TS2769 -- TypeScriptify (no 'any')
                renderLabel={I18n.t('Sync in progress')}
                size="x-small"
                // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                valueNow={MigrationStates.getLoadingValue(migrationStatus)}
                // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                valueMax={MigrationStates.maxLoadingValue}
              />
              {
                // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                this.props.willSendNotification && (
                  <Text as="p" size="small">
                    {I18n.t(
                      'You can leave the page and you will get a notification when the sync process is complete.',
                    )}
                  </Text>
                )
              }
            </div>
          )
        }
        <div className="bcs__migration-sync__button">
          <Button
            color="primary"
            onClick={this.handleSyncClick}
            ref={c => {
              // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
              this.syncBtn = c
            }}
            disabled={isSyncing}
          >
            <span className={iconClasses}>
              <Text size="large">
                <IconRefreshLine />
              </Text>
            </span>
            <span className="bcs__sync-btn-text">
              {isSyncing ? I18n.t('Syncing...') : I18n.t('Sync')}
            </span>
          </Button>
        </div>
      </div>
    )
  }
}

// @ts-expect-error TS7006 -- TypeScriptify (no 'any')
const connectState = state =>
  select(state, [
    'migrationStatus',
    'isLoadingBeginMigration',
    'hasCheckedMigration',
    'willSendNotification',
  ])
// @ts-expect-error TS7006 -- TypeScriptify (no 'any')
const connectActions = dispatch => bindActionCreators(actions, dispatch)
export const ConnectedMigrationSync = connect(connectState, connectActions)(MigrationSync)
