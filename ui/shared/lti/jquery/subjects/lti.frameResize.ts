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
import ToolLaunchResizer from '../tool_launch_resizer'
import {findDomForWindow, findDomForWindowInRCEIframe} from '../util'
import {forwardedMsgSource} from '../forwarded_msg_source'
import type {LtiMessageHandler} from '../lti_message_handler'

const frameResize: LtiMessageHandler<{height: number | string}> = ({message, event}) => {
  let height: number | string = message.height as number | string
  if (Number(height) <= 0) height = 1

  // Resolve the sender's own iframe; ignore any tool-supplied selector so a
  // registered tool cannot resize another tool's iframe.
  const fwd = forwardedMsgSource(event)
  const iframe = findDomForWindow(fwd ?? event.source) || findDomForWindowInRCEIframe(event.source)
  if (!iframe) return false

  const container = $(iframe).closest('.tool_content_wrapper')
  if (container.length > 0) {
    container.data('height_overridden', true)
    new ToolLaunchResizer().resize_tool_content_wrapper(height, container)
  } else {
    const strHeight = typeof height === 'number' ? `${height}px` : height
    iframe.height = strHeight
    iframe.style.height = strHeight
  }
  return false
}

export default frameResize
