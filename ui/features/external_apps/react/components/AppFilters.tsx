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

/*
 * NOTICE: we need to re-visit our design and implementation with a11y
 * in mind as our anchor tags would be more accessible as buttons
 */
/* eslint-disable jsx-a11y/anchor-is-valid */

import {useScope as createI18nScope} from '@canvas/i18n'
import React from 'react'
import store from '../lib/AppCenterStore'
import $ from 'jquery'
import '@canvas/rails-flash-notifications'
import {IconButton} from '@instructure/ui-buttons'
import {IconSearchLine, IconXLine} from '@instructure/ui-icons'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {TextInput} from '@instructure/ui-text-input'

const I18n = createI18nScope('external_tools')

type AppFiltersState = {
  filter: string
  filterText: string
  disabled: boolean
  readOnly: boolean
}

type AppCenterStore = {
  addChangeListener: (listener: () => void) => void
  removeChangeListener: (listener: () => void) => void
  getState: () => {disabled?: boolean; readOnly?: boolean; filterText?: string; filter?: string}
  setState: (nextState: {filter?: string; filterText?: string}) => void
  filteredApps: () => unknown[]
}

const appCenterStore = store as unknown as AppCenterStore

export default class AppFilters extends React.Component<{}, AppFiltersState> {
  state: AppFiltersState = {filter: 'all', filterText: '', disabled: false, readOnly: false}

  tabAll: HTMLAnchorElement | null = null
  tabNotInstalled: HTMLAnchorElement | null = null
  tabInstalled: HTMLAnchorElement | null = null
  filterText: HTMLInputElement | null = null

  componentDidMount() {
    appCenterStore.addChangeListener(this.onChange)
    this.onChange()
  }

  componentWillUnmount() {
    appCenterStore.removeChangeListener(this.onChange)
  }

  onChange = () => {
    const s = appCenterStore.getState()
    this.setState({
      disabled: !!s.disabled,
      readOnly: !!s.readOnly,
      filterText: s.filterText ?? '',
      filter: s.filter ?? 'all',
    })
  }

  handleFilterClick = (filter: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    appCenterStore.setState({filter})
    this.announceFilterResults()
  }

  applyFilter = (_e: unknown, value: string) => {
    appCenterStore.setState({filterText: value})
    this.announceFilterResults()
  }

  announceFilterResults = () => {
    const apps = appCenterStore.filteredApps()
    $.screenReaderFlashMessageExclusive(I18n.t('%{count} apps found', {count: apps.length}))
  }

  handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    this.applyFilter(null, '')
    this.filterText?.focus()
  }

  interaction = () => {
    if (this.state.disabled) return 'disabled'
    if (this.state.readOnly) return 'readonly'
    return 'enabled'
  }

  renderClearButton = () => {
    if (!this.state.filterText.length) return null

    return (
      <IconButton
        type="button"
        size="small"
        withBackground={false}
        withBorder={false}
        screenReaderLabel="Clear search"
        interaction={this.interaction()}
        onClick={this.handleClear as unknown as (event: unknown) => void}
      >
        <IconXLine />
      </IconButton>
    )
  }

  render() {
    const activeFilter = this.state.filter || 'all'
    return (
      <div className="AppFilters">
        <div className="content-box">
          <div className="grid-row">
            <div className="col-xs-7">
              <ul className="nav nav-pills" role="tablist">
                <li className={activeFilter === 'all' ? 'active' : ''}>
                  <a
                    ref={c => (this.tabAll = c)}
                    onClick={this.handleFilterClick.bind(this, 'all')}
                    href="#"
                    role="tab"
                    aria-selected={activeFilter === 'all' ? 'true' : 'false'}
                  >
                    {I18n.t('All')}
                  </a>
                </li>
                <li className={activeFilter === 'not_installed' ? 'active' : ''}>
                  <a
                    ref={c => (this.tabNotInstalled = c)}
                    onClick={this.handleFilterClick.bind(this, 'not_installed')}
                    href="#"
                    role="tab"
                    aria-selected={activeFilter === 'not_installed' ? 'true' : 'false'}
                  >
                    {I18n.t('Not Installed')}
                  </a>
                </li>
                <li className={activeFilter === 'installed' ? 'active' : ''}>
                  <a
                    ref={c => (this.tabInstalled = c)}
                    onClick={this.handleFilterClick.bind(this, 'installed')}
                    href="#"
                    role="tab"
                    aria-selected={activeFilter === 'installed' ? 'true' : 'false'}
                  >
                    {I18n.t('Installed')}
                  </a>
                </li>
              </ul>
            </div>
            <div className="col-xs-5">
              <TextInput
                renderLabel={<ScreenReaderContent>{I18n.t('Filter by name')}</ScreenReaderContent>}
                interaction={this.interaction()}
                placeholder={I18n.t('Filter by name')}
                value={this.state.filterText}
                onChange={this.applyFilter}
                inputRef={el => (this.filterText = el as unknown as HTMLInputElement | null)}
                renderBeforeInput={<IconSearchLine inline={false} />}
                renderAfterInput={this.renderClearButton()}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
}
