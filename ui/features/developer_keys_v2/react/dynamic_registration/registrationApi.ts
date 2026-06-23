/*
 * Copyright (C) 2023 - present Instructure, Inc.
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
import doFetchApi from '@canvas/do-fetch-api-effect'

import type {LtiRegistration} from '../../model/LtiRegistration'
import type {RegistrationOverlay} from '../RegistrationSettings/RegistrationOverlayState'

export type RegistrationToken = {
  token: string
  oidc_configuration_url: string
  uuid: string
}

export const getRegistrationToken = (accountId: string, registrationUrl: string) =>
  doFetchApi({
    path: `/api/lti/accounts/${accountId}/registration_token?registration_url=${registrationUrl}`,
  }).then(({json}) => json as unknown as RegistrationToken)

export const getRegistrationByUUID = (accountId: string, registrationUuid: string) =>
  doFetchApi({
    path: `/api/lti/accounts/${accountId}/registrations/uuid/${registrationUuid}`,
  }).then(({json}) => json as unknown as LtiRegistration)

export const updateRegistrationOverlay = (
  accountId: string,
  registrationId: number | string,
  overlay: RegistrationOverlay,
) =>
  doFetchApi({
    path: `/api/lti/accounts/${accountId}/registrations/${registrationId}/overlay`,
    method: 'PUT',
    body: overlay,
  }).then(({json}) => json as unknown as LtiRegistration)
