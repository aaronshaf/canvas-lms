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

import {useScope as createI18nScope} from '@canvas/i18n'
import React from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import {Button} from '@instructure/ui-buttons'
import {Grid} from '@instructure/ui-grid'
import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'
import {Spinner} from '@instructure/ui-spinner'
import {IconXLine} from '@instructure/ui-icons'

import actions from '../actions'
import type {RssFeed} from '../propTypes'
import select from '@canvas/obj-select'

import {Link} from '@instructure/ui-link'

const I18n = createI18nScope('announcements_v2')

interface RSSFeedListOwnProps {
  focusLastElement: () => void
}

interface RSSFeedListStateProps {
  feeds: RssFeed[]
  hasLoadedFeed: boolean
}

interface RSSFeedListDispatchProps {
  getExternalFeeds: () => void
  deleteExternalFeed: (payload: {feedId: string}) => void
}

type RSSFeedListProps = RSSFeedListOwnProps & RSSFeedListStateProps & RSSFeedListDispatchProps

export default class RSSFeedList extends React.Component<RSSFeedListProps> {
  componentDidMount() {
    if (!this.props.hasLoadedFeed) {
      this.props.getExternalFeeds()
    }
  }

  deleteExternalFeed = (id: string, index: number) => {
    this.props.deleteExternalFeed({feedId: id})
    const previousIndex = index - 1
    const elFocus = index
      ? () => {
          const element = document.getElementById(`feed-row-${previousIndex}`)
          if (element) element.focus()
        }
      : this.props.focusLastElement

    setTimeout(() => {
      elFocus()
    }, 200)
  }

  renderPostAddedText(numberOfPosts: number) {
    return I18n.t(
      {
        zero: '%{count} posts added',
        one: '%{count} post added',
        other: '%{count} posts added',
      },
      {count: numberOfPosts},
    )
  }

  renderFeedRow(feed: RssFeed, index: number) {
    const {display_name, id, external_feed_entries_count = 0, url} = feed
    return (
      <div
        key={id}
        className="announcements-tray-feed-row"
        data-testid="announcements-tray-feed-row"
      >
        <View margin="small 0" display="block">
          <Grid
            startAt="medium"
            vAlign="middle"
            colSpacing="small"
            hAlign="space-around"
            rowSpacing="small"
          >
            <Grid.Row>
              <Grid.Col>
                <Link
                  margin="0 small"
                  size="small"
                  href={url}
                  isWithinText={false}
                  themeOverride={{smallPadding: '0', smallHeight: '1rem'}}
                >
                  {display_name}
                </Link>
                <Text size="small" margin="0 small" color="secondary">
                  {this.renderPostAddedText(external_feed_entries_count)}
                </Text>
              </Grid.Col>
              <Grid.Col width="auto">
                <Button
                  id={`feed-row-${index}`}
                  className="external-rss-feed__delete-button"
                  data-testid={`delete-rss-feed-${id}`}
                  renderIcon={
                    <IconXLine title={I18n.t('Delete %{feedName}', {feedName: display_name})} />
                  }
                  onClick={() => this.deleteExternalFeed(id, index)}
                  size="small"
                />
              </Grid.Col>
            </Grid.Row>
          </Grid>
        </View>
      </div>
    )
  }

  render() {
    if (!this.props.hasLoadedFeed) {
      return (
        <div style={{textAlign: 'center'}} data-testid="rss-feed-list">
          <Spinner size="small" renderTitle={I18n.t('Adding RSS Feed')} />
        </div>
      )
    } else {
      return (
        <View
          id="external_rss_feed__rss-list"
          display="block"
          textAlign="start"
          data-testid="rss-feed-list"
        >
          {this.props.feeds.map((feed, index) => this.renderFeedRow(feed, index))}
          <div className="announcements-tray-row" />
        </View>
      )
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connectState = (state: any): RSSFeedListStateProps => ({
  feeds: state.externalRssFeed.feeds,
  hasLoadedFeed: state.externalRssFeed.hasLoadedFeed,
})
const connectActions = (dispatch: any): RSSFeedListDispatchProps =>
  bindActionCreators(
    Object.assign(select(actions, ['getExternalFeeds', 'deleteExternalFeed'])),
    dispatch,
  )
export const ConnectedRSSFeedList = connect(connectState, connectActions)(RSSFeedList)
