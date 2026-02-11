/*
 * Copyright (C) 2012 - present Instructure, Inc.
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
import EntryView from './backbone/views/EntryView'
import DiscussionFilterState from './backbone/models/DiscussionFilterState'
import DiscussionToolbarView from './backbone/views/DiscussionToolbarView'
import DiscussionFilterResultsView from './backbone/views/DiscussionFilterResultsView'
import MarkAsReadWatcher from './backbone/MarkAsReadWatcher'
import $ from 'jquery'
import Backbone from '@canvas/backbone'
import React from 'react'
import {createRoot} from 'react-dom/client'
import MaterializedDiscussionTopic from './backbone/models/Topic'
import SideCommentDiscussionTopic from './backbone/models/SideCommentDiscussionTopic'
import EntryCollection from './backbone/collections/EntryCollection'
import DiscussionTopicToolbarView from './backbone/views/DiscussionTopicToolbarView'
import TopicView from './backbone/views/TopicView'
import EntriesView from './backbone/views/EntriesView'
import SectionsTooltip from '@canvas/sections-tooltip'
import DiscussionTopicKeyboardShortcutModal from './react/DiscussionTopicKeyboardShortcutModal'
import ready from '@instructure/ready'
import {captureException} from '@sentry/react'

const I18n = createI18nScope('discussions')

// Backbone routes
$('body').on('click', '[data-pushstate]', function (event: any) {
  if (event) event.preventDefault()
  Backbone.history.navigate($(this).attr('href'), true)
})

import('@canvas/rubrics/jquery/rubricEditBinding')
if (ENV.STUDENT_CONTEXT_CARDS_ENABLED)
  import('@canvas/context-cards/react/StudentContextCardTrigger')

if (ENV.MASTER_COURSE_DATA) {
  import('@canvas/blueprint-courses/react/components/LockManager/index').then(
    ({default: LockManager}) => {
      ready(() => {
        const lockManager = new LockManager()
        lockManager.init({itemType: 'discussion_topic', page: 'show'})
      })
    },
  )
}

const descendants = 5
const children = 10

// create the objects ...
const router = new Backbone.Router()

const data = ENV.DISCUSSION?.THREADED
  ? new MaterializedDiscussionTopic({root_url: ENV.DISCUSSION?.ROOT_URL})
  : new SideCommentDiscussionTopic({root_url: ENV.DISCUSSION?.ROOT_URL})

const entries = new EntryCollection(null)

const filterModel = new DiscussionFilterState()

function renderCoursePacingNotice() {
  const $mountPoint = document.getElementById('course_paces_due_date_notice')

  if ($mountPoint) {
    import('@canvas/due-dates/react/CoursePacingNotice')
      .then((CoursePacingNoticeModule: any) => {
        const renderNotice = CoursePacingNoticeModule.renderCoursePacingNotice
        renderNotice($mountPoint, ENV.COURSE_ID)
      })
      .catch((ex: any) => {
        console.error('Falied loading CoursePacingNotice', ex)
        captureException(new Error('Failed loading CoursePacingNotice: ' + ex.message))
      })
  }
}

ready(() => {
  // @ts-expect-error - Backbone constructor
  new DiscussionTopicToolbarView({el: '#discussion-managebar'})

  let keyboardShortcutRoot: any = null
  let sectionTooltipRoot: any = null

  if (!window.ENV.disable_keyboard_shortcuts) {
    const keyboardShortcutModal = document.getElementById('keyboard-shortcut-modal')
    if (keyboardShortcutModal) {
      keyboardShortcutRoot = createRoot(keyboardShortcutModal)
      keyboardShortcutRoot.render(<DiscussionTopicKeyboardShortcutModal />)
    }
  }

  renderCoursePacingNotice()

  // Rendering of the section tooltip
  const container = document.querySelector('#section_tooltip_root')
  const sectionSpecificAnnouncement = ENV.TOTAL_USER_COUNT || ENV.DISCUSSION?.TOPIC?.COURSE_SECTIONS
  if (
    container &&
    sectionSpecificAnnouncement &&
    !ENV.DISCUSSION?.IS_ASSIGNMENT &&
    !ENV.DISCUSSION?.IS_GROUP
  ) {
    sectionTooltipRoot = createRoot(container)
    sectionTooltipRoot.render(
      <SectionsTooltip
        totalUserCount={ENV.TOTAL_USER_COUNT}
        sections={ENV.DISCUSSION?.TOPIC?.COURSE_SECTIONS}
      />,
    )
  }

  // @ts-expect-error - Backbone constructor
  const topicView = new TopicView({
    el: '#main',
    model: new Backbone.Model(),
    filterModel,
  })

  // for cases where users have html id's this page listens for,
  // use this so they do not trigger related code
  const excludeUserContentCss = 'div:not(.user_content)'

  // @ts-expect-error - Backbone constructor
  const entriesView = new EntriesView({
    el: `${excludeUserContentCss} #discussion_subentries`,
    collection: entries,
    descendants,
    children,
    threaded: ENV.DISCUSSION?.THREADED,
    model: filterModel,
  })

  // @ts-expect-error - Backbone constructor
  const toolbarView = new DiscussionToolbarView({
    el: `${excludeUserContentCss} #discussion-toolbar`,
    model: filterModel,
  })

  // @ts-expect-error - Backbone constructor
  const filterView = new DiscussionFilterResultsView({
    el: `${excludeUserContentCss} #filterResults`,
    allData: data,
    model: filterModel,
  })

  const $container = $(window)
  const $subentries = $('#discussion_subentries')

  function scrollToTop() {
    // @ts-expect-error - jQuery scrollTo plugin
    $container.scrollTo($subentries, {offset: -49})
  }

  // connect them ...
  // @ts-expect-error - Backbone model on method
  data.on('change', () => {
    // @ts-expect-error - Backbone model get method
    const entryData = data.get('entries')
    // @ts-expect-error - Collection options
    entries.options.per_page = entryData.length
    // @ts-expect-error - Collection reset method
    return entries.reset(entryData)
  })

  // define function that syncs a discussion entry's
  // read state back to the materialized view data.
  function updateMaterializedViewReadState(id: any, read_state: string) {
    // @ts-expect-error - Dynamic property access
    const e = data.flattened?.[id]
    if (e) e.read_state = read_state
  }

  // propagate mark all read/unread changes to all views
  function setAllReadStateAllViews(newReadState: string) {
    // @ts-expect-error - Collection method
    entries.setAllReadState(newReadState)
    EntryView.setAllReadState(newReadState)
    return filterView.setAllReadState(newReadState)
  }

  // @ts-expect-error - Backbone view on method
  entriesView.on('scrollAwayFromEntry', () => {
    // prevent scroll to top for non-pushstate browsers when hash changes
    const top = $container.scrollTop()
    router.navigate('', {
      trigger: false,
      replace: true,
    })
    $container.scrollTop(top)
  })

  // catch when an EntryView changes the read_state
  // of a discussion entry and update the materialized view.
  EntryView.on('readStateChanged', (entry: any, _view: any) =>
    updateMaterializedViewReadState(entry.get('id'), entry.get('read_state')),
  )

  // catch when auto-mark-as-read watcher changes an entry
  // and update the materialized view to match.
  MarkAsReadWatcher.on('markAsRead', (entry: any) =>
    updateMaterializedViewReadState(entry.get('id'), entry.get('read_state')),
  )

  // detect when read_state changes on filtered model.
  // sync the change to full view collections.
  // @ts-expect-error - Backbone view on method
  filterView.on('readStateChanged', (id: any, read_state: string) =>
    // update on materialized view
    updateMaterializedViewReadState(id, read_state),
  )

  // @ts-expect-error - Backbone view on method
  filterView.on('clickEntry', (entry: any) =>
    router.navigate(`entry-${entry.get('id')}`, true),
  )

  // @ts-expect-error - Backbone view on method
  toolbarView.on('showDeleted', (show: any) => entriesView.showDeleted(show))

  // @ts-expect-error - Backbone view on method
  toolbarView.on('expandAll', () => {
    EntryView.expandRootEntries()
    scrollToTop()
  })

  // @ts-expect-error - Backbone view on method
  toolbarView.on('collapseAll', () => {
    EntryView.collapseRootEntries()
    scrollToTop()
  })

  // @ts-expect-error - Backbone view on method
  topicView.on('markAllAsRead', () => {
    data.markAllAsRead()
    setAllReadStateAllViews('read')
  })

  // @ts-expect-error - Backbone view on method
  topicView.on('markAllAsUnread', () => {
    data.markAllAsUnread()
    setAllReadStateAllViews('unread')
  })

  // @ts-expect-error - Backbone view on method
  filterView.on('render', scrollToTop)

  // @ts-expect-error - Backbone view on method
  filterView.on('hide', scrollToTop)

  // @ts-expect-error - Backbone model on method
  filterModel.on('reset', () => {
    EntryView.expandRootEntries()
  })

  const canReadReplies = () => ENV.DISCUSSION?.PERMISSIONS?.CAN_READ_REPLIES

  // routes
  router.route('topic', 'topic', () => {
    // @ts-expect-error - jQuery offset returns undefined sometimes
    $container.scrollTop($('#discussion_topic'))
    setTimeout(() => {
      $('#discussion_topic .author').focus()
      $container.one('scroll', () => router.navigate(''))
    }, 10)
  })
  router.route('entry-:id', 'id', (entry: any) => {
    // Interval to deffer scrollng until page is fully loaded
    const goToEntry = entriesView.goToEntry.bind(entriesView, entry)
    const goToEntryIntervalId = setInterval(() => {
      if (document.readyState === 'complete') {
        goToEntry()
        clearInterval(goToEntryIntervalId)
      }
    }, 500)
  })
  router.route('page-:page', 'page', (page: any) => {
    entriesView.render(page)
    // TODO: can get a little bouncy when the page isn't as tall as the previous
    scrollToTop()
  })

  function initEntries(initialEntry?: any) {
    if (canReadReplies()) {
      // @ts-expect-error - Backbone model fetch method
      data.fetch({
        success() {
          entriesView.render()
          Backbone.history.start({
            pushState: true,
            root: `${ENV.DISCUSSION?.APP_URL}/`,
          })
          if (initialEntry) {
            // @ts-expect-error - Collection get method
            const fetchedModel = entries.get(initialEntry.id)
            if (fetchedModel) {
              // @ts-expect-error - Collection remove method
              entries.remove(fetchedModel)
            }
            // @ts-expect-error - Collection add method
            entries.add(initialEntry)
            entriesView.render()
            router.navigate(`entry-${initialEntry.get('id')}`, true)
          }
        },
      })

      // @ts-expect-error - Backbone view on method
      topicView.on('addReply', (entry: any) => {
        // @ts-expect-error - Collection add method
        entries.add(entry)
        router.navigate(`entry-${entry.get('id')}`, true)
      })

      if (!ENV.DISCUSSION?.MANUAL_MARK_AS_READ) MarkAsReadWatcher.init()
    } else {
      $('#discussion_subentries span').text(I18n.t('You must log in to view replies'))
    }
  }

  topicView.render()
  // @ts-expect-error - Backbone view render method
  toolbarView.render()

  // Add module sequence footer
  if (ENV.DISCUSSION?.SEQUENCE != null) {
    import('@canvas/module-sequence-footer').then(() => {
      // @ts-expect-error - jQuery plugin
      $('#module_sequence_footer').moduleSequenceFooter({
        assetType: ENV.DISCUSSION?.SEQUENCE?.ASSET_TYPE,
        assetID: ENV.DISCUSSION?.SEQUENCE?.ASSET_ID,
        courseID: ENV.DISCUSSION?.SEQUENCE?.COURSE_ID,
      })
    })
  }

  // Get the party started
  if (ENV.DISCUSSION?.INITIAL_POST_REQUIRED) {
    const once = (entry: any) => {
      initEntries(entry)
      // @ts-expect-error - Backbone view off method
      topicView.off('addReply', once)
    }
    // @ts-expect-error - Backbone view on method
    topicView.on('addReply', once)
  } else {
    initEntries()
  }

  if (ENV.CONDITIONAL_RELEASE_SERVICE_ENABLED) {
    import('@canvas/conditional-release-stats/react/index').then(({default: CyoeStats}) => {
      const graphsRoot = document.getElementById('crs-graphs')
      const detailsParent = document.getElementById('not_right_side')
      CyoeStats.init(graphsRoot, detailsParent)
    })
  }
})
