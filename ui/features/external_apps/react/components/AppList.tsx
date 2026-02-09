/*
 * Copyright (C) 2014 - present Instructure, Inc.
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
import React from 'react'
import PropTypes from 'prop-types'
import store from '../lib/AppCenterStore'
import page from 'page'
import extStore from '../lib/ExternalAppsStore'
import AppTile from './AppTile'
import Header from './Header'
import AppFilters from './AppFilters'
import ManageAppListButton from './ManageAppListButton'
import splitAssetString from '@canvas/util/splitAssetString'
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'
import {Spinner} from '@instructure/ui-spinner'
import {type GlobalEnv} from '@canvas/global/env/GlobalEnv'

const I18n = createI18nScope('external_tools')

declare const ENV: GlobalEnv & {
  context_asset_string: string
  APP_CENTER?: {
    can_set_token?: boolean
  }
}

type AppListProps = {
  baseUrl: string
}

type AppCenterApp = {
  is_installed: boolean
  id: number
  short_name: string
  name: string
  banner_image_url: string
  short_description: string
}

type AppCenterStore = {
  getState: () => Record<string, unknown> & {isLoading?: boolean}
  addChangeListener: (listener: () => void) => void
  removeChangeListener: (listener: () => void) => void
  fetch: (...args: unknown[]) => unknown
  reset: (...args: unknown[]) => unknown
  filteredApps: () => AppCenterApp[]
}

const appCenterStore = store as unknown as AppCenterStore

export default class AppList extends React.Component<
  AppListProps,
  ReturnType<AppCenterStore['getState']>
> {
  static propTypes = {
    baseUrl: PropTypes.string.isRequired,
  }

  state = appCenterStore.getState()

  loadingIndicatorNode: HTMLDivElement | null = null
  appFilters: InstanceType<typeof AppFilters> | null = null

  onChange = () => {
    this.setState(appCenterStore.getState())
  }

  componentDidMount() {
    appCenterStore.addChangeListener(this.onChange)
    appCenterStore.fetch()
  }

  componentWillUnmount() {
    appCenterStore.removeChangeListener(this.onChange)
  }

  refreshAppList = () => {
    appCenterStore.reset()
    appCenterStore.fetch()
  }

  isAccountContext() {
    return splitAssetString(ENV.context_asset_string, false)?.[0] === 'account'
  }

  manageAppListButton = () => {
    if (this.isAccountContext() && ENV.APP_CENTER?.can_set_token) {
      return (
        <ManageAppListButton
          onUpdateAccessToken={this.refreshAppList}
          extAppStore={
            extStore as unknown as {
              updateAccessToken: (
                contextBaseUrl: string,
                accessToken: string | undefined,
                success: () => void,
                error: () => void,
              ) => void
            }
          }
        />
      )
    } else {
      return null
    }
  }

  viewConfigurationsButton = () => (
    <View>
      <Button
        margin="none x-small"
        onClick={() => {
          page.redirect('/configurations')
        }}
      >
        {I18n.t('View App Configurations')}
      </Button>
    </View>
  )

  apps = () => {
    if (appCenterStore.getState().isLoading) {
      return (
        <div ref={this.loadingIndicator} className="loadingIndicator" data-testid="spinner">
          <View padding="x-small" textAlign="center" as="div" display="block">
            <Spinner delay={300} size="x-small" renderTitle={() => I18n.t('Loading')} />
          </View>
        </div>
      )
    } else {
      return appCenterStore
        .filteredApps()
        .map(app => <AppTile key={app.id} app={app} baseUrl={this.props.baseUrl} />)
    }
  }

  loadingIndicator = (node: HTMLDivElement | null) => {
    this.loadingIndicatorNode = node
  }

  setAppFiltersRef = (node: InstanceType<typeof AppFilters> | null) => {
    this.appFilters = node
  }

  render() {
    return (
      <div className="AppList">
        <Header>
          {this.manageAppListButton()}
          {this.viewConfigurationsButton()}
        </Header>
        <AppFilters ref={this.setAppFiltersRef} />
        <div className="app_center">
          <div className="app_list">
            <div className="collectionViewItems clearfix">{this.apps()}</div>
          </div>
        </div>
      </div>
    )
  }
}
