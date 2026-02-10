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

import React from 'react'
import {shape, func, string, arrayOf} from 'prop-types'
import {useScope as createI18nScope} from '@canvas/i18n'
import {debounce, isEmpty} from 'es-toolkit/compat'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import UsersList from './UsersList'
import UsersToolbar from './UsersToolbar'
import SearchMessage from './SearchMessage'
import SRSearchMessage from './SRSearchMessage'
import UserActions from '../actions/UserActions'

const I18n = createI18nScope('account_course_user_search')

const MIN_SEARCH_LENGTH = 2
export const SEARCH_DEBOUNCE_TIME = 750

type Role = {
  id: string
  label: string
}

type SearchFilter = {
  page?: number | null
  search_term?: string
  include_deleted_users?: boolean
  role_filter_id?: string
  sort?: string
  order?: string
  temporary_enrollment_providers?: boolean
  temporary_enrollment_recipients?: boolean
}

type PaginationLink = {
  url: string
  page: string
}

type CollectionLinks = Partial<Record<'current' | 'next' | 'prev' | 'first' | 'last', PaginationLink>>

type UserListState = {
  links?: CollectionLinks
  accountId: string | number
  users: unknown[]
  isLoading: boolean
  errors: {search_term?: string}
  searchFilter: SearchFilter
  permissions: Record<string, unknown>
}

type StoreState = {
  userList: UserListState
}

type Store = {
  getState: () => StoreState
  dispatch: (action: unknown) => void
  subscribe: (listener: () => void) => () => void
}

type UsersPaneProps = {
  store: Store
  roles: Role[]
  onUpdateQueryParams: (params: SearchFilter) => void
  queryParams: {
    page?: string
    search_term?: string
    include_deleted_users?: string
    role_filter_id?: string
  }
}

type UsersPaneState = {
  userList: UserListState
  srMessageDisplayed: boolean
  sortColumnHeader: HTMLElement | null
  knownLastPage?: string
}

export default class UsersPane extends React.Component<UsersPaneProps, UsersPaneState> {
  static propTypes = {
    store: shape({
      getState: func.isRequired,
      dispatch: func.isRequired,
      subscribe: func.isRequired,
    }).isRequired,
    roles: arrayOf(
      shape({
        id: string.isRequired,
        label: string.isRequired,
      }),
    ).isRequired,
    onUpdateQueryParams: func.isRequired,
    queryParams: shape({
      page: string,
      search_term: string,
      include_deleted_users: string,
      role_filter_id: string,
    }).isRequired,
  }

  private unsubscribe: () => void = () => {}
  private debouncedDispatchApplySearchFilter: (preserveLastPageValue?: boolean) => void

  constructor(props: UsersPaneProps) {
    super(props)

    this.state = {
      userList: props.store.getState().userList,
      srMessageDisplayed: false,
      sortColumnHeader: null,
    }
    this.debouncedDispatchApplySearchFilter = debounce(
      this.handleApplyingSearchFilter,
      SEARCH_DEBOUNCE_TIME,
    ) as unknown as (preserveLastPageValue?: boolean) => void
  }

  componentDidMount() {
    this.unsubscribe = this.props.store.subscribe(this.handleStateChange)

    // make page reflect what the querystring params asked for
    const {search_term, role_filter_id, include_deleted_users} = {
      ...UsersToolbar.defaultProps,
      ...this.props.queryParams,
    }
    const bool_include_deleted_users = include_deleted_users === 'true'
    this.props.store.dispatch(
      UserActions.updateSearchFilter({
        search_term,
        role_filter_id,
        include_deleted_users: bool_include_deleted_users,
      }),
    )

    this.props.store.dispatch(UserActions.applySearchFilter(MIN_SEARCH_LENGTH))
  }

  componentDidUpdate() {
    if (this.state.sortColumnHeader?.id) {
      const sortColumnHeaderButton = document.getElementById(this.state.sortColumnHeader.id)
      sortColumnHeaderButton?.focus()
    }
  }

  componentWillUnmount() {
    this.unsubscribe()
  }

  handleStateChange = () => {
    const userList = this.props.store.getState().userList
    const lastPage = userList?.links?.last?.page
    this.setState(oldState => {
      const newState: Partial<UsersPaneState> = {userList}
      if (lastPage && !oldState.knownLastPage) newState.knownLastPage = lastPage
      return newState
    })
  }

  handleApplyingSearchFilter = (preserveLastPageValue: boolean = false) => {
    this.props.store.dispatch(UserActions.applySearchFilter(MIN_SEARCH_LENGTH))
    this.updateQueryString()
    if (!preserveLastPageValue) this.setState({knownLastPage: undefined})
  }

  handleUpdateSearchFilter = (searchFilter: Partial<SearchFilter>) => {
    this.props.store.dispatch(UserActions.updateSearchFilter({page: null, ...searchFilter}))
    this.debouncedDispatchApplySearchFilter()
  }

  handleSubmitEditUserForm = () => {
    this.handleApplyingSearchFilter()
  }

  handleSetPage = (page: number) => {
    this.props.store.dispatch(UserActions.updateSearchFilter({page}))
    this.handleApplyingSearchFilter(true)
  }

  handleToggleSRMessage = (show: boolean = false) => {
    this.setState({sortColumnHeader: null, srMessageDisplayed: show})
  }

  handleSetSortColumnHeaderRef = (element: HTMLElement | null) => {
    if (element) this.setState({sortColumnHeader: element})
  }

  updateQueryString = () => {
    const searchFilter = this.props.store.getState().userList.searchFilter
    this.props.onUpdateQueryParams(searchFilter)
  }

  render() {
    const {links, accountId, users, isLoading, errors, searchFilter} = this.state.userList
    const includeDeleted =
      this.props.store.getState().userList.searchFilter.include_deleted_users ?? false
    return (
      <div>
        <ScreenReaderContent>
          <h1>{I18n.t('People')}</h1>
        </ScreenReaderContent>

        <UsersToolbar
          onUpdateFilters={this.handleUpdateSearchFilter}
          onApplyFilters={this.handleApplyingSearchFilter}
          errors={errors}
          {...searchFilter}
          accountId={accountId.toString()}
          roles={this.props.roles}
          toggleSRMessage={this.handleToggleSRMessage}
        />

        {!isEmpty(users) && !isLoading && (
          <UsersList
            roles={this.props.roles}
            searchFilter={this.state.userList.searchFilter}
            onUpdateFilters={this.handleUpdateSearchFilter}
            accountId={accountId.toString()}
            users={users}
            handleSubmitEditUserForm={this.handleSubmitEditUserForm}
            permissions={this.state.userList.permissions}
            sortColumnHeaderRef={this.handleSetSortColumnHeaderRef}
            includeDeletedUsers={includeDeleted}
          />
        )}

        <SearchMessage
          collection={{data: users, loading: isLoading, links}}
          setPage={this.handleSetPage}
          knownLastPage={this.state.knownLastPage}
          noneFoundMessage={I18n.t('No users found')}
        />
        {this.state.srMessageDisplayed && (
          <SRSearchMessage collection={{data: users, loading: isLoading, links}} dataType="User" />
        )}
      </div>
    )
  }
}
