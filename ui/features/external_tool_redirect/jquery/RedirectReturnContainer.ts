//
// Copyright (C) 2014 - present Instructure, Inc.
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

import {handleExternalContentMessages} from '@canvas/external-tools/messages'

interface ExternalContentData {
  return_type?: string
  url?: string
}

interface ContentMigrationData {
  migration_type: string
  settings: {
    file_url: string
  }
}

interface ErrorResponse {
  message: string
}

export default class RedirectReturnContainer {
  successUrl: string
  cancelUrl: string

  constructor() {
    this.successUrl = ENV.redirect_return_success_url
    this.cancelUrl = ENV.redirect_return_cancel_url
  }

  attachLtiEvents(): void {
    handleExternalContentMessages({
      ready: this._contentReady,
      cancel: this._contentCancel,
    })
  }

  _contentReady = (data: ExternalContentData): void => {
    if (data && data.return_type === 'file') {
      this.createMigration(data.url!)
    } else {
      this.redirectToSuccessUrl()
    }
  }

  _contentCancel = (): void => {
    window.location.href = this.cancelUrl
  }

  redirectToSuccessUrl = (): void => {
    window.location.href = this.successUrl
  }

  createMigration = (file_url: string): JQuery.jqXHR => {
    const data: ContentMigrationData = {
      migration_type: 'canvas_cartridge_importer',
      settings: {
        file_url,
      },
    }

    const migrationUrl = `/api/v1/courses/${ENV.course_id}/content_migrations`
    return $.ajaxJSON(migrationUrl, 'POST', data, this.redirectToSuccessUrl, this.handleError)
  }

  handleError(data: ErrorResponse): void {
    $.flashError(data.message)
  }
}
