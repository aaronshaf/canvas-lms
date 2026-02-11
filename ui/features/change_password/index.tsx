/*
 * Copyright (C) 2013 - present Instructure, Inc.
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

import {render} from '@canvas/react'
import ready from '@instructure/ready'
import ConfirmChangePassword, {
  type ConfirmChangePasswordProps,
} from './react/ConfirmChangePassword'

type Pseudonym = {
  id: string
  user_name: string
}

type CC = {
  path: string
  confirmation_code: string
}

declare global {
  interface Window {
    ENV: {
      CC: CC
      PSEUDONYM: Pseudonym
      PASSWORD_POLICY: ConfirmChangePasswordProps['defaultPolicy']
      PASSWORD_POLICIES: ConfirmChangePasswordProps['passwordPoliciesAndPseudonyms']
    }
  }
}

ready(() => {
  const mountPoint = document.getElementById('confirm_change_password_mount_point')

  if (!mountPoint) {
    throw new Error('Could not find mount point for change password component')
  }

  render(
    <ConfirmChangePassword
      cc={window.ENV.CC}
      pseudonym={window.ENV.PSEUDONYM}
      defaultPolicy={window.ENV.PASSWORD_POLICY}
      passwordPoliciesAndPseudonyms={window.ENV.PASSWORD_POLICIES}
    />,
    mountPoint,
  )
})
