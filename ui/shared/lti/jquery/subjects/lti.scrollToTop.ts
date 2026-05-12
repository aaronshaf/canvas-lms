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

import $ from 'jquery'
import {forwardedMsgSource} from '../forwarded_msg_source'
import {findDomForWindow, findDomForWindowInRCEIframe} from '../util'
import type {LtiMessageHandler} from '../lti_message_handler'

const findSenderIframe = (e: MessageEvent<unknown>) => {
  const fwd = forwardedMsgSource(e)
  return findDomForWindow(fwd ?? e.source) || findDomForWindowInRCEIframe(e.source)
}

const scrollToTop: LtiMessageHandler = params => {
  // When top_navigation_placement FF is on, the page is wrapped in an
  // InstUI DrawerLayout, so html/body can no longer scroll. The actual
  // scroll container becomes #drawer-layout-content in that case.
  const drawerContent = $('#drawer-layout-content')
  const isTopNavEnabled = ENV.FEATURES?.top_navigation_placement && drawerContent.length
  const targetToScroll = isTopNavEnabled ? drawerContent : $('html, body')

  // Scope the scroll target to the sender's own iframe / wrapper so a tool
  // cannot cause Canvas to scroll to another tool's iframe.
  const senderIframe = findSenderIframe(params.event)
  if (!senderIframe) return false
  const wrapper = $(senderIframe).closest('.tool_content_wrapper')
  const scrollAnchor = wrapper.length ? wrapper : $(senderIframe)

  const offset = scrollAnchor.offset()?.top
  if (offset !== undefined) {
    // For a sub-container (drawer), offset().top is viewport-relative (since window.scrollY=0),
    // so we must add the container's current scrollTop to get the correct absolute position within it.
    const scrollTop = offset + (isTopNavEnabled ? (drawerContent.scrollTop() ?? 0) : 0)
    targetToScroll.animate({scrollTop}, 'fast')
  }

  return false
}

export default scrollToTop
