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
import {createActions} from 'redux-actions'
import $ from 'jquery'

import * as apiClient from './apiClient'
import {createPaginationActions} from '@canvas/pagination/redux/actions'

const I18n = createI18nScope('discussions_v2')

interface Discussion {
  id: string
  title: string
  pinned?: boolean
  subscribed?: boolean
  subscription_hold?: string
  permissions?: {
    delete?: boolean
  }
  focusOn?: string
  filtered?: boolean
  [key: string]: any
}

interface State {
  allDiscussions: {[id: string]: Discussion}
  pinnedDiscussionIds: string[]
  unpinnedDiscussionIds: string[]
  closedForCommentsDiscussionIds: string[]
  userSettings: any
  contextType: string
  contextId: string
  currentUserId: string
  [key: string]: any
}

type GetState = () => State
type Dispatch = (action: any) => void

const getDiscussionOpts = {
  fetchAll: true,
  totalCount: ENV.totalDiscussions,
  perPage: ENV.PER_PAGE,
}

const discussionActions = createPaginationActions(
  'discussions',
  apiClient.getDiscussions,
  getDiscussionOpts,
)

const types = [
  ...discussionActions.actionTypes,
  'DRAG_AND_DROP_START',
  'DRAG_AND_DROP_SUCCESS',
  'DRAG_AND_DROP_FAIL',
  'UPDATE_DISCUSSIONS_SEARCH',
  'TOGGLE_MODAL_OPEN',
  'TOGGLE_SUBSCRIBE_START',
  'ARRANGE_PINNED_DISCUSSIONS',
  'TOGGLE_SUBSCRIBE_START',
  'TOGGLE_SUBSCRIBE_SUCCESS',
  'TOGGLE_SUBSCRIBE_FAIL',
  'GET_USER_SETTINGS_START',
  'GET_USER_SETTINGS_SUCCESS',
  'GET_USER_SETTINGS_FAIL',
  'GET_COURSE_SETTINGS_START',
  'GET_COURSE_SETTINGS_SUCCESS',
  'GET_COURSE_SETTINGS_FAIL',
  'SAVING_SETTINGS_START',
  'SAVING_SETTINGS_SUCCESS',
  'SAVING_SETTINGS_FAIL',
  'UPDATE_DISCUSSION_START',
  'UPDATE_DISCUSSION_SUCCESS',
  'UPDATE_DISCUSSION_FAIL',
  'DUPLICATE_DISCUSSION_START',
  'DUPLICATE_DISCUSSION_SUCCESS',
  'DUPLICATE_DISCUSSION_FAIL',
  'DELETE_DISCUSSION_START',
  'DELETE_DISCUSSION_SUCCESS',
  'DELETE_DISCUSSION_FAIL',
  'DELETE_FOCUS_PENDING',
  'DELETE_FOCUS_CLEANUP',
  'CLEAN_DISCUSSION_FOCUS',
  'SET_COPY_TO',
  'SET_COPY_TO_OPEN',
  'SET_SEND_TO',
  'SET_SEND_TO_OPEN',
] as const
// @ts-expect-error - redux-actions types are complex
const actions = Object.assign(createActions(...types), discussionActions.actionCreators)

function copyAndUpdateDiscussion(
  discussion: Discussion,
  updatedFields: Record<string, any>,
  focusOn?: string,
): Discussion {
  const discussionCopy = {...discussion}
  Object.keys(updatedFields).forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(discussion, key)) {
      throw new Error(`field ${key} does not exist in the discussion`)
    }
    discussionCopy[key] = updatedFields[key]
  })
  if (focusOn) {
    discussionCopy.focusOn = focusOn
  }
  return discussionCopy
}

actions.updateDiscussion = function (
  discussion: Discussion,
  updatedFields: Record<string, any>,
  {successMessage, failMessage}: {successMessage?: string; failMessage?: string},
  focusOn?: string,
) {
  return (dispatch: Dispatch, getState: GetState) => {
    dispatch(actions.updateDiscussionStart())
    apiClient
      .updateDiscussion(getState(), discussion, updatedFields)
      .then(res => {
        const newDiscussion = res.data

        // Students lose the manage menu if they close a discussion that they
        // created. This can ruin the focus, and we need to correct it here
        // if so. The check is here, not in the caller of the updateDiscussion,
        // because we don't know if the menu disappears until we get the result
        // back from this call. This is terrible.
        if (focusOn) {
          if (focusOn === 'manageMenu') {
            const realFocus = newDiscussion.permissions.delete ? 'manageMenu' : 'title'
            newDiscussion.focusOn = realFocus
          } else {
            newDiscussion.focusOn = focusOn
          }
        }

        dispatch(actions.updateDiscussionSuccess({discussion: newDiscussion}))
        if (successMessage) {
          $.screenReaderFlashMessage(successMessage)
        }
      })
      .catch(err => {
        $.screenReaderFlashMessage(failMessage || I18n.t('Updating discussion failed'))
        dispatch(
          actions.updateDiscussionFail({
            message: failMessage || I18n.t('Updating discussion failed'),
            err,
          }),
        )
      })
  }
}

// We need to assume success here, so that when we drag and drop something
// it does not snap back to its current location and then move to the
// correct location after the API call succeeds. This is a bit more complex
// as we could be making two API calls here as well (pinning a discussion
// and setting the order of the pin). Start by updating the store with
// this information, then rollback based on if either of the API calls
// failed.
actions.handleDrop = function (
  discussion: Discussion,
  updatedFields: Record<string, any>,
  order?: string[],
) {
  return (dispatch: Dispatch, getState: GetState) => {
    const originalOrder = order ? getState().pinnedDiscussionIds.slice() : undefined
    const discussionCopy = copyAndUpdateDiscussion(discussion, updatedFields)
    dispatch(actions.dragAndDropStart({discussion: discussionCopy, order}))
    apiClient
      .updateDiscussion(getState(), discussion, updatedFields)
      .then(() => {
        // Only need to make this API call if reordering the pinned discussions
        const promise =
          discussionCopy.pinned && order !== undefined
            ? apiClient.reorderPinnedDiscussions(getState(), order)
            : new Promise<void>(resolve => resolve())

        promise
          .then(() => {
            dispatch(actions.dragAndDropSuccess())
          })
          .catch(err => {
            // container state has already been updated, so we are only reverting
            // the pinned order here. By default, if this is a discussion that
            // that just got moved to the pinned container, we will move it to
            // the bottom of the pinned discussions on error
            if (discussionCopy.pinned && originalOrder) {
              originalOrder.push(discussionCopy.id)
            }
            dispatch(
              actions.dragAndDropFail({
                message: I18n.t('Failed to update discussion'),
                discussion: discussionCopy,
                order: originalOrder,
                err,
              }),
            )
          })
      })
      .catch(err => {
        // reset order and discussion back to original state
        dispatch(
          actions.dragAndDropFail({
            message: I18n.t('Failed to update discussion'),
            discussion,
            order: originalOrder,
            err,
          }),
        )
      })
  }
}

actions.searchDiscussions = function searchDiscussions({
  searchTerm,
  filter,
}: {
  searchTerm: string
  filter: string
}) {
  return (dispatch: Dispatch, getState: GetState) => {
    dispatch(actions.updateDiscussionsSearch({searchTerm, filter}))
    const {allDiscussions} = getState()
    const unfiltered = Object.keys(allDiscussions).filter(id => {
      const discussion = allDiscussions[id]
      return !discussion.filtered
    })
    const numDisplayed = unfiltered.length
    $.screenReaderFlashMessageExclusive(
      I18n.t('%{count} discussions found.', {count: numDisplayed}),
    )
  }
}

function nextFocusableDiscussion(
  state: State,
  discussionId: string,
): {focusOn?: string; focusId?: string} {
  const {allDiscussions} = state
  const pinned = state.pinnedDiscussionIds
  const unpinned = state.unpinnedDiscussionIds
  const closed = state.closedForCommentsDiscussionIds

  // Find which category has the requested discussion
  let container: string[] | null = null
  let index: number | null = null
  const pinnedIndex = pinned.indexOf(discussionId)
  const unpinnedIndex = unpinned.indexOf(discussionId)
  const closedIndex = closed.indexOf(discussionId)
  if (pinnedIndex !== -1) {
    container = pinned
    index = pinnedIndex
  } else if (unpinnedIndex !== -1) {
    container = unpinned
    index = unpinnedIndex
  } else if (closedIndex !== -1) {
    container = closed
    index = closedIndex
  } else {
    throw new Error('discussionId does not exist in any container')
  }

  // 0 is a special case, where we have to go back out to the toggle button
  // (as there are no previous discussions we can put focus on). Also note
  // that it is possible for this to return nothing, ie if there is only a
  // single element in a container. The same logic that handles if element 0
  // requests you put focus back on the toggle button will also handle if
  // there aren't any elements left in this container, and push the focus back
  // to the containers toggle button as well.
  let focusId: string | undefined
  let focusOn: string | undefined
  if (index === 0) {
    const nextDiscussion = allDiscussions[container[index + 1]]
    if (nextDiscussion) {
      focusId = nextDiscussion.id
      focusOn = 'toggleButton'
    }
  } else {
    const prevDiscussion = allDiscussions[container[index - 1]]
    if (prevDiscussion) {
      focusId = prevDiscussion.id
      focusOn = prevDiscussion.permissions?.delete ? 'manageMenu' : 'title'
    }
  }

  return {
    focusOn,
    focusId,
  }
}

actions.deleteDiscussion = function (discussion: Discussion) {
  return (dispatch: Dispatch, getState: GetState) => {
    const state = getState()
    dispatch(actions.deleteDiscussionStart())
    apiClient
      .deleteDiscussion(state, {discussion})
      .then(_ => {
        const nextFocusDiscussion = nextFocusableDiscussion(state, discussion.id)
        dispatch(actions.deleteFocusPending())
        dispatch(actions.deleteDiscussionSuccess({discussion, nextFocusDiscussion}))
        $.screenReaderFlashMessage(
          I18n.t('Successfully deleted discussion %{title}', {title: discussion.title}),
        )
      })
      .catch(err => {
        $.screenReaderFlashMessage(
          I18n.t('Failed to delete discussion %{title}', {title: discussion.title}),
        )
        dispatch(
          actions.deleteDiscussionFail({
            message: I18n.t('Failed to delete discussion %{title}', {title: discussion.title}),
            discussion,
            err,
          }),
        )
      })
  }
}

actions.deleteFocusDone = function () {
  return (dispatch: Dispatch) => dispatch(actions.deleteFocusCleanup())
}

actions.fetchUserSettings = function () {
  return (dispatch: Dispatch, getState: GetState) => {
    dispatch(actions.getUserSettingsStart())
    apiClient
      .getUserSettings(getState())
      .then(resp => {
        dispatch(actions.getUserSettingsSuccess(resp.data))
      })
      .catch(err => {
        dispatch(actions.getUserSettingsFail({err}))
      })
  }
}

actions.fetchCourseSettings = function () {
  return (dispatch: Dispatch, getState: GetState) => {
    dispatch(actions.getCourseSettingsStart())
    apiClient
      .getCourseSettings(getState())
      .then(resp => {
        dispatch(actions.getCourseSettingsSuccess(resp.data))
      })
      .catch(err => {
        dispatch(actions.getCourseSettingsFail({err}))
      })
  }
}

function saveCourseSettings(
  dispatch: Dispatch,
  getState: GetState,
  userSettings: any,
  courseSettings: any,
) {
  apiClient
    .saveCourseSettings(getState(), courseSettings)
    .then(resp => {
      $.screenReaderFlashMessage(I18n.t('Saved discussion settings successfully'))
      dispatch(actions.savingSettingsSuccess({userSettings, courseSettings: resp.data}))
    })
    .catch(err => {
      $.screenReaderFlashMessage(I18n.t('Error saving discussion settings'))
      dispatch(actions.savingSettingsFail({err}))
    })
}

actions.saveSettings = function (userSettings: any, courseSettings?: any) {
  return (dispatch: Dispatch, getState: GetState) => {
    dispatch(actions.savingSettingsStart())
    const userSettingsCopy = Object.assign(getState().userSettings, {})
    userSettingsCopy.manual_mark_as_read = userSettings.markAsRead
    apiClient
      .saveUserSettings(getState(), userSettingsCopy)
      .then(resp => {
        if (courseSettings) {
          saveCourseSettings(dispatch, getState, resp.data, courseSettings)
        } else {
          $.screenReaderFlashMessage(I18n.t('Saved discussion settings successfully'))
          dispatch(actions.savingSettingsSuccess({userSettings: resp.data}))
        }
      })
      .catch(err => {
        $.screenReaderFlashMessage(I18n.t('Error saving discussion settings'))
        dispatch(actions.savingSettingsFail({err}))
      })
  }
}

actions.duplicateDiscussion = function (discussionId: string) {
  return (dispatch: Dispatch, getState: GetState) => {
    // This is a no-op, just here to maintain a pattern
    dispatch(actions.duplicateDiscussionStart())
    apiClient
      .duplicateDiscussion(getState(), discussionId)
      .then(response => {
        const newDiscussion = response.data
        newDiscussion.focusOn = 'title'
        const successMessage = I18n.t('Duplication of %{title} succeeded', {
          title: newDiscussion.title,
        })
        $.screenReaderFlashMessageExclusive(successMessage)
        dispatch(
          actions.duplicateDiscussionSuccess({
            newDiscussion,
            originalId: discussionId,
          }),
        )
      })
      .catch(err => {
        const failMessage = I18n.t('Duplication failed')
        $.screenReaderFlashMessageExclusive(failMessage)
        dispatch(
          actions.duplicateDiscussionFail({
            message: failMessage,
            err,
          }),
        )
      })
  }
}

// This is a different action then the update discussion because it hits an
// entirely different endpoint on the backend.
actions.toggleSubscriptionState = function (discussion: Discussion) {
  return (dispatch: Dispatch, getState: GetState) => {
    if (discussion.subscription_hold === undefined) {
      dispatch(actions.toggleSubscribeStart())
      const toggleFunc = discussion.subscribed
        ? apiClient.unsubscribeFromTopic
        : apiClient.subscribeToTopic

      toggleFunc(getState(), discussion)
        .then(_ => {
          const params = {id: discussion.id, subscribed: !discussion.subscribed}
          dispatch(actions.toggleSubscribeSuccess(params))
        })
        .catch(err => {
          const failMessage = discussion.subscribed
            ? I18n.t('Unsubscribed failed')
            : I18n.t('Subscribe failed')
          $.screenReaderFlashMessageExclusive(failMessage)
          dispatch(
            actions.toggleSubscribeFail({
              message: failMessage,
              err,
            }),
          )
        })
    }
  }
}

const actionTypes: Record<string, string> = types.reduce(
  (typesMap, actionType) => Object.assign(typesMap, {[actionType]: actionType}),
  {} as Record<string, string>,
)

export {actionTypes, actions as default}
