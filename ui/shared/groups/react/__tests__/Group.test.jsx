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

import React from 'react'
import {render, screen} from '@testing-library/react'
import stubEnv from '@canvas/stub-env'
import Group from '../Group'

const defaultProps = (groupOverrides = {}) => ({
  onLeave: vi.fn(),
  onJoin: vi.fn(),
  onManage: vi.fn(),
  group: {
    id: '1',
    name: 'Group 1',
    max_membership: 20,
    users: [{id: 2, name: 'Other Section Student'}],
    leader: null,
    join_level: 'parent_context_auto_join',
    permissions: {join: true},
    group_category: {
      name: 'Category',
      self_signup: 'enabled',
      is_member: false,
      role: 'student',
      allows_multiple_memberships: false,
    },
    ...groupOverrides,
  },
})

describe('Group', () => {
  stubEnv({current_user_id: 999})

  it('treats the group as full when is_full is true, even if few members are visible', () => {
    // A section-limited student only sees members in their own section, so
    // users.length (1) stays below max_membership (20) while the group is
    // actually full across all sections.
    render(<Group {...defaultProps({is_full: true})} />)

    expect(screen.queryByTestId('join-group-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('membership-locked')).toBeInTheDocument()
  })

  it('shows the Join button when is_full is false', () => {
    render(<Group {...defaultProps({is_full: false})} />)

    expect(screen.getByTestId('join-group-button')).toBeInTheDocument()
  })

  it('falls back to the member-count comparison when is_full is absent', () => {
    const props = defaultProps()
    props.group.users = Array.from({length: 20}, (_, i) => ({id: i + 10, name: `Student ${i}`}))
    render(<Group {...props} />)

    expect(screen.queryByTestId('join-group-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('membership-locked')).toBeInTheDocument()
  })
})
