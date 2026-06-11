/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

// These tests cover behavior previously only verified in Selenium:
//   spec/selenium/discussions/discussion_topic_show_spec.rb:249
//   "does not show the switch to individual posts button"
//
// The "Switch to individual posts" link (rendered by SwitchToIndividualPostsLink
// as <Link id="switch-to-individual-posts-link">) is only shown by
// DiscussionPostToolbar when BOTH isSpeedGraderInTopUrl is true AND the
// discussion_checkpoints feature flag is enabled. On the regular discussion
// show page (NOT SpeedGrader) for a checkpointed graded discussion, the link
// must NOT be rendered. We exercise the real gating condition by rendering
// DiscussionPostToolbar (which owns the SwitchToIndividualPostsLink) and toggling
// isSpeedGraderInTopUrl, the prop/module value that drives the behavior.

import {MockedProvider} from '@apollo/client/testing'
import {AlertManagerContext} from '@instructure/platform-alerts'
import {render} from '@testing-library/react'
import React from 'react'
import {DiscussionManagerUtilityContext, SearchContext} from '../../../utils/constants'
import {DiscussionPostToolbar} from '../../DiscussionPostToolbar/DiscussionPostToolbar'
import fakeENV from '@canvas/test-utils/fakeENV'

// isSpeedGraderInTopUrl is a module-level constant evaluated from
// window.top.location.href at import time. We mock it with a mutable holder so
// each test can simulate "in SpeedGrader" vs. "on the discussion show page".
const speedGraderState = {value: false}

vi.mock('../../../utils/constants', async () => {
  const actual = await vi.importActual('../../../utils/constants')
  return {
    ...actual,
    get isSpeedGraderInTopUrl() {
      return speedGraderState.value
    },
  }
})

vi.mock('@canvas/util/globalUtils', () => ({
  assignLocation: vi.fn(),
  openWindow: vi.fn(),
}))

vi.mock('../../../utils', async () => ({
  ...(await vi.importActual('../../../utils')),
  responsiveQuerySizes: () => ({desktop: {maxWidth: '1024px'}}),
}))

const onFailureStub = vi.fn()
const onSuccessStub = vi.fn()

beforeEach(() => {
  fakeENV.setup()
  speedGraderState.value = false
  window.matchMedia = vi.fn().mockImplementation(() => {
    return {
      matches: true,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }
  })

  ENV.course_id = '1'
  ENV.DISCUSSION = {
    preferences: {
      discussions_splitscreen_view: false,
    },
  }
})

afterEach(() => {
  fakeENV.teardown()
  vi.clearAllMocks()
})

const setup = props =>
  render(
    <MockedProvider mocks={[]} addTypename={false}>
      <AlertManagerContext.Provider
        value={{setOnFailure: onFailureStub, setOnSuccess: onSuccessStub}}
      >
        <DiscussionManagerUtilityContext.Provider value={{translationLanguages: {current: []}}}>
          <SearchContext.Provider
            value={{setAllThreadsStatus: vi.fn(), setExpandedThreads: vi.fn()}}
          >
            <DiscussionPostToolbar onSwitchLinkClick={vi.fn()} {...props} />
          </SearchContext.Provider>
        </DiscussionManagerUtilityContext.Provider>
      </AlertManagerContext.Provider>
    </MockedProvider>,
  )

describe('SwitchToIndividualPostsLink visibility', () => {
  describe('for a checkpointed graded discussion NOT in SpeedGrader', () => {
    it('does not render the "switch to individual posts" link', () => {
      // Discussion show page (not SpeedGrader) with checkpoints enabled.
      speedGraderState.value = false
      ENV.FEATURES = {discussion_checkpoints: true}

      const {container} = setup({isCheckpointed: true, isGraded: true})

      expect(container.querySelector('#switch-to-individual-posts-link')).toBeNull()
    })
  })

  describe('in SpeedGrader with checkpoints enabled (positive control)', () => {
    it('renders the "switch to individual posts" link', () => {
      speedGraderState.value = true
      ENV.FEATURES = {discussion_checkpoints: true}

      const {container} = setup({isCheckpointed: true, isGraded: true})

      expect(container.querySelector('#switch-to-individual-posts-link')).not.toBeNull()
    })
  })

  describe('in SpeedGrader without checkpoints (control)', () => {
    it('does not render the link when discussion_checkpoints is disabled', () => {
      speedGraderState.value = true
      ENV.FEATURES = {discussion_checkpoints: false}

      const {container} = setup({isCheckpointed: false, isGraded: true})

      expect(container.querySelector('#switch-to-individual-posts-link')).toBeNull()
    })
  })
})
