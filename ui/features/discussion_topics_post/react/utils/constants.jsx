/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

export const AUTO_MARK_AS_READ_DELAY = 3000
export const CURRENT_USER = 'current_user'
export const HIGHLIGHT_TIMEOUT = 6000
export const SEARCH_TERM_DEBOUNCE_DELAY = 500
export const DEFAULT_AVATAR_URL = 'http://canvas.instructure.com/images/messages/avatar-50.png'
export const REPLY_TO_TOPIC = 'reply_to_topic'
export const REPLY_TO_ENTRY = 'reply_to_entry'
export const SUBMITTED = 'submitted'
export const RESUMBITTED = 'resubmitted'
export const MISSING = 'missing'
export const LATE = 'late'

export const AllThreadsState = {
  None: 0,
  Expanded: 1,
  Collapsed: 2,
}

const searchFilter = {
  searchTerm: '',
  setSearchTerm: () => {},
  filter: 'all',
  setFilter: () => {},
  sort: '',
  setSort: () => {},
  pageNumber: 0,
  setPageNumber: () => {},
  allThreadsStatus: AllThreadsState.None,
  setAllThreadsStatus: () => {},
  expandedThreads: [],
  setExpandedThreads: () => {},
  perPage: '',
  discussionID: '',
}
export const SearchContext = React.createContext(searchFilter)

const discussionManagerUtilityContext = {
  replyFromId: '',
  setReplyFromId: () => {},
  userSplitScreenPreference: true,
  setUserSplitScreenPreference: () => {},
  highlightEntryId: '',
  setHighlightEntryId: () => {},
  expandedThreads: '',
  setExpandedThreads: () => {},
  focusSelector: '',
  setFocusSelector: () => {},
  setPageNumber: () => {},
  isGradedDiscussion: false,
  setIsGradedDiscussion: () => {},
  usedThreadingToolbarChildRef: null,
  isSummaryEnabled: false,
}

// use for logic that does not need or expect changes in the same page load
export const isSpeedGraderInTopUrl =
  window.top.location.href?.includes('gradebook/speed_grader') || false

export const DiscussionManagerUtilityContext = React.createContext(discussionManagerUtilityContext)
