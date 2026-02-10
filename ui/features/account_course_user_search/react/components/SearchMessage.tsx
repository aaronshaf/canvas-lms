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

import React, {Component} from 'react'
import {Billboard} from '@instructure/ui-billboard'
import {Pagination} from '@instructure/ui-pagination'
import {Spinner} from '@instructure/ui-spinner'
import {array, func, string, shape} from 'prop-types'
import {useScope as createI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import EmptyDesert from '@canvas/images/react/EmptyDesert'

const I18n = createI18nScope('account_course_user_search')

// exported for tests only
export const LAST_PAGE_UNKNOWN_MARKER = '...'

type PaginationLink = {
  url: string
  page: string
}

type CollectionLinks = Partial<Record<'current' | 'next' | 'prev' | 'first' | 'last', PaginationLink>>

type Collection = {
  data: unknown[]
  loading?: boolean
  error?: boolean
  links?: CollectionLinks
}

type SearchMessageProps = {
  collection: Collection
  knownLastPage?: string
  setPage: (page: number) => void
  noneFoundMessage: string
}

type SearchMessageState = {
  pageBecomingCurrent?: number | null
}

const linkPropType = shape({
  url: string.isRequired,
  page: string.isRequired,
}).isRequired

export default class SearchMessage extends Component<SearchMessageProps, SearchMessageState> {
  static propTypes = {
    collection: shape({
      data: array.isRequired,
      links: shape({current: linkPropType}),
    }).isRequired,
    knownLastPage: string,
    setPage: func.isRequired,
    noneFoundMessage: string.isRequired,
  }

  state: SearchMessageState = {}

  UNSAFE_componentWillReceiveProps(nextProps: SearchMessageProps) {
    if (!nextProps.collection.loading) {
      const newState: SearchMessageState = {}
      if (this.state.pageBecomingCurrent) newState.pageBecomingCurrent = null
      this.setState(newState)
    }
  }

  handleSetPage = (page: number) => {
    this.setState({pageBecomingCurrent: page}, () => this.props.setPage(page))
  }

  currentPage(): number {
    const current = this.props.collection.links?.current?.page
    return this.state.pageBecomingCurrent || Number(current || 1)
  }

  isLastPageKnown(): boolean {
    return (
      this.props.knownLastPage || typeof this.props.collection?.links?.last?.page !== 'undefined'
    )
  }

  lastKnownPageNumber(): number {
    if (this.props.knownLastPage) return Number(this.props.knownLastPage)
    const link =
      this.props.collection.links &&
      (this.props.collection.links.last || this.props.collection.links.next)

    if (!link) return 0
    return parseInt(link.page, 10)
  }

  renderPaginationButton(pageIndex: number) {
    const pageNumber = pageIndex + 1
    const locale = ENV?.LOCALE || navigator.language
    const isCurrent = this.state.pageBecomingCurrent
      ? pageNumber === this.state.pageBecomingCurrent
      : pageNumber === this.currentPage()
    return (
      <Pagination.Page
        data-testid="page-button"
        key={pageNumber}
        onClick={() => this.handleSetPage(pageNumber)}
        current={isCurrent}
        aria-label={I18n.t('Page %{pageNum}', {pageNum: pageNumber})}
      >
        {isCurrent && this.state.pageBecomingCurrent ? (
          <Spinner size="x-small" renderTitle={I18n.t('Loading...')} />
        ) : (
          new Intl.NumberFormat(locale).format(pageNumber)
        )}
      </Pagination.Page>
    )
  }

  render() {
    const {collection, noneFoundMessage} = this.props
    const errorLoadingMessage = I18n.t(
      'There was an error with your query; please try a different search',
    )

    if (collection.error) {
      return (
        <div className="text-center pad-box">
          <div className="alert alert-error">{errorLoadingMessage}</div>
        </div>
      )
    } else if (collection.loading) {
      return (
        <View display="block" textAlign="center" padding="medium">
          <Spinner data-testid="loading-spinner" size="medium" renderTitle={I18n.t('Loading...')} />
        </View>
      )
    } else if (!collection.data.length) {
      return (
        <Billboard size="large" heading={noneFoundMessage} headingAs="h2" hero={<EmptyDesert />} />
      )
    } else if (collection.links) {
      const lastPageNumber = this.lastKnownPageNumber()
      const lastIndex = lastPageNumber - 1
      const paginationButtons: Array<React.ReactNode> = Array.from({length: lastPageNumber})
      paginationButtons[0] = this.renderPaginationButton(0)
      if (lastIndex >= 0) paginationButtons[lastIndex] = this.renderPaginationButton(lastIndex)
      const visiblePageRangeStart = Math.max(this.currentPage() - 10, 0)
      const visiblePageRangeEnd = Math.min(this.currentPage() + 10, lastIndex)
      for (let i = visiblePageRangeStart; i < visiblePageRangeEnd; i++) {
        paginationButtons[i] = this.renderPaginationButton(i)
      }

      return (
        <Pagination
          as="nav"
          variant="compact"
          labelNext={I18n.t('Next Page')}
          labelPrev={I18n.t('Previous Page')}
          aria-label="pagination"
        >
          {paginationButtons.concat(
            this.isLastPageKnown() ? (
              []
            ) : (
              <Pagination.Page
                data-testid="page-button"
                key="last-page-unknown"
                disabled={true}
                aria-hidden={true}
              >
                {LAST_PAGE_UNKNOWN_MARKER}
              </Pagination.Page>
            ),
          )}
        </Pagination>
      )
    } else {
      return <div />
    }
  }
}
