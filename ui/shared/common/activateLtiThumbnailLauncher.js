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

import $ from 'jquery'
import sanitizeUrl from '@canvas/util/sanitizeUrl'

const selector = '.lti-thumbnail-launch'

function handleLaunch(event) {
  event.preventDefault()
  ltiThumbnailLauncher.launch($(event.target).closest(selector))
}

class LtiThumbnailLauncher {
  constructor() {
    $(document.body).on('click', selector, handleLaunch)
  }

  launch(element) {
    const placement = JSON.parse(element.attr('target'))
    const _ifrEl = document.createElement('iframe')
    _ifrEl.src = sanitizeUrl(element.attr('href'))
    _ifrEl.setAttribute('allowfullscreen', '')
    _ifrEl.width = placement.displayWidth || 500
    _ifrEl.height = placement.displayHeight || 500
    const iframe = $(_ifrEl)
    element.replaceWith(iframe)
  }
}

// There can be only one LtiThumbnailLauncher
const ltiThumbnailLauncher = new LtiThumbnailLauncher(selector)
export default ltiThumbnailLauncher
