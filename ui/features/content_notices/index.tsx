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

import React from 'react'
import {legacyRender} from '@canvas/react'
import {Alert} from '@instructure/ui-alerts'
import {Text} from '@instructure/ui-text'
import {Link} from '@instructure/ui-link'
import ready from '@instructure/ready'

type ContentNotice = {
  tag: string
  variant: React.ComponentProps<typeof Alert>['variant']
  text: string
  link_text?: string
  link_target?: string
}

ready(() => {
  const container = document.getElementById('content_notice_container')
  // @ts-expect-error - page-specific ENV.CONTENT_NOTICES is not part of GlobalEnv
  if (container && ENV.CONTENT_NOTICES.length > 0) {
    // @ts-expect-error - page-specific ENV.CONTENT_NOTICES is not part of GlobalEnv
    const alerts = ENV.CONTENT_NOTICES.map((notice: ContentNotice) => {
      let link: React.JSX.Element | null = null
      if (notice.link_text && notice.link_target) {
        link = <Link href={notice.link_target}>{notice.link_text}</Link>
      }
      return (
        <Alert
          key={notice.tag}
          variant={notice.variant}
          liveRegion={() => document.getElementById('flash_screenreader_holder')}
        >
          <Text>{notice.text}</Text>&emsp;{link}
        </Alert>
      )
    })

    legacyRender(alerts, container)
  }
})
