/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

export type CustomHelpLinkLinkType = 'default' | 'custom'
export type CustomHelpLinkLinkState = 'new' | 'active' | 'deleted'
export type CustomHelpLinkLinkAction = 'edit' | 'focus'

export type CustomHelpLinkLink = {
  text: string
  url: string
  subtext?: string
  available_to?: string[]
  type?: CustomHelpLinkLinkType
  id?: string

  index?: number
  state?: CustomHelpLinkLinkState
  action?: CustomHelpLinkLinkAction
  is_disabled?: boolean

  // Feature flags used by some accounts.
  is_featured?: boolean
  is_new?: boolean
  feature_headline?: string
}
