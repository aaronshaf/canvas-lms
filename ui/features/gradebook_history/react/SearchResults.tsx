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

import React, {Component, ReactNode} from 'react'
import {connect} from 'react-redux'
import $ from 'jquery'
import {useScope as createI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Text} from '@instructure/ui-text'
import {Spinner} from '@instructure/ui-spinner'
import {Table} from '@instructure/ui-table'
import {getHistoryNextPage} from './actions/SearchResultsActions'
import SearchResultsRow from './SearchResultsRow'

const I18n = createI18nScope('gradebook_history')

const colHeaders: Array<string | ReactNode> = [
  I18n.t('Date'),
  <ScreenReaderContent key="anonymous-grading">{I18n.t('Anonymous Grading')}</ScreenReaderContent>,
  I18n.t('Student'),
  I18n.t('Grader'),
  I18n.t('Artifact'),
  I18n.t('Before'),
  I18n.t('After'),
  I18n.t('Current'),
]

const nearPageBottom = () =>
  document.body.clientHeight - (window.innerHeight + window.scrollY) < 100

interface HistoryItemAssignment {
  name: string
  muted: boolean
  subAssignmentTag?: string
  anonymousGrading?: boolean
}

interface HistoryItem {
  assignment?: HistoryItemAssignment
  courseOverrideGrade?: boolean
  date: string
  displayAsPoints: boolean
  gradedAnonymously: boolean
  grader: string
  gradeAfter: string
  gradeBefore: string
  gradeCurrent: string
  id: string
  pointsPossibleAfter: string
  pointsPossibleBefore: string
  pointsPossibleCurrent: string
  student: string
}

interface SearchResultsComponentProps {
  getNextPage: (url: string) => void
  fetchHistoryStatus: string
  caption: ReactNode
  historyItems: HistoryItem[]
  nextPage: string
  requestingResults: boolean
}

class SearchResultsComponent extends Component<SearchResultsComponentProps> {
  componentDidMount() {
    this.attachListeners()
  }

  componentDidUpdate(prevProps: SearchResultsComponentProps) {
    // if the page doesn't have a scrollbar, scroll event listener can't be triggered
    if (document.body.clientHeight <= window.innerHeight) {
      this.getNextPage()
    }

    if (prevProps.historyItems.length < this.props.historyItems.length) {
      $.screenReaderFlashMessage(I18n.t('More results were added at the bottom of the page.'))
    }

    this.attachListeners()
  }

  componentWillUnmount() {
    this.detachListeners()
  }

  getNextPage = () => {
    if (!this.props.requestingResults && this.props.nextPage && nearPageBottom()) {
      this.props.getNextPage(this.props.nextPage)
      this.detachListeners()
    }
  }

  attachListeners = () => {
    if (this.props.requestingResults || !this.props.nextPage) {
      return
    }

    document.addEventListener('scroll', this.getNextPage)
    window.addEventListener('resize', this.getNextPage)
  }

  detachListeners = () => {
    document.removeEventListener('scroll', this.getNextPage)
    window.removeEventListener('resize', this.getNextPage)
  }

  hasHistory() {
    return this.props.historyItems.length > 0
  }

  noResultsFound() {
    return this.props.fetchHistoryStatus === 'success' && !this.hasHistory()
  }

  showResults = () => (
    <div>
      <Table caption={this.props.caption}>
        <Table.Head>
          <Table.Row>
            {colHeaders.map((header, index) => (
              <Table.ColHeader key={`column-${index}`} id={`column-${index}`}>
                {header}
              </Table.ColHeader>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {this.props.historyItems.map(item => (
            <SearchResultsRow key={`history-items-${item.id}`} item={item} />
          ))}
        </Table.Body>
      </Table>
    </div>
  )

  showStatus = () => {
    if (this.props.requestingResults) {
      $.screenReaderFlashMessage(I18n.t('Loading more gradebook history results.'))

      return <Spinner size="small" renderTitle={I18n.t('Loading Results')} />
    }

    if (this.noResultsFound()) {
      return <Text>{I18n.t('No results found.')}</Text>
    }

    if (!this.props.requestingResults && !this.props.nextPage && this.hasHistory()) {
      return <Text>{I18n.t('No more results to load.')}</Text>
    }

    return null
  }

  render() {
    return (
      <div>
        {this.hasHistory() && this.showResults()}
        <View as="div" textAlign="center" margin="medium 0 0 0">
          {this.showStatus()}
        </View>
      </div>
    )
  }
}

interface RootState {
  history: {
    fetchHistoryStatus?: string
    items?: HistoryItem[]
    nextPage?: string
    loading?: boolean
  }
}

const mapStateToProps = (state: RootState) => ({
  fetchHistoryStatus: state.history.fetchHistoryStatus || '',
  historyItems: state.history.items || [],
  nextPage: state.history.nextPage || '',
  requestingResults: state.history.loading || false,
})

const mapDispatchToProps = (dispatch: any) => ({
  getNextPage: (url: string) => {
    dispatch(getHistoryNextPage(url))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(SearchResultsComponent)

export {SearchResultsComponent}
