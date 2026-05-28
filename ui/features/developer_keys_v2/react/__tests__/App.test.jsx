/*
 * Copyright (C) 2022 - present Instructure, Inc.
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
import {render, act, fireEvent} from '@testing-library/react'
import App from '../App'

import * as FlashAlert from '@instructure/platform-alerts'
import fakeENV from '@canvas/test-utils/fakeENV'
import * as ConfirmationDialog from '@canvas/dialogs/react/ConfirmationDialog'

vi.mock('@instructure/platform-alerts', async () => {
  const actual = await vi.importActual('@instructure/platform-alerts')
  return {
    ...actual,
    showFlashAlert: vi.fn(() => vi.fn(() => {})),
    showFlashSuccess: vi.fn(() => vi.fn(() => {})),
  }
})

vi.mock('@canvas/dialogs/react/ConfirmationDialog', async () => {
  const actual = await vi.importActual('@canvas/dialogs/react/ConfirmationDialog')
  return {
    ...actual,
    showConfirmationDialog: vi.fn(),
  }
})

const makeKey = ({id, name, inherited_from = 'global', account_owns_binding = true}) => ({
  id,
  name,
  created_at: '2012-06-07T20:36:50Z',
  inherited_from,
  access_token_count: 0,
  developer_key_account_binding: {
    account_owns_binding,
    workflow_state: 'on',
  },
})

const siteAdminKeys = [
  makeKey({id: '1', name: 'Site Admin 1'}),
  makeKey({id: '2', name: 'Site Admin 2'}),
]
const parentKeys = [
  makeKey({
    id: '3',
    name: 'Parent 1',
    inherited_from: 'federated_parent',
    account_owns_binding: false,
  }),
  makeKey({
    id: '4',
    name: 'Parent 2',
    inherited_from: 'federated_parent',
    account_owns_binding: false,
  }),
]

const initialApplicationState = inheritedList => {
  return {
    createOrEditDeveloperKey: {
      isLtiKey: false,
      developerKeyCreateOrEditFailed: false,
      developerKeyCreateOrEditSuccessful: true,
      developerKeyCreateOrEditPending: false,
      developerKeyModalOpen: false,
      developerKey: {},
      editing: false,
    },
    listDeveloperKeyScopes: {
      availableScopes: {},
      listDeveloperKeyScopesPending: false,
      selectedScopes: [],
    },
    listDeveloperKeys: {
      listDeveloperKeysPending: false,
      listDeveloperKeysSuccessful: false,
      inheritedList,
      list: [],
      nextPage: 'http://...',
      inheritedNextPage: 'http://...',
      listInheritedDeveloperKeysPending: false,
      listInheritedDeveloperKeysSuccessful: false,
    },
  }
}
const renderApp = ({inheritedList, ...overrides}) => {
  const props = {
    applicationState: initialApplicationState(inheritedList),
    actions: {
      developerKeysModalOpen: () => {},
      createOrEditDeveloperKey: () => {},
      developerKeysModalClose: () => {},
      getRemainingDeveloperKeys: () => {},
      getRemainingInheritedDeveloperKeys: () => {},
      editDeveloperKey: () => {},
      listDeveloperKeyScopesSet: () => {},
      saveLtiToolConfiguration: () => {},
      ltiKeysSetLtiKey: () => {},
      resetLtiState: () => {},
      updateLtiKey: () => {},
      listDeveloperKeysReplace: () => {},
      makeVisibleDeveloperKey: () => {},
      setBindingWorkflowState: () => {},
      makeInvisibleDeveloperKey: () => {},
      activateDeveloperKey: () => {},
      deactivateDeveloperKey: () => {},
      deleteDeveloperKey: () => {},
      regenerateDeveloperKeySecret: () => async () => ({}),
    },
    store: {dispatch: () => {}},
    ctx: {
      params: {
        contextId: '',
      },
    },
    ...overrides,
  }
  const ref = React.createRef()
  return {
    ref,
    wrapper: render(<App {...props} ref={ref} />),
  }
}
describe('DeveloperKeys App', () => {
  let getByText
  let queryByText
  let getAllByRole
  let queryByTestId
  let queryByRole

  const setup = inheritedList => {
    const wrapper = renderApp({inheritedList}).wrapper
    getByText = wrapper.getByText
    queryByText = wrapper.queryByText
    getAllByRole = wrapper.getAllByRole
    queryByTestId = wrapper.queryByTestId
    queryByRole = wrapper.queryByRole
    // switch to inherited tab
    act(() => {
      fireEvent.click(getByText('Inherited'))
    })
  }

  beforeEach(() => {
    fakeENV.setup()
  })

  afterEach(() => {
    fakeENV.teardown()
  })

  describe('alerts', () => {
    it('shows info about new Apps page', () => {
      setup([])
      expect(getByText('LTI tool management is now live', {exact: false})).toBeInTheDocument()
    })

    describe('when user agent alert flag is disabled', () => {
      beforeEach(() => {
        fakeENV.setup({FEATURES: {developer_key_user_agent_alert: false}})
      })

      it('does not show user agent alert', () => {
        setup([])
        expect(
          queryByText('API requests now require the User-Agent header', {exact: false}),
        ).not.toBeInTheDocument()
      })
    })

    describe('when user agent alert flag is enabled', () => {
      beforeEach(() => {
        fakeENV.setup({FEATURES: {developer_key_user_agent_alert: true}})
      })

      it('shows user agent alert', () => {
        setup([])
        expect(
          getByText('API requests now require the User-Agent header', {exact: false}),
        ).toBeInTheDocument()
      })
    })

    describe('when account setting is set', () => {
      beforeEach(() => {
        fakeENV.setup({showApiGetWithBodyNotice: true})
      })

      it('shows get body alert', () => {
        setup([])
        expect(
          getByText('API GET requests with a body instead of query parameters will be blocked', {
            exact: false,
          }),
        ).toBeInTheDocument()
      })
    })

    describe('when account setting is not set', () => {
      beforeEach(() => {
        fakeENV.setup({showApiGetWithBodyNotice: false})
      })

      it('does not show get body alert', () => {
        setup([])
        expect(
          queryByText('API GET requests with a body instead of query parameters will be blocked', {
            exact: false,
          }),
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('inherited tab', () => {
    describe('when parent keys are present', () => {
      beforeEach(() => {
        fakeENV.setup({FEATURES: {developer_key_page_checkboxes: true}})
        setup([...parentKeys, ...siteAdminKeys])
      })

      it('renders Parent Keys heading', () => {
        expect(getByText('Consortium Parent Keys')).toBeInTheDocument()
      })

      it('renders parent keys table', () => {
        expect(queryByText(/Parent Inherited Developer Keys/)).toBeInTheDocument()
      })

      it('renders Global Keys heading', () => {
        expect(getByText('Global Keys')).toBeInTheDocument()
      })

      it('renders row per parent key', () => {
        parentKeys.forEach(key => expect(getByText(key.name)).toBeInTheDocument())
      })

      it('does not allow parent key state toggling', () => {
        const toggles = getAllByRole('checkbox')
        parentKeys.forEach(key => {
          expect(toggles.some(t => t.name === key.id && t.disabled)).toBe(true)
        })
      })
    })

    describe('when parent keys are not present', () => {
      beforeEach(() => {
        setup(siteAdminKeys)
      })

      it('does not render Parent Keys heading', () => {
        expect(queryByText('Consortium Parent Keys')).not.toBeInTheDocument()
      })

      it('does not render parent keys table', () => {
        expect(queryByText(/Parent Inherited Developer Keys/)).not.toBeInTheDocument()
      })

      it('does not render Global Keys heading', () => {
        expect(queryByText('Global Keys')).not.toBeInTheDocument()
      })
    })
  })

  describe('when developer keys saved ', () => {
    vi.useFakeTimers()
    afterAll(() => vi.useRealTimers())
    let ref
    beforeEach(() => {
      fakeENV.setup({FEATURES: {developer_key_page_checkboxes: true}})
      const inheritedList = [...parentKeys, ...siteAdminKeys]
      ref = renderApp({inheritedList}).ref
    })

    describe('with list of warnings', () => {
      beforeEach(() => {
        vi.clearAllMocks()
        vi.clearAllTimers()
        ref.current.developerKeySaveSuccessfulHandler(['warning1', 'warning2'])
      })
      it('Alert is shown for each warning message', () => {
        vi.runOnlyPendingTimers()
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(2)
      })
    })

    describe('with a warning', () => {
      beforeEach(() => {
        vi.clearAllMocks()
        vi.clearAllTimers()
        ref.current.developerKeySaveSuccessfulHandler('warning1')
      })
      it('Alert is shown for each warning message', () => {
        vi.runOnlyPendingTimers()
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    describe('without a warning (null)', () => {
      beforeEach(() => {
        vi.clearAllMocks()
        vi.clearAllTimers()
        ref.current.developerKeySaveSuccessfulHandler(null)
      })
      it('No alert is shown', () => {
        vi.runOnlyPendingTimers()
        expect(FlashAlert.showFlashAlert).not.toHaveBeenCalled()
      })
    })

    describe('without a warning (undefined)', () => {
      beforeEach(() => {
        vi.clearAllMocks()
        vi.clearAllTimers()
        ref.current.developerKeySaveSuccessfulHandler(undefined)
      })
      it('No Alert is shown', () => {
        vi.runOnlyPendingTimers()
        expect(FlashAlert.showFlashAlert).not.toHaveBeenCalled()
      })
    })

    describe('without a warning (empty array)', () => {
      beforeEach(() => {
        vi.clearAllMocks()
        vi.clearAllTimers()
        ref.current.developerKeySaveSuccessfulHandler([])
      })
      it('Alert is shown for each warning message', () => {
        vi.runOnlyPendingTimers()
        expect(FlashAlert.showFlashAlert).not.toHaveBeenCalled()
      })
    })
  })

  describe('regenerate secret functionality', () => {
    let ref
    const mockDeveloperKey = {
      id: '123',
      name: 'Test Key',
      api_key: 'abc12...',
    }

    beforeEach(() => {
      fakeENV.setup({FEATURES: {developer_key_regenerate_secret: true}})
      const inheritedList = siteAdminKeys
      ref = renderApp({inheritedList}).ref
      vi.clearAllMocks()
    })

    describe('handleRegenerateSecret', () => {
      it('calls regenerateDeveloperKeySecret action', async () => {
        const regeneratedKey = {
          ...mockDeveloperKey,
          api_key: 'newSecretKey123456789',
        }
        const mockRegenerateAction = vi.fn(() => async () => regeneratedKey)

        ref.current.props.actions.regenerateDeveloperKeySecret = mockRegenerateAction

        await act(async () => {
          await ref.current.handleRegenerateSecret(mockDeveloperKey)
        })

        expect(mockRegenerateAction).toHaveBeenCalledWith(mockDeveloperKey)
      })

      it('shows confirmation dialog with the regenerated secret', async () => {
        const regeneratedKey = {
          ...mockDeveloperKey,
          api_key: 'newSecretKey123456789',
        }
        const mockRegenerateAction = vi.fn(() => async () => regeneratedKey)
        ref.current.props.actions.regenerateDeveloperKeySecret = mockRegenerateAction

        await act(async () => {
          await ref.current.handleRegenerateSecret(mockDeveloperKey)
        })

        expect(ConfirmationDialog.showConfirmationDialog).toHaveBeenCalled()
        const callArgs = ConfirmationDialog.showConfirmationDialog.mock.calls[0][0]
        expect(callArgs.label).toContain('Secret Regenerated Successfully')
        expect(callArgs.confirmText).toBe('Close')
      })

      it('includes warning message in the dialog', async () => {
        const regeneratedKey = {
          ...mockDeveloperKey,
          api_key: 'newSecretKey123456789',
        }
        const mockRegenerateAction = vi.fn(() => async () => regeneratedKey)
        ref.current.props.actions.regenerateDeveloperKeySecret = mockRegenerateAction

        await act(async () => {
          await ref.current.handleRegenerateSecret(mockDeveloperKey)
        })

        expect(ConfirmationDialog.showConfirmationDialog).toHaveBeenCalled()
        const callArgs = ConfirmationDialog.showConfirmationDialog.mock.calls[0][0]
        // Verify the dialog body contains the warning
        expect(callArgs.body).toBeDefined()
      })

      it('handles errors gracefully', async () => {
        const mockError = new Error('Network error')
        const mockRegenerateAction = vi.fn(() => async () => {
          throw mockError
        })
        ref.current.props.actions.regenerateDeveloperKeySecret = mockRegenerateAction

        await act(async () => {
          await ref.current.handleRegenerateSecret(mockDeveloperKey)
        })

        // Should not show confirmation dialog on error
        expect(ConfirmationDialog.showConfirmationDialog).not.toHaveBeenCalled()
      })

      it('dispatches the action with the store dispatcher', async () => {
        const regeneratedKey = {
          ...mockDeveloperKey,
          api_key: 'newSecretKey123456789',
        }
        const mockDispatch = vi.fn()
        const mockRegenerateAction = vi.fn(() => async dispatch => {
          dispatch()
          return regeneratedKey
        })

        ref.current.props.store.dispatch = mockDispatch
        ref.current.props.actions.regenerateDeveloperKeySecret = mockRegenerateAction

        await act(async () => {
          await ref.current.handleRegenerateSecret(mockDeveloperKey)
        })

        expect(mockDispatch).toHaveBeenCalled()
      })
    })

    describe('with feature flag disabled', () => {
      beforeEach(() => {
        fakeENV.setup({FEATURES: {developer_key_regenerate_secret: false}})
      })

      it('does not show regenerate button when feature flag is off', () => {
        const inheritedList = siteAdminKeys
        const {wrapper} = renderApp({inheritedList})
        // The regenerate button should not be present
        // This is more of an integration test verifying the feature flag behavior
        expect(wrapper.queryByLabelText(/regenerate secret/i)).not.toBeInTheDocument()
      })
    })

    describe('in site admin context', () => {
      beforeEach(() => {
        fakeENV.setup({FEATURES: {developer_key_regenerate_secret: true}})
      })

      it('does not show regenerate button for site admin keys', () => {
        const inheritedList = siteAdminKeys
        const {wrapper} = renderApp({
          inheritedList,
          ctx: {params: {contextId: 'site_admin'}},
        })
        expect(wrapper.queryByTestId('regenerate-secret')).not.toBeInTheDocument()
      })
    })
  })
})
