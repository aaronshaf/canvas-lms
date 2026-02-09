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

import {Table} from '@instructure/ui-table'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'
import {Tooltip} from '@instructure/ui-tooltip'
import React from 'react'
import {arrayOf, func, shape, string} from 'prop-types'
import {useScope as createI18nScope} from '@canvas/i18n'
import FilterBar from '@canvas/filter-bar'

import DeveloperKey from './DeveloperKey'
import {createSetFocusCallback} from './AdminTable'

import '@canvas/rails-flash-notifications'

const I18n = createI18nScope('react_developer_keys')

const DeveloperKeyUntyped = DeveloperKey as unknown as React.ComponentType<Record<string, unknown>>

type DeveloperKeyData = {
  id: string
  name?: string
  is_lti_key?: boolean
  developer_key_account_binding?: {workflow_state?: string}
}

type DeveloperKeyRowHandle = {
  isDisabled?: () => boolean
  focusToggleGroup?: () => void
}

type InheritedTableProps = {
  store: {dispatch: (action: unknown) => unknown}
  actions: Record<string, unknown>
  developerKeysList: DeveloperKeyData[]
  label: string
  prefix: string
  ctx: unknown
  setFocus?: () => void
  'data-testid'?: string
}

type InheritedTableState = {
  sortBy: string
  sortAscending: boolean
  typeFilter: string
  searchQuery: string
}

type Header = {
  id: string
  text: string
  width: string
  sortable: boolean
  sortText?: string
  sortValue: (key: DeveloperKeyData) => string | number | boolean | undefined
}

class InheritedTable extends React.Component<InheritedTableProps, InheritedTableState> {
  developerKeyRefs: Record<string, DeveloperKeyRowHandle | null> = {}

  constructor(props: InheritedTableProps) {
    super(props)
    this.state = {
      sortBy: `${this.props.prefix}-id`,
      sortAscending: false,
      typeFilter: 'all',
      searchQuery: '',
    }
  }

  headers = (prefix: string): Record<string, Header> => ({
    [`${prefix}-name`]: {
      id: `${prefix}-name`,
      text: I18n.t('Name'),
      width: '45%',
      sortable: true,
      sortText: I18n.t('Sort by Name'),
      sortValue: (key: DeveloperKeyData) => key.name,
    },
    [`${prefix}-id`]: {
      id: `${prefix}-id`,
      text: I18n.t('Id'),
      width: '25%',
      sortable: true,
      sortText: I18n.t('Sort by Client ID'),
      sortValue: (key: DeveloperKeyData) => key.id,
    },
    [`${prefix}-type`]: {
      id: `${prefix}-type`,
      text: I18n.t('Type'),
      width: '15%',
      sortable: true,
      sortText: I18n.t('Sort by Type'),
      sortValue: (key: DeveloperKeyData) => key.is_lti_key,
    },
    [`${prefix}-state`]: {
      id: `${prefix}-state`,
      text: I18n.t('State'),
      width: '15%',
      sortable: true,
      sortText: I18n.t('Sort by State'),
      // inherited keys only have a binding when they are turned On
      sortValue: (key: DeveloperKeyData) =>
        key.developer_key_account_binding?.workflow_state || 'allow',
    },
  })

  onRequestSort = (_: unknown, {id}: {id: string}) => {
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

  sortedDeveloperKeys = () => {
    const {prefix} = this.props
    const headers = this.headers(prefix)
    const {sortBy, sortAscending} = this.state

    const developerKeys = this.filteredDeveloperKeys()
    const sortedKeys = developerKeys.sort((a, b) => {
      const header = headers[sortBy]
      const aVal = header.sortValue(a) ?? ''
      const bVal = header.sortValue(b) ?? ''
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

  filteredDeveloperKeys = () => {
    const {typeFilter, searchQuery} = this.state

    return this.props.developerKeysList.filter((key: DeveloperKeyData) => {
      const keyType = key.is_lti_key ? 'lti' : 'api'
      const typeMatch = typeFilter === 'all' || typeFilter === keyType
      const searchMatch =
        searchQuery === '' ||
        this.checkForMatch(key.name, searchQuery) ||
        this.checkForMatch(key.id, searchQuery)
      return typeMatch && searchMatch
    })
  }

  checkForMatch = (attr: string | undefined, searchQuery: string) => {
    return attr && attr.toLowerCase().includes(searchQuery.toLowerCase())
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
      handleRef: ref => (ref ? ref.focusToggleGroup?.() : this.props.setFocus?.()),
    })

  developerKeyRef = (key: DeveloperKeyData) => {
    return this.developerKeyRefs[`developerKey-${key.id}`] ?? undefined
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
          onFilter={typeFilter => this.setState({typeFilter})}
          onSearch={searchQuery => this.setState({searchQuery})}
          searchPlaceholder={I18n.t('Search by name or ID')}
          searchScreenReaderLabel={I18n.t('Search Developer Keys')}
        />
        <Table
          data-automation="devKeyInheritedTable"
          caption={<ScreenReaderContent>{label}</ScreenReaderContent>}
        >
          <Table.Head renderSortLabel={I18n.t('Sort by')}>{this.renderHeader()}</Table.Head>
          <Table.Body>
            {developerKeys.map(developerKey => (
              <DeveloperKeyUntyped
                ref={(key: DeveloperKeyRowHandle | null) => {
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

// @ts-expect-error TS migration: react class static propTypes not typed.
InheritedTable.propTypes = {
  store: shape({
    dispatch: func.isRequired,
  }).isRequired,
  actions: shape({}).isRequired,
  // @ts-expect-error TS migration: propTypes on imported JS module not typed.
  developerKeysList: arrayOf(DeveloperKey.propTypes.developerKey).isRequired,
  label: string.isRequired,
  prefix: string.isRequired,
  ctx: shape({
    params: shape({
      contextId: string.isRequired,
    }),
  }).isRequired,
  setFocus: func,
}

// @ts-expect-error TS migration: react class static defaultProps not typed.
InheritedTable.defaultProps = {setFocus: () => {}}

export default InheritedTable
