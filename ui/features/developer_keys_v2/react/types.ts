/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

export interface DeveloperKeyAccountBinding {
  workflow_state: string
  account_owns_binding?: boolean
}

export interface DeveloperKey {
  id: string
  api_key?: string
  created_at: string
  is_lti_key?: boolean
  is_lti_registration?: boolean
  visible?: boolean
  name?: string
  user_id?: string
  workflow_state?: string
  access_token_count?: number
  email?: string
  redirect_uri?: string
  last_used_at?: string
  icon_url?: string
  inherited_to?: string
  inherited_from?: string
  developer_key_account_binding?: DeveloperKeyAccountBinding
  tool_configuration?: ToolConfiguration
  lti_registration_id?: string
}

export interface ToolConfiguration {
  title?: string
  description?: string
  target_link_uri?: string
  oidc_initiation_url?: string
  public_jwk?: Record<string, any>
  public_jwk_url?: string
  scopes?: string[]
  extensions?: Array<{
    platform?: string
    privacy_level?: string
    settings?: {
      placements?: any[]
    }
  }>
  custom_fields?: Record<string, string>
}

export interface DeveloperKeyStore {
  dispatch: (action: any) => void
}

export interface DeveloperKeyActions {
  makeVisibleDeveloperKey: (key: DeveloperKey) => any
  makeInvisibleDeveloperKey: (key: DeveloperKey) => any
  activateDeveloperKey: (key: DeveloperKey) => any
  deactivateDeveloperKey: (key: DeveloperKey) => any
  deleteDeveloperKey: (key: DeveloperKey) => any
  editDeveloperKey: (key: DeveloperKey) => any
  developerKeysModalOpen: (type: string) => any
  ltiKeysSetLtiKey: (value: boolean) => any
  setBindingWorkflowState: (key: DeveloperKey, contextId: string, state: string) => any
  getRemainingDeveloperKeys?: (nextPage: string, keys: DeveloperKey[], callback: () => void) => (dispatch: any) => void
  getRemainingInheritedDeveloperKeys?: (nextPage: string, keys: DeveloperKey[], callback: () => void) => (dispatch: any) => void
}

export interface DeveloperKeyContext {
  params: {
    contextId: string
  }
}
