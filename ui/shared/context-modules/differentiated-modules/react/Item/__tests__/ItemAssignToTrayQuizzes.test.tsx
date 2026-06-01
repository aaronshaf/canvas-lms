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

import {waitFor} from '@testing-library/react'
import fakeENV from '@canvas/test-utils/fakeENV'
import {
  renderComponent,
  server,
  setupBaseMocks,
  setupEnv,
  setupFlashHolder,
  teardownEnv,
  clearQueryCache,
  http,
  HttpResponse,
} from './ItemAssignToTrayTestUtils'

describe('ItemAssignToTray - Quizzes with Differentiation Tag Overrides', () => {
  beforeAll(() => {
    setupFlashHolder()
    server.listen({onUnhandledRequest: 'bypass'})
  })

  beforeEach(() => {
    setupEnv()
    setupBaseMocks()
    fakeENV.setup({
      ALLOW_ASSIGN_TO_DIFFERENTIATION_TAGS: true,
      VALID_DATE_RANGE: {
        start_at: {date: '2023-08-20T12:00:00Z', date_context: 'course'},
        end_at: {date: '2023-12-30T12:00:00Z', date_context: 'course'},
      },
      HAS_GRADING_PERIODS: false,
      SECTION_LIST: [{id: '4'}, {id: '5'}],
      POST_TO_SIS: false,
      DUE_DATE_REQUIRED_FOR_ACCOUNT: false,
      MASTER_COURSE_DATA: undefined,
    })
  })

  afterEach(() => {
    server.resetHandlers()
    teardownEnv()
    clearQueryCache()
    fakeENV.teardown()
  })

  afterAll(() => {
    server.close()
  })

  it('renders all override assignees including "Everyone else" when a quiz has two diff-tag overrides and is not only_visible_to_overrides', async () => {
    server.use(
      http.get('/api/v1/courses/1/quizzes/23/date_details', () => {
        return HttpResponse.json({
          id: '23',
          due_at: '2023-10-05T12:00:00Z',
          unlock_at: '2023-10-01T12:00:00Z',
          lock_at: '2023-11-01T12:00:00Z',
          only_visible_to_overrides: false,
          visible_to_everyone: true,
          overrides: [
            {
              id: '101',
              quiz_id: '23',
              title: 'Differentiation Tag 1',
              due_at: null,
              unlock_at: null,
              lock_at: null,
              group_id: '201',
              group_category_id: '301',
              non_collaborative: true,
            },
            {
              id: '102',
              quiz_id: '23',
              title: 'Differentiation Tag 2',
              due_at: null,
              unlock_at: null,
              lock_at: null,
              group_id: '202',
              group_category_id: '301',
              non_collaborative: true,
            },
          ],
        })
      }),
    )

    const {findAllByTestId, findByTitle} = renderComponent({itemType: 'quiz', iconType: 'quiz'})

    // 3 cards expected: one "Everyone else" card (because only_visible_to_overrides is false)
    // plus one card for each of the two differentiation-tag overrides
    const cards = await findAllByTestId('item-assign-to-card')
    expect(cards).toHaveLength(3)

    // Wait for selected-option chips to render in each card's AssigneeSelector
    await waitFor(
      async () => {
        const selectedOptions = await findAllByTestId('assignee_selector_selected_option')
        expect(selectedOptions).toHaveLength(3)
      },
      {timeout: 5000},
    )

    // Verify the specific chips: two diff-tag chips and the "Everyone else" chip
    expect(await findByTitle('Remove Everyone else')).toBeInTheDocument()
    expect(await findByTitle('Remove Differentiation Tag 1')).toBeInTheDocument()
    expect(await findByTitle('Remove Differentiation Tag 2')).toBeInTheDocument()
  }, 30000)
})
