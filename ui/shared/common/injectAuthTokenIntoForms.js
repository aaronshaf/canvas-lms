//
// Copyright (C) 2021 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.

import $ from 'jquery'
import authenticityToken from '@canvas/authenticity-token'
import sanitizeUrl from '@canvas/util/sanitizeUrl'

const getHostname = function (href) {
  if (!href) return location.hostname
  const a = document.createElement('a')
  a.href = sanitizeUrl(href)
  return a.hostname
}

const isCrossSite = function (href) {
  return getHostname(href) !== location.hostname
}

const injectTokenIntoLocalRequests = function () {
  if (isCrossSite(this.action)) {
    $(this).find('input[name="authenticity_token"]').val('requestWasCrossSite')
    return
  }

  $(this)
    .find('input[name="authenticity_token"]')
    .val(authenticityToken() || 'tokenWasEmpty')
}

$(document).on('submit', 'form', injectTokenIntoLocalRequests)

// for testing
export {isCrossSite}
