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

import {render, waitFor} from '@testing-library/react'
import React from 'react'
import {MockedProvider} from '@apollo/client/testing'
import {AlertManagerContext} from '@instructure/platform-alerts'

import DiscussionTopicFormContainer from '../DiscussionTopicFormContainer'
import {COURSE_QUERY} from '../../../../graphql/Queries'

// The container also renders the full DiscussionTopicForm and TopNav portal, which
// pull in heavy dependencies (RCE, etc.) irrelevant to the page heading. Stub them so
// the test exercises only the heading rendered by DiscussionTopicFormContainer itself.
vi.mock('../../../components/DiscussionTopicForm/DiscussionTopicForm', () => ({
  default: () => <div data-testid="discussion-topic-form" />,
}))
vi.mock('@canvas/top-navigation/react/TopNavPortalWithDefaults', () => ({
  default: () => null,
}))

const courseMock = {
  request: {
    query: COURSE_QUERY,
    variables: {courseId: '1'},
  },
  result: {
    data: {
      legacyNode: {
        __typename: 'Course',
        _id: '1',
        id: 'course-1',
        name: 'Test Course',
        groupSets: [],
        assignmentGroupsConnection: {__typename: 'AssignmentGroupConnection', nodes: []},
        assignmentGroups: [],
        usersConnection: {__typename: 'UserConnection', nodes: []},
        groupSetsConnection: {__typename: 'GroupSetConnection', nodes: []},
        sectionsConnection: {__typename: 'SectionConnection', nodes: []},
      },
    },
  },
}

const renderContainer = () =>
  render(
    <MockedProvider mocks={[courseMock]} addTypename={true}>
      <AlertManagerContext.Provider value={{setOnFailure: () => {}, setOnSuccess: () => {}}}>
        <DiscussionTopicFormContainer apolloClient={null} />
      </AlertManagerContext.Provider>
    </MockedProvider>,
  )

describe('DiscussionTopicFormContainer heading', () => {
  beforeEach(() => {
    window.ENV = {
      context_is_not_group: true,
      context_id: '1',
      FEATURES: {instui_nav: true},
      DISCUSSION_TOPIC: {ATTRIBUTES: {}},
    }
  })

  it('renders an h1 with "Create Discussion" for a new non-announcement', async () => {
    window.ENV.DISCUSSION_TOPIC.ATTRIBUTES.is_announcement = false
    const {getByRole} = renderContainer()
    await waitFor(() => {
      expect(getByRole('heading', {level: 1, name: 'Create Discussion'})).toBeInTheDocument()
    })
  })

  it('renders an h1 with "Create Announcement" when is_announcement is true', async () => {
    window.ENV.DISCUSSION_TOPIC.ATTRIBUTES.is_announcement = true
    const {getByRole} = renderContainer()
    await waitFor(() => {
      expect(getByRole('heading', {level: 1, name: 'Create Announcement'})).toBeInTheDocument()
    })
  })
})
