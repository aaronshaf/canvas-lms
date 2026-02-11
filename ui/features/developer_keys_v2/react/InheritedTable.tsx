/*
 * Copyright (C) 2018 - present Instructure, Inc.
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

// @ts-expect-error
import {Table} from '@instructure/ui-table'
// @ts-expect-error
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
// @ts-expect-error
import {View} from '@instructure/ui-view'
// @ts-expect-error
import {Text} from '@instructure/ui-text'
// @ts-expect-error
import {Tooltip} from '@instructure/ui-tooltip'
import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import FilterBar from '@canvas/filter-bar'

import DeveloperKey from './DeveloperKey'
import {createSetFocusCallback} from './AdminTable'
import type {DeveloperKey as DeveloperKeyType, DeveloperKeyStore, DeveloperKeyActions, DeveloperKeyContext} from './types'

import '@canvas/rails-flash-notifications'

const I18n = createI18nScope('react_developer_keys')

interface HeaderConfig {
  id: string
  text: string
  width: string
  sortable: boolean
  sortText: string
  sortValue: (key: DeveloperKeyType) => any
}

interface InheritedTableProps {
  store: DeveloperKeyStore
  actions: DeveloperKeyActions
  developerKeysList: DeveloperKeyType[]
  label: string
  prefix: string
  ctx: DeveloperKeyContext
  setFocus?: () => void
}

interface InheritedTableState {
  sortBy: string
  sortAscending: boolean
  typeFilter: string
  searchQuery: string
}

class InheritedTable extends React.Component<InheritedTableProps, InheritedTableState> {
  static defaultProps = {setFocus: () => {}}

  private developerKeyRefs: Record<string, DeveloperKey | null> = {}

  constructor(props: InheritedTableProps) {
    super(props)
    this.state = {
      sortBy: `${this.props.prefix}-id`,
      sortAscending: false,
      typeFilter: 'all',
      searchQuery: '',
    }
  }

  headers = (prefix: string): Record<string, HeaderConfig> => ({
    [`${prefix}-name`]: {
      id: `${prefix}-name`,
      text: I18n.t('Name'),
      width: '45%',
      sortable: true,
      sortText: I18n.t('Sort by Name'),
      sortValue: key => key.name,
    },
    [`${prefix}-id`]: {
      id: `${prefix}-id`,
      text: I18n.t('Id'),
      width: '25%',
      sortable: true,
      sortText: I18n.t('Sort by Client ID'),
      sortValue: key => key.id,
    },
    [`${prefix}-type`]: {
      id: `${prefix}-type`,
      text: I18n.t('Type'),
      width: '15%',
      sortable: true,
      sortText: I18n.t('Sort by Type'),
      sortValue: key => key.is_lti_key,
    },
    [`${prefix}-state`]: {
      id: `${prefix}-state`,
      text: I18n.t('State'),
      width: '15%',
      sortable: true,
      sortText: I18n.t('Sort by State'),
      // inherited keys only have a binding when they are turned On
      sortValue: key => key.developer_key_account_binding?.workflow_state || 'allow',
    },
  })

  onRequestSort = (_: any, {id}: {id: string}) => {
    const {sortBy, sortAscending} = this.state

    if (id === sortBy) {
      this.setState({
        sortAscending: !sortAscending,
      })
    } else {
      this.setState({
        sortBy: id,
        sortAscending: true,
      })
    }
  }

  renderHeader = () => {
    const {prefix} = this.props
    const {sortBy, sortAscending} = this.state
    const direction = sortAscending ? 'ascending' : 'descending'

    return (
      <Table.Row>
        {Object.values(this.headers(prefix)).map(header => (
          <Table.ColHeader
            key={header.id}
            id={header.id}
            width={header.width}
            {...(header.sortable && {
              sortDirection: sortBy === header.id ? direction : 'none',
              onRequestSort: this.onRequestSort,
            })}
          >
            {header.sortText ? (
              <Tooltip renderTip={header.sortText} placement="top">
                {header.text}
              </Tooltip>
            ) : (
              header.text
            )}
          </Table.ColHeader>
        ))}
      </Table.Row>
    )
  }

  sortedDeveloperKeys = (): DeveloperKeyType[] => {
    const {prefix} = this.props
    const headers = this.headers(prefix)
    const {sortBy, sortAscending} = this.state

    const developerKeys = this.filteredDeveloperKeys()
    const sortedKeys = developerKeys.sort((a, b) => {
      const aVal = headers[sortBy].sortValue(a)
      const bVal = headers[sortBy].sortValue(b)
      if (aVal < bVal) {
        return sortAscending ? -1 : 1
      }
      if (aVal > bVal) {
        return sortAscending ? 1 : -1
      }
      return 0
    })
    return sortedKeys
  }

  filteredDeveloperKeys = (): DeveloperKeyType[] => {
    const {typeFilter, searchQuery} = this.state

    return this.props.developerKeysList.filter(key => {
      const keyType = key.is_lti_key ? 'lti' : 'api'
      const typeMatch = typeFilter === 'all' || typeFilter === keyType
      const searchMatch =
        searchQuery === '' ||
        this.checkForMatch(key.name, searchQuery) ||
        this.checkForMatch(key.id, searchQuery)
      return typeMatch && searchMatch
    })
  }

  checkForMatch = (attr: string | undefined, searchQuery: string): boolean => {
    return !!(attr && attr.toLowerCase().includes(searchQuery.toLowerCase()))
  }

  // this should be called when more keys are loaded,
  // and only handles the screenreader callout and focus
  setFocusCallback = () =>
    createSetFocusCallback({
      developerKeysList: this.sortedDeveloperKeys(),
      developerKeyRef: this.developerKeyRef,
      srMsg: I18n.t(
        'Loaded more developer keys. Focus moved to the last enabled developer key in the list.',
      ),
      handleRef: (ref: DeveloperKey | undefined) => (ref ? ref.focusToggleGroup() : this.props.setFocus!()),
    })

  developerKeyRef = (key: DeveloperKeyType): DeveloperKey | null => {
    return this.developerKeyRefs[`developerKey-${key.id}`] || null
  }

  render() {
    const {label} = this.props
    const developerKeys = this.sortedDeveloperKeys()
    return (
      <div>
        <FilterBar
          filterOptions={[
            {value: 'lti', text: I18n.t('LTI Keys')},
            {value: 'api', text: I18n.t('API Keys')},
          ]}
          onFilter={(typeFilter: string) => this.setState({typeFilter})}
          onSearch={(searchQuery: string) => this.setState({searchQuery})}
          searchPlaceholder={I18n.t('Search by name or ID')}
          searchScreenReaderLabel={I18n.t('Search Developer Keys')}
        />
        <Table
          data-automation="devKeyInheritedTable"
          caption={<ScreenReaderContent>{label}</ScreenReaderContent>}
          size="medium"
        >
          <Table.Head renderSortLabel={I18n.t('Sort by')}>{this.renderHeader()}</Table.Head>
          <Table.Body>
            {developerKeys.map(developerKey => (
              <DeveloperKey
                ref={(key: DeveloperKey | null) => {
                  this.developerKeyRefs[`developerKey-${developerKey.id}`] = key
                }}
                key={developerKey.id}
                developerKey={developerKey}
                store={this.props.store}
                actions={this.props.actions}
                ctx={this.props.ctx}
                inherited={true}
                // inherited keys can't be deleted
                onDelete={() => {}}
              />
            ))}
          </Table.Body>
        </Table>
        {developerKeys.length === 0 && (
          <View as="div" margin="medium" textAlign="center">
            <Text size="large">{I18n.t('Nothing here yet')}</Text>
          </View>
        )}
      </div>
    )
  }
}

export default InheritedTable
