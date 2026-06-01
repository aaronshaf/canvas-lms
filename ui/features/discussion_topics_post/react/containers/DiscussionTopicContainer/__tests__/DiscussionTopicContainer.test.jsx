/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import {AlertManagerContext} from '@instructure/platform-alerts'
import {assignLocation, openWindow} from '@canvas/util/globalUtils'
import {MockedProviderWithPossibleTypes as MockedProvider} from '@canvas/util/react/testing/MockedProviderWithPossibleTypes'
import {waitFor} from '@testing-library/dom'
import {fireEvent, render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import fakeENV from '@canvas/test-utils/fakeENV'
import useManagedCourseSearchApi from '../../../../../../shared/direct-sharing/react/effects/useManagedCourseSearchApi'
import {Assignment} from '../../../../graphql/Assignment'
import {Discussion} from '../../../../graphql/Discussion'
import {DiscussionPermissions} from '../../../../graphql/DiscussionPermissions'
import {
  deleteDiscussionTopicMock,
  updateDiscussionReadStateMock,
  updateDiscussionTopicMock,
} from '../../../../graphql/Mocks'
import {PeerReviews} from '../../../../graphql/PeerReviews'
import {getSpeedGraderUrl, responsiveQuerySizes} from '../../../utils'
import {DiscussionTopicContainer} from '../DiscussionTopicContainer'
import {ObserverContext} from '../../../utils/ObserverContext'

// mock assignLocation
vi.mock('@canvas/util/globalUtils', () => ({
  assignLocation: vi.fn(),
  openWindow: vi.fn(),
}))

vi.mock('../../../../../../shared/direct-sharing/react/effects/useManagedCourseSearchApi')
vi.mock('@canvas/rce/RichContentEditor')
vi.mock('../../../utils', async () => ({
  ...(await vi.importActual('../../../utils')),
  responsiveQuerySizes: vi.fn(),
}))

describe('DiscussionTopicContainer', () => {
  const setOnFailure = vi.fn()
  const setOnSuccess = vi.fn()
  let liveRegion = null

  beforeAll(() => {
    fakeENV.setup({
      EDIT_URL: 'this_is_the_edit_url',
      PEER_REVIEWS_URL: 'this_is_the_peer_reviews_url',
      context_asset_string: 'course_1',
      course_id: '1',
      context_type: 'Course',
      context_id: '1',
      discussion_topic_menu_tools: [
        {
          base_url: 'example.com',
          canvas_icon_class: 'icon-commons',
          id: '1',
          title: 'Share to Commons',
        },
      ],
    })

    window.matchMedia = vi.fn().mockImplementation(() => {
      return {
        matches: true,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }
    })

    if (!document.getElementById('flash_screenreader_holder')) {
      liveRegion = document.createElement('div')
      liveRegion.id = 'flash_screenreader_holder'
      liveRegion.setAttribute('role', 'alert')
      document.body.appendChild(liveRegion)
    }

    window.INST = {
      editorButtons: [],
    }
  })

  beforeEach(() => {
    responsiveQuerySizes.mockImplementation(() => ({
      desktop: {maxWidth: '1000px'},
    }))
    useManagedCourseSearchApi.mockImplementation(() => {})
  })

  afterEach(() => {
    setOnFailure.mockClear()
    setOnSuccess.mockClear()
    vi.clearAllMocks()
  })

  afterAll(() => {
    if (liveRegion) {
      liveRegion.remove()
    }
  })

  const setup = (props, mocks) => {
    return render(
      <MockedProvider mocks={mocks}>
        <AlertManagerContext.Provider value={{setOnFailure, setOnSuccess}}>
          <ObserverContext.Provider
            value={{observerRef: {current: undefined}, nodesRef: {current: new Map()}}}
          >
            <DiscussionTopicContainer {...props} />
          </ObserverContext.Provider>
        </AlertManagerContext.Provider>
      </MockedProvider>,
    )
  }
  it('publish button is readonly if canUnpublish is false', async () => {
    const {getByText} = setup({discussionTopic: Discussion.mock({canUnpublish: false})})

    expect(getByText('Published').closest('button').hasAttribute('disabled')).toBeTruthy()
  })

  it('renders a special alert for differentiated group assignments for readAsAdmin', async () => {
    const container = setup({
      discussionTopic: Discussion.mock({
        assignment: Assignment.mock({onlyVisibleToOverrides: true}),
      }),
    })
    expect(
      container.getByText(
        'Note: for differentiated group topics, some threads may not have any students assigned.',
      ),
    ).toBeInTheDocument()
  })

  it('renders without optional props', async () => {
    const container = setup({discussionTopic: Discussion.mock({assignment: {}})})
    expect(container.getByTestId('replies-counter')).toBeInTheDocument()
  })

  // selenium row spec/selenium/discussions/discussion_topic_show_spec.rb:133
  // "Displays when all features are turned on" asserts the show page renders an
  // <h1> containing the discussion title (fj("h1:contains('value for title')")).
  // At the component level the title is rendered by PostMessage as an InstUI
  // Heading level="h1" (data-testid="message_title"), so driving the topic title
  // reproduces the heading the selenium row checks. The group / discussions_reporting
  // / discussion_checkpoints flags in the selenium row only change *which* page
  // renders the topic; they do not change the heading element itself.
  it('renders the discussion title as an h1 heading', async () => {
    const title = 'value for title'
    const container = setup({discussionTopic: Discussion.mock({title})})

    const heading = await container.findByTestId('message_title')
    expect(heading.tagName).toBe('H1')
    expect(heading).toHaveTextContent(title)
  })

  it('renders infoText only when there are replies', async () => {
    const container = setup({discussionTopic: Discussion.mock()})
    const infoText = await container.findByTestId('replies-counter')
    expect(infoText).toHaveTextContent('56 Replies, 2 Unread')
  })

  it('does not render unread when there are none', async () => {
    const container = setup({
      discussionTopic: Discussion.mock({
        entryCounts: {
          repliesCount: 24,
          unreadCount: 0,
        },
      }),
    })
    const infoText = await container.findByTestId('replies-counter')
    expect(infoText).toHaveTextContent('24 Replies')
  })

  it('should be able to send to edit page when canUpdate', async () => {
    const {getByTestId, getByText} = setup({discussionTopic: Discussion.mock()})
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    fireEvent.click(getByText('Edit'))

    await waitFor(() => {
      expect(assignLocation).toHaveBeenCalledWith(window.ENV.EDIT_URL)
    })
  })

  it('should be able to send to peer reviews page when canPeerReview', async () => {
    const {getByTestId, getByText} = setup({discussionTopic: Discussion.mock()})
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    fireEvent.click(getByText('Peer Reviews'))

    await waitFor(() => {
      expect(assignLocation).toHaveBeenCalledWith(window.ENV.PEER_REVIEWS_URL)
    })
  })

  it('Should be able to delete topic', async () => {
    window.confirm = vi.fn(() => true)
    const {getByTestId, getByText} = setup(
      {discussionTopic: Discussion.mock()},
      deleteDiscussionTopicMock(),
    )
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    fireEvent.click(getByText('Delete'))

    await waitFor(() =>
      expect(setOnSuccess).toHaveBeenCalledWith('The discussion topic was successfully deleted.'),
    )
    await waitFor(() => {
      expect(assignLocation).toHaveBeenCalledWith('/courses/1/discussion_topics')
    })
  })

  it('Should be able to delete announcement', async () => {
    window.confirm = vi.fn(() => true)
    const {getByTestId, getByText} = setup(
      {discussionTopic: Discussion.mock({isAnnouncement: true})},
      deleteDiscussionTopicMock(),
    )
    await userEvent.click(getByTestId('discussion-post-menu-trigger'))
    await userEvent.click(getByText('Delete'))

    await waitFor(() =>
      expect(setOnSuccess).toHaveBeenCalledWith('The discussion topic was successfully deleted.'),
    )
    await waitFor(() => {
      expect(assignLocation).toHaveBeenCalledWith('/courses/1/announcements')
    })
  })

  it('Should not be able to delete the topic if does not have permission', async () => {
    const {getByTestId, queryByTestId} = setup({
      discussionTopic: Discussion.mock({permissions: DiscussionPermissions.mock({delete: false})}),
    })
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    expect(queryByTestId('delete')).toBeNull()
  })

  it('renders Speed Grader button in the menu', () => {
    const props = {discussionTopic: Discussion.mock()}
    const {getByTestId, getByText} = setup(props)
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))

    expect(getByText('Open in SpeedGrader')).toBeTruthy()
  })

  it('Should be able to open SpeedGrader', async () => {
    const {getByTestId, getByText} = setup({discussionTopic: Discussion.mock()})
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    fireEvent.click(getByText('Open in SpeedGrader'))

    await waitFor(() => {
      expect(openWindow).toHaveBeenCalledWith(getSpeedGraderUrl(), '_blank')
    })
  })

  it('Should not be able to see post menu if no permissions and initialPostRequiredForCurrentUser', () => {
    const {queryByTestId} = setup({
      discussionTopic: Discussion.mock({
        initialPostRequiredForCurrentUser: true,
        permissions: DiscussionPermissions.mock({
          canDelete: false,
          copyAndSendTo: false,
          update: false,
          moderateForum: false,
          speedGrader: false,
          peerReview: false,
          showRubric: false,
          addRubric: false,
          openForComments: false,
          closeForComments: false,
          manageContent: false,
          manageCourseContentAdd: false,
          manageCourseContentEdit: false,
          manageCourseContentDelete: false,
        }),
      }),
    })

    expect(queryByTestId('discussion-post-menu-trigger')).toBeNull()
  })

  it('Should show Mark All as Read discussion topic menu if initialPostRequiredForCurrentUser = false', async () => {
    const {getByTestId, getByText} = setup({
      discussionTopic: Discussion.mock({initialPostRequiredForCurrentUser: false}),
    })
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    expect(getByText('Mark All as Read')).toBeInTheDocument()
  })

  it('Should show Mark All as Unread discussion topic menu if initialPostRequiredForCurrentUser = false', async () => {
    const {getByTestId, getByText} = setup({
      discussionTopic: Discussion.mock({initialPostRequiredForCurrentUser: false}),
    })
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    expect(getByText('Mark All as Unread')).toBeInTheDocument()
  })

  it('Should be able to click Mark All as Read and call mutation', async () => {
    const {getByTestId, getByText} = setup(
      {discussionTopic: Discussion.mock({initialPostRequiredForCurrentUser: false})},
      updateDiscussionReadStateMock(),
    )
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    fireEvent.click(getByText('Mark All as Read'))

    await waitFor(() =>
      expect(setOnSuccess).toHaveBeenCalledWith('You have successfully marked all as read.'),
    )
  })

  it('Should be able to click Mark All as Unread and call mutation', async () => {
    const {getByTestId, getByText} = setup(
      {discussionTopic: Discussion.mock({initialPostRequiredForCurrentUser: false})},
      updateDiscussionReadStateMock({read: false}),
    )
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    fireEvent.click(getByText('Mark All as Unread'))

    await waitFor(() =>
      expect(setOnSuccess).toHaveBeenCalledWith('You have successfully marked all as unread.'),
    )
  })

  it('Renders Open for Comments in the kabob menu if the user has permission', () => {
    const {getByTestId, getByText} = setup({discussionTopic: Discussion.mock()})
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    expect(getByText('Open for Comments')).toBeInTheDocument()
  })

  it('Renders Close for Comments in the kabob menu if the user has permission', () => {
    const {getByTestId, getByText} = setup({
      discussionTopic: Discussion.mock({
        rootTopic: null,
        permissions: DiscussionPermissions.mock({closeForComments: true}),
      }),
    })
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    expect(getByText('Close for Comments')).toBeInTheDocument()
  })

  it('does not render Close for Comments even when there is permission if child topic', () => {
    const container = setup({
      discussionTopic: Discussion.mock({
        permissions: DiscussionPermissions.mock({closeForComments: true}),
      }),
    })
    fireEvent.click(container.getByTestId('discussion-post-menu-trigger'))
    expect(container.queryByText('Close for Comments')).toBeNull()
  })

  it('Renders Copy To and Send To in the kabob menu if the user has permission', () => {
    const {getByTestId, getByText} = setup({discussionTopic: Discussion.mock()})

    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    expect(getByText('Copy To...')).toBeInTheDocument()
    expect(getByText('Send To...')).toBeInTheDocument()
  })

  // Modal tests are in DiscussionTopicContainerModal.test.jsx
  // to properly mock lazy-loaded components

  it('can send users to Commons if they can manageContent', async () => {
    const discussionTopic = Discussion.mock()
    const {getByTestId, getByText} = setup({discussionTopic})
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    fireEvent.click(getByText('Share to Commons'))

    await waitFor(() => {
      expect(assignLocation).toHaveBeenCalledWith(
        `example.com&discussion_topics%5B%5D=${discussionTopic._id}`,
      )
    })
  })

  it('renders an attachment if it exists', async () => {
    const container = setup({discussionTopic: Discussion.mock()})
    expect(await container.findByText('288777.jpeg')).toBeInTheDocument()
  })

  it('renders "discussion topic closed for comments" message if user has reply permission false', async () => {
    const container = setup({
      discussionTopic: Discussion.mock({permissions: DiscussionPermissions.mock({reply: false})}),
    })

    expect(await container.findByText('This is a Discussion Topic Message')).toBeInTheDocument()
    expect(await container.findByTestId('discussion-topic-closed-for-comments')).toBeInTheDocument()
  })

  it('does not renders "discussion topic closed for comments" message if user has reply permission true', () => {
    const container = setup({discussionTopic: Discussion.mock()})

    expect(container.queryByTestId('discussion-topic-closed-for-comments')).toBeNull()
  })

  it('renders a reply button if user has reply permission true', async () => {
    const container = setup({discussionTopic: Discussion.mock()})

    expect(await container.findByText('This is a Discussion Topic Message')).toBeInTheDocument()
    expect(await container.findByTestId('discussion-topic-reply')).toBeInTheDocument()
  })

  it('does not render a reply button if user has reply permission false', () => {
    const container = setup({
      discussionTopic: Discussion.mock({permissions: DiscussionPermissions.mock({reply: false})}),
    })

    expect(container.queryByTestId('discussion-topic-reply')).toBeNull()
  })

  // Component-level coverage for the discussion permission matrix asserted by
  // spec/selenium/discussions/discussion_permission_spec.rb and
  // spec/selenium/discussions/discussions_threaded_spec.rb:50.
  //
  // The topic-level reply button (data-testid="discussion-topic-reply") is
  // gated on discussionTopic.permissions.reply, and the topic Edit menu item
  // (data-testid="discussion-thread-menuitem-edit") is gated on
  // discussionTopic.permissions.update (passed to PostToolbar as onEdit). The
  // server now derives `reply`/`update` from the user's view/post/edit
  // permissions, so driving these props reproduces each selenium row.
  describe('discussion permission matrix (reply button + edit menu item)', () => {
    const renderWithPermissions = ({reply, update}) =>
      setup({
        discussionTopic: Discussion.mock({
          permissions: DiscussionPermissions.mock({reply, update}),
        }),
      })

    const editMenuItem = async container => {
      fireEvent.click(await container.findByTestId('discussion-post-menu-trigger'))
      return container.queryByTestId('discussion-thread-menuitem-edit')
    }

    // selenium rows 127 / 353: view only -> no reply, no edit
    it('view only: hides reply button and edit menu item', async () => {
      const container = renderWithPermissions({reply: false, update: false})

      expect(container.queryByTestId('discussion-topic-reply')).toBeNull()
      expect(await editMenuItem(container)).toBeNull()
    })

    // selenium rows 161 / 387: view + post -> reply shown, edit hidden
    it('view + post: shows reply button but hides edit menu item', async () => {
      const container = renderWithPermissions({reply: true, update: false})

      expect(await container.findByTestId('discussion-topic-reply')).toBeInTheDocument()
      expect(await editMenuItem(container)).toBeNull()
    })

    // selenium rows 200 / 421: view + edit -> reply hidden, edit shown
    it('view + edit: hides reply button but shows edit menu item', async () => {
      const container = renderWithPermissions({reply: false, update: true})

      expect(container.queryByTestId('discussion-topic-reply')).toBeNull()
      expect(await editMenuItem(container)).toBeInTheDocument()
    })

    // selenium rows 234 / 455 + 499 (author of own post): view + edit + post ->
    // reply shown, edit shown. Row 499 is the same UI outcome: the server grants
    // the author reply/update on their own post even with role permissions off.
    it('view + edit + post (incl. author of own post): shows reply button and edit menu item', async () => {
      const container = renderWithPermissions({reply: true, update: true})

      expect(await container.findByTestId('discussion-topic-reply')).toBeInTheDocument()
      expect(await editMenuItem(container)).toBeInTheDocument()
    })
  })

  it('should not render group menu button when there is child topics but no group set', () => {
    const container = setup({discussionTopic: Discussion.mock({groupSet: null})})

    expect(container.queryByTestId('groups-menu-btn')).toBeFalsy()
  })

  it('Should be able to close for comments', async () => {
    const {getByText, getByTestId} = setup(
      {
        discussionTopic: Discussion.mock({
          rootTopic: null,
          permissions: DiscussionPermissions.mock({closeForComments: true}),
        }),
      },
      updateDiscussionTopicMock({locked: true}),
    )
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    fireEvent.click(getByText('Close for Comments'))

    await waitFor(() =>
      expect(setOnSuccess).toHaveBeenCalledWith(
        'You have successfully updated the discussion topic.',
      ),
    )
  })

  it('Should be able to open for comments', async () => {
    const {getByText, getByTestId} = setup(
      {discussionTopic: Discussion.mock()},
      updateDiscussionTopicMock({locked: false}),
    )
    fireEvent.click(getByTestId('discussion-post-menu-trigger'))
    fireEvent.click(getByText('Open for Comments'))

    await waitFor(() =>
      expect(setOnSuccess).toHaveBeenCalledWith(
        'You have successfully updated the discussion topic.',
      ),
    )
  })

  it('should show discussion availability container for ungraded discussions', () => {
    const mockSections = [
      {
        id: 'U2VjdGlvbi00',
        _id: '1',
        userCount: 5,
        name: 'section 1',
      },
      {
        id: 'U2VjdGlvbi00',
        _id: '2',
        userCount: 99,
        name: 'section 2',
      },
    ]

    const container = setup({
      discussionTopic: Discussion.mock({
        assignment: null,
        courseSections: mockSections,
        delayedPostAt: '2021-03-21T00:00:00-06:00',
        lockAt: '2021-09-03T23:59:59-06:00',
        groupSet: null,
      }),
    })

    expect(container.getByTestId('view-availability-button')).toBeTruthy()
  })

  it('Renders an alert if initialPostRequiredForCurrentUser is true', () => {
    const props = {discussionTopic: Discussion.mock({initialPostRequiredForCurrentUser: true})}
    const container = setup(props)
    waitFor(() =>
      expect(
        container.queryByText(
          'You must post before seeing replies. Edit history will be available to instructors.',
        ),
      ).toBeInTheDocument(),
    )
  })

  it('Renders an alert if announcement will post in the future', () => {
    const props = {
      discussionTopic: Discussion.mock({
        isAnnouncement: true,
        delayedPostAt: '3000-01-01T13:40:50-06:00',
      }),
    }
    const container = setup(props)
    expect(
      container.getByText('This announcement will not be visible until Jan 1, 3000 7:40pm.'),
    ).toBeTruthy()
  })

  it('should not render author if author is null', async () => {
    const props = {discussionTopic: Discussion.mock({author: null})}
    const container = setup(props)
    const pillContainer = container.queryAllByTestId('pill-Author')
    expect(pillContainer).toEqual([])
  })

  it('should render editedBy if editor is different from author', async () => {
    const props = {
      discussionTopic: Discussion.mock({
        editor: {
          id: 'vfx5000',
          _id: '99',
          displayName: 'Eddy Tor',
          avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        },
      }),
    }
    const container = setup(props)
    const editedByTextElement = container.getByTestId('editedByText')
    expect(editedByTextElement.textContent).toEqual('Edited by Eddy Tor Apr 22, 2021 6:41pm')
    expect(container.queryByTestId('created-tooltip')).toBeFalsy()
  })

  it('should render plain edited if author is editor', async () => {
    const props = {
      discussionTopic: Discussion.mock({
        editor: {
          id: 'abc3244',
          _id: '1',
          name: 'Charles Xavier',
          avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
        },
      }),
    }
    const container = setup(props)
    expect(
      container.getByText('Last edited Apr 22, 2021 6:41pm', {exact: false}),
    ).toBeInTheDocument()
    expect(container.queryByTestId('created-tooltip')).toBeFalsy()
  })

  it('should not render edited info if no editor', async () => {
    const props = {
      discussionTopic: Discussion.mock({
        editor: null,
      }),
    }
    const container = setup(props)
    expect(container.queryByText(/Edited by/)).toBeFalsy()
    expect(container.queryByTestId('created-tooltip')).toBeFalsy()
  })

  describe('AvailableForUser', () => {
    it('topic is unavailable', () => {
      const props = {
        discussionTopic: Discussion.mock({
          availableForUser: false,
          title: 'This topic is unavailable',
        }),
      }
      const container = setup(props)
      expect(container.queryByText('This topic is unavailable')).toBeInTheDocument()
      expect(container.getByTestId('locked-discussion')).toBeInTheDocument()
    })

    it('topic is available', () => {
      const props = {
        discussionTopic: Discussion.mock({
          availableForUser: true,
          title: 'This topic is available',
        }),
      }
      const container = setup(props)
      expect(container.queryByText('This topic is available')).toBeInTheDocument()
      expect(container.queryByTestId('locked-discussion')).toBeNull()
    })
  })

  // Parity coverage for spec/selenium/discussions/discussion_topic_show_spec.rb
  // "student availability" context. The server (DiscussionTopic#locked_for?)
  // decides the lock shape; this component half renders the indicator text and
  // the body content. The override-vs-topic distinction (selenium 677 vs 691,
  // 684 vs 699) is purely server-side, so at the component level both rows in
  // each pair reduce to the same render given the same lock-shaped props.
  describe('discussion lock-state UI', () => {
    const COOL_BODY = 'a very cool discussion'

    // selenium row 672: unlocked discussion shows the body, no lock indicator.
    it('shows discussion body and no lock indicator for an unlocked discussion', async () => {
      const container = setup({
        discussionTopic: Discussion.mock({
          message: COOL_BODY,
          availableForUser: true,
          permissions: DiscussionPermissions.mock({reply: true}),
        }),
      })

      expect(await container.findByText(COOL_BODY)).toBeInTheDocument()
      expect(container.queryByTestId('locked-for-user')).toBeNull()
      expect(container.queryByTestId('discussion-topic-closed-for-comments')).toBeNull()
    })

    // selenium rows 677 & 691: locked by a future unlock_at (topic date in 677,
    // student-override date in 691). Server sends availableForUser=false plus the
    // "This topic is locked until ..." lockInformation. Component renders that
    // message and hides the body content.
    it('renders the "locked until" indicator and hides the body for a future-unlock lock', async () => {
      const lockedUntilMessage = 'This topic is locked until Jan 1, 3000 12:00am.'
      const container = setup({
        discussionTopic: Discussion.mock({
          message: COOL_BODY,
          availableForUser: false,
          lockInformation: lockedUntilMessage,
        }),
      })

      const lockAlert = await container.findByTestId('locked-for-user')
      expect(lockAlert).toHaveTextContent('This topic is locked until')
      expect(container.getByText(lockedUntilMessage)).toBeInTheDocument()
      // body content is replaced by the LockedDiscussion title, so it is hidden
      expect(container.queryByText(COOL_BODY)).toBeNull()
    })

    // selenium rows 684 & 699: locked by a past lock_at (topic date in 684,
    // student-override date in 699). Server keeps availableForUser=true but sets
    // permissions.reply=false. Component renders "This topic is closed for
    // comments." while the body content stays visible.
    it('renders the "closed for comments" indicator while still showing the body for a past lock', async () => {
      const container = setup({
        discussionTopic: Discussion.mock({
          message: COOL_BODY,
          availableForUser: true,
          permissions: DiscussionPermissions.mock({reply: false}),
        }),
      })

      expect(await container.findByText(COOL_BODY)).toBeInTheDocument()
      const closedMessage = await container.findByTestId('discussion-topic-closed-for-comments')
      expect(closedMessage).toHaveTextContent('This topic is closed for comments.')
      expect(container.queryByTestId('locked-for-user')).toBeNull()
    })
  })

  describe('Peer Reviews', () => {
    it('renders Peer Reviews button in the menu', () => {
      const props = {discussionTopic: Discussion.mock()}
      const {getByTestId, getByText} = setup(props)
      fireEvent.click(getByTestId('discussion-post-menu-trigger'))

      expect(getByText('Peer Reviews')).toBeTruthy()
    })

    it('renders with a due date', () => {
      const props = {discussionTopic: Discussion.mock()}
      const {getByText} = setup(props)

      expect(getByText('Peer review for Morty Smith Due: Mar 31, 2021 5:59am')).toBeTruthy()
    })

    it('renders with out a due date', () => {
      const props = {
        discussionTopic: Discussion.mock({
          assignment: Assignment.mock({
            peerReviews: PeerReviews.mock({dueAt: null}),
          }),
        }),
      }
      const {getByText} = setup(props)

      expect(getByText('Peer review for Morty Smith')).toBeTruthy()
    })

    it('hides the reviewee identity when peer reviews are anonymous', () => {
      const {container, getByText} = setup({
        discussionTopic: Discussion.mock({
          participant: {posted: true},
          assignment: {
            _id: '42',
            peerReviews: PeerReviews.mock({dueAt: null}),
            assessmentRequestsForCurrentUser: [
              {
                _id: 'assessment-anon',
                anonymizedUser: null,
                anonymousId: 'anon-xyz-123',
                workflowState: 'assigned',
              },
            ],
          },
        }),
      })

      expect(getByText(/Peer review for Anonymous Student/)).toBeInTheDocument()

      const link = container.querySelector('.discussions-peer-review a')
      expect(link.getAttribute('href')).toBe(
        '/courses/1/assignments/42/anonymous_submissions/anon-xyz-123',
      )
    })

    it('does not render peer reviews if there are not any', () => {
      const props = {
        discussionTopic: Discussion.mock({
          peerReviews: null,
          assessmentRequestsForCurrentUser: [],
        }),
      }
      const {queryByText} = setup(props)

      expect(queryByText('eer review for Morty Smith Due: Mar 31, 2021 5:59am')).toBeNull()
    })

    it('passes disabled=true to PeerReview when user has not posted', () => {
      const {container} = setup({
        discussionTopic: Discussion.mock({
          participant: {posted: false},
          assignment: {
            assessmentRequestsForCurrentUser: [
              {
                _id: 'assessment1',
                anonymizedUser: {
                  _id: 'user1',
                  displayName: 'Test User',
                },
                workflowState: 'assigned',
              },
            ],
          },
        }),
      })

      const peerReviewElements = container.querySelectorAll('.discussions-peer-review')
      expect(peerReviewElements.length).toBeGreaterThan(0)

      const links = container.querySelectorAll(
        'a[aria-disabled="true"], button[disabled], [data-interaction="disabled"]',
      )
      expect(links.length).toBeGreaterThan(0)
    })

    it('passes disabled=false to PeerReview when user has posted', () => {
      const {container} = setup({
        discussionTopic: Discussion.mock({
          participant: {posted: true},
          assignment: {
            assessmentRequestsForCurrentUser: [
              {
                _id: 'assessment1',
                anonymizedUser: {
                  _id: 'user1',
                  displayName: 'Test User',
                },
                workflowState: 'assigned',
              },
            ],
          },
        }),
      })

      const peerReviewElements = container.querySelectorAll('.discussions-peer-review')
      expect(peerReviewElements.length).toBeGreaterThan(0)

      const enabledLinks = container.querySelectorAll(
        '.discussions-peer-review a:not([aria-disabled="true"]):not([disabled])',
      )
      expect(enabledLinks.length).toBeGreaterThan(0)
    })

    describe('Checkpointed discussions with peer review', () => {
      it('passes disabled=true to PeerReview when reply_to_topic checkpoint is not complete', () => {
        const {container} = setup({
          discussionTopic: Discussion.mock({
            participant: {posted: false},
            assignment: {
              checkpoints: [{tag: 'reply_to_topic'}, {tag: 'reply_to_entry'}],
              assessmentRequestsForCurrentUser: [
                {
                  _id: 'assessment1',
                  user: {
                    _id: 'user1',
                    displayName: 'Test User',
                  },
                  workflowState: 'assigned',
                },
              ],
            },
          }),
          replyToTopicSubmission: {},
          replyToEntrySubmission: {submissionStatus: 'submitted'},
        })

        const peerReviewElements = container.querySelectorAll('.discussions-peer-review')
        expect(peerReviewElements.length).toBeGreaterThan(0)

        const links = container.querySelectorAll(
          'a[aria-disabled="true"], button[disabled], [data-interaction="disabled"]',
        )
        expect(links.length).toBeGreaterThan(0)
      })

      it('passes disabled=true to PeerReview when reply_to_entry checkpoint is not complete', () => {
        const {container} = setup({
          discussionTopic: Discussion.mock({
            participant: {posted: true},
            assignment: {
              checkpoints: [{tag: 'reply_to_topic'}, {tag: 'reply_to_entry'}],
              assessmentRequestsForCurrentUser: [
                {
                  _id: 'assessment1',
                  user: {
                    _id: 'user1',
                    displayName: 'Test User',
                  },
                  workflowState: 'assigned',
                },
              ],
            },
          }),
          replyToTopicSubmission: {submissionStatus: 'submitted'},
          replyToEntrySubmission: {},
        })

        const peerReviewElements = container.querySelectorAll('.discussions-peer-review')
        expect(peerReviewElements.length).toBeGreaterThan(0)

        const links = container.querySelectorAll(
          'a[aria-disabled="true"], button[disabled], [data-interaction="disabled"]',
        )
        expect(links.length).toBeGreaterThan(0)
      })

      it('passes disabled=false to PeerReview when both checkpoints are complete', () => {
        const {container} = setup({
          discussionTopic: Discussion.mock({
            participant: {posted: true},
            assignment: {
              checkpoints: [{tag: 'reply_to_topic'}, {tag: 'reply_to_entry'}],
              assessmentRequestsForCurrentUser: [
                {
                  _id: 'assessment1',
                  user: {
                    _id: 'user1',
                    displayName: 'Test User',
                  },
                  workflowState: 'assigned',
                },
              ],
            },
          }),
          replyToTopicSubmission: {submissionStatus: 'submitted'},
          replyToEntrySubmission: {submissionStatus: 'submitted'},
        })

        const peerReviewElements = container.querySelectorAll('.discussions-peer-review')
        expect(peerReviewElements.length).toBeGreaterThan(0)

        const enabledLinks = container.querySelectorAll(
          '.discussions-peer-review a:not([aria-disabled="true"]):not([disabled])',
        )
        expect(enabledLinks.length).toBeGreaterThan(0)
      })
    })

    describe('PodcastFeed Button', () => {
      afterEach(() => {
        // Clean up any podcast feed links added to document head
        const podcastLinks = document.querySelectorAll('link[type="application/rss+xml"]')
        podcastLinks.forEach(link => link.remove())
      })

      it('does not render when Discussion Podcast Feed is not present', () => {
        const {queryByTestId} = setup({discussionTopic: Discussion.mock()})
        expect(queryByTestId('post-rssfeed')).toBeNull()
      })

      it('renders when Discussion Podcast Feed is present', () => {
        const ln = document.createElement('link')
        ln.title = 'Discussion Podcast Feed'
        ln.type = 'application/rss+xml'
        ln.href = 'http://localhost:3000/feeds/topics/47/enrollment_mhumV2R51z5IsK.rss'
        document.head.append(ln)

        const {getByTestId} = setup({discussionTopic: Discussion.mock()})
        expect(getByTestId('post-rssfeed')).toBeTruthy()
      })
    })

    describe('Rubric', () => {
      it('Renders Add Rubric in the kabob menu if the user has permission', () => {
        const {getByTestId, getByText} = setup({discussionTopic: Discussion.mock()})
        fireEvent.click(getByTestId('discussion-post-menu-trigger'))
        expect(getByText('Add Rubric')).toBeInTheDocument()
      })

      it('Renders Show Rubric in the kabob menu if the user has permission', () => {
        const {getByTestId, getByText} = setup({
          discussionTopic: Discussion.mock({
            permissions: DiscussionPermissions.mock({
              addRubric: false,
            }),
          }),
        })
        fireEvent.click(getByTestId('discussion-post-menu-trigger'))
        expect(getByText('Show Rubric')).toBeInTheDocument()
      })

      it('Renders hidden add_rubric_url for form if the user has permission', () => {
        const {getByTestId} = setup({discussionTopic: Discussion.mock()})
        expect(getByTestId('add_rubric_url')).toBeTruthy()
      })

      it('Does Not Render hidden add_rubric_url for form if the user does not have permission', () => {
        const {queryByTestId} = setup({
          discussionTopic: Discussion.mock({
            permissions: DiscussionPermissions.mock({
              addRubric: false,
            }),
          }),
        })
        expect(queryByTestId('add_rubric_url')).toBeNull()
      })

      describe('Enhanced Rubrics', () => {
        beforeEach(() => {
          ENV.enhanced_rubrics_enabled = true
          ENV.ASSIGNMENT_ID = '1'
          ENV.COURSE_ID = '1'
          ENV.ai_rubrics_enabled = false
          ENV.rubric_self_assessment_ff_enabled = false
        })

        afterEach(() => {
          ENV.enhanced_rubrics_enabled = false
          delete ENV.ASSIGNMENT_ID
          delete ENV.COURSE_ID
          delete ENV.ai_rubrics_enabled
          delete ENV.rubric_self_assessment_ff_enabled
        })

        it('does not render add_rubric_url when enhanced rubrics is enabled', () => {
          const {queryByTestId} = setup({discussionTopic: Discussion.mock()})
          expect(queryByTestId('add_rubric_url')).toBeNull()
        })

        it('opens DisplayRubricModal when Add Rubric menu item is clicked', async () => {
          const {getByTestId, getByText, findByTestId} = setup({
            discussionTopic: Discussion.mock(),
          })

          fireEvent.click(getByTestId('discussion-post-menu-trigger'))
          fireEvent.click(getByText('Add Rubric'))

          const modal = await findByTestId('assignment-rubric-modal')
          expect(modal).toBeInTheDocument()
        })

        it('opens DisplayRubricModal when Show Rubric menu item is clicked', async () => {
          const {getByTestId, getByText, findByTestId} = setup({
            discussionTopic: Discussion.mock({
              permissions: DiscussionPermissions.mock({
                addRubric: false,
                showRubric: true,
              }),
            }),
          })

          fireEvent.click(getByTestId('discussion-post-menu-trigger'))

          await waitFor(() => {
            expect(getByText('Show Rubric')).toBeInTheDocument()
          })

          fireEvent.click(getByText('Show Rubric'))

          const modal = await findByTestId('assignment-rubric-modal')
          expect(modal).toBeInTheDocument()
        })

        it('does not open modal when clicking rubric menu without proper permissions', () => {
          const {queryByTestId} = setup({
            discussionTopic: Discussion.mock({
              permissions: DiscussionPermissions.mock({
                addRubric: false,
                showRubric: false,
              }),
            }),
          })

          // The menu item won't be present, so we just verify no modal appears
          expect(queryByTestId('assignment-rubric-modal')).not.toBeInTheDocument()
        })
      })
    })
  })

  describe('Discussion Summary', () => {
    it('should render the discussion summary button if user can summarize and summary is not enabled', () => {
      ENV.user_can_summarize = true
      ENV.discussion_summary_enabled = false
      const {queryByTestId} = setup({
        discussionTopic: Discussion.mock(),
      })

      expect(queryByTestId('summarize-button')).toBeTruthy()
    })

    it('should render discussion summary button with Close Summary if summary is enabled', () => {
      ENV.user_can_summarize = true
      ENV.discussion_summary_enabled = true
      const {queryByTestId} = setup({
        discussionTopic: Discussion.mock(),
      })

      expect(queryByTestId('summarize-button').textContent).toBe('Close Summary')
    })

    it('should not render the discussion summary button if user can not summarize', () => {
      ENV.user_can_summarize = false
      ENV.discussion_summary_enabled = false
      const {queryByTestId} = setup({
        discussionTopic: Discussion.mock(),
      })

      expect(queryByTestId('summarize-button')).toBeNull()
    })

    it('renders a summary', () => {
      ENV.discussion_summary_enabled = true
      ENV.user_can_summarize = true
      const {queryByTestId} = setup({
        discussionTopic: Discussion.mock(),
      })
      expect(queryByTestId('summary-loading')).toBeTruthy()
    })

    it('does not render a summary', () => {
      ENV.discussion_summary_enabled = false
      ENV.user_can_summarize = true
      const {queryAllByTestId} = setup({
        discussionTopic: Discussion.mock(),
      })
      expect(queryAllByTestId(/summary-.*/)).toEqual([])
    })
  })
})
