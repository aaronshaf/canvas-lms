/*
 * Copyright (C) 2018 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute and/or modify under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react'
import {render, screen} from '@testing-library/react'
import DeveloperKeyFormFields from '../NewKeyForm'
import fakeENV from '@canvas/test-utils/fakeENV'

import type {DeveloperKey} from 'features/developer_keys_v2/model/api/DeveloperKey'
import type {NewKeyFormProps} from '../NewKeyForm'
import {QueryClientProvider} from '@tanstack/react-query'
import {queryClient} from '@instructure/platform-query'

const developerKey: DeveloperKey = {
  access_token_count: 77,
  account_name: 'bob account',
  api_key: 'rYcJ7LnUbSAuxiMh26tXTSkaYWyfRPh2lr6FqTLqx0FRsmv44EVZ2yXC8Rgtabc3',
  created_at: '2018-02-09T20:36:50Z',
  email: 'bob@myemail.com',
  icon_url: 'http://my_image.com',
  id: '10000000000004',
  name: 'Atomic fireball',
  notes: 'all the notas',
  redirect_uri: 'http://my_redirect_uri.com',
  redirect_uris: 'http://another.redirect.com\nhttp://another.one.com',
  vendor_code: 'b3w9w9bf',
  test_cluster_only: false,
  allow_includes: false,
  scopes: [],
  require_scopes: null,
  tool_configuration: null,
  client_credentials_audience: null,
  is_lti_key: false,
  is_lti_registration: false,
}

function defaultProps(): NewKeyFormProps {
  return {
    availableScopes: {},
    availableScopesPending: false,
    dispatch: () => {},
    listDeveloperKeyScopesSet: () => {},
    editing: false,
    tool_configuration: {
      oidc_initiation_url: undefined,
    },
    showRequiredMessages: false,
    showMissingRedirectUrisMessage: undefined,
    updateToolConfiguration: () => {},
    updateToolConfigurationUrl: () => {},
    updateDeveloperKey: () => {},
    toolConfigurationUrl: null,
    configurationMethod: '',
    updateConfigurationMethod: () => {},
    hasRedirectUris: false,
    syncRedirectUris: () => {},
    isRedirectUriRequired: false,
    isLtiKey: false,
    hasInvalidRedirectUris: false,
    contextId: '1',
    developerKey: {
      access_token_count: 0,
      account_name: '',
      api_key: '',
      created_at: '',
      email: '',
      icon_url: '',
      id: '',
      name: '',
      notes: '',
      redirect_uri: '',
      redirect_uris: '',
      vendor_code: '',
      test_cluster_only: false,
      allow_includes: false,
      scopes: [],
      require_scopes: null,
      tool_configuration: null,
      client_credentials_audience: null,
      is_lti_key: false,
      is_lti_registration: false,
    },
  }
}

function renderComponent(
  devKey: DeveloperKey,
  isLtiKey: boolean,
  extraProps: Partial<NewKeyFormProps> = {},
) {
  const props = {...defaultProps(), developerKey: devKey, isLtiKey, ...extraProps}
  return render(
    <QueryClientProvider client={queryClient}>
      <DeveloperKeyFormFields {...props} />
    </QueryClientProvider>,
  )
}

describe('DeveloperKeyFormFields', () => {
  beforeEach(() => {
    fakeENV.setup({
      FEATURES: {},
      validLtiScopes: {},
    })
  })

  afterEach(() => {
    fakeENV.teardown()
  })

  it('populates the key name', () => {
    const {getByTestId} = renderComponent(developerKey, false)
    const input = getByTestId('key-name-input')
    expect(input).toHaveValue(developerKey.name)
  })

  it('populates the key owner email', () => {
    const {getByTestId} = renderComponent(developerKey, false)
    const input = getByTestId('owner-email-input')
    expect(input).toHaveValue(developerKey.email)
  })

  it('populates the key legacy redirect uri', () => {
    const {getByTestId} = renderComponent(developerKey, false)
    const input = getByTestId('legacy-redirect-uri-input')
    expect(input).toHaveValue(developerKey.redirect_uri)
  })

  it('populates the key redirect uris', () => {
    const {getByTestId} = renderComponent(developerKey, false)
    const textarea = getByTestId('redirect-uris-input')
    expect(textarea).toHaveValue(developerKey.redirect_uris)
  })

  it('populates the key vendor code', () => {
    const {getByTestId} = renderComponent(developerKey, false)
    const input = getByTestId('vendor-code-input')
    expect(input).toHaveValue(developerKey.vendor_code)
  })

  it('populates the key icon URL', () => {
    const {getByTestId} = renderComponent(developerKey, false)
    const input = getByTestId('icon-url-input')
    expect(input).toHaveValue(developerKey.icon_url)
  })

  it('populates the key notes', () => {
    const {getByTestId} = renderComponent(developerKey, false)
    const textarea = getByTestId('notes-input')
    expect(textarea).toHaveValue(developerKey.notes)
  })

  it('does not populate the key test_cluster_only without ENV set', () => {
    const {queryByTestId} = renderComponent(developerKey, false)
    expect(queryByTestId('test-cluster-only-checkbox')).not.toBeInTheDocument()
  })

  it('populates the key test_cluster_only when ENV is set', () => {
    fakeENV.setup({
      ...window.ENV,
      enableTestClusterChecks: true,
    })
    const {getByTestId} = renderComponent(developerKey, false)
    const checkbox = getByTestId('test-cluster-only-checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  describe('when isLtiKey is true', () => {
    it('does not include legacy redirect uri', () => {
      const {queryByTestId} = renderComponent(developerKey, true)
      expect(queryByTestId('legacy-redirect-uri-input')).not.toBeInTheDocument()
    })

    it('does not include vendor code', () => {
      const {queryByTestId} = renderComponent(developerKey, true)
      expect(queryByTestId('vendor-code-input')).not.toBeInTheDocument()
    })

    it('does not include icon URL', () => {
      const {queryByTestId} = renderComponent(developerKey, true)
      expect(queryByTestId('icon-url-input')).not.toBeInTheDocument()
    })

    it('includes redirect uris', () => {
      const {getByTestId} = renderComponent(developerKey, true)
      expect(getByTestId('redirect-uris-input')).toBeInTheDocument()
    })

    it('includes key name', () => {
      const {getByTestId} = renderComponent(developerKey, true)
      const input = getByTestId('key-name-input')
      expect(input).toHaveValue(developerKey.name)
    })

    it('includes owner email', () => {
      const {getByTestId} = renderComponent(developerKey, true)
      const input = getByTestId('owner-email-input')
      expect(input).toHaveValue(developerKey.email)
    })

    it('includes notes', () => {
      const {getByTestId} = renderComponent(developerKey, true)
      const textarea = getByTestId('notes-input')
      expect(textarea).toHaveValue(developerKey.notes)
    })

    it('renders the tool configuration form', () => {
      const {getByText, getByRole} = renderComponent(developerKey, true)
      expect(getByText('Developer Key Settings')).toBeInTheDocument()
      expect(getByRole('combobox', {name: /method/i})).toBeInTheDocument()
    })
  })

  describe('when isLtiKey is false', () => {
    it('renders the developer key scopes form', () => {
      const {getByText} = renderComponent(developerKey, false)
      const enforceScopes = document.querySelector('[data-automation="enforce_scopes"]')
      expect(enforceScopes).toBeInTheDocument()
      expect(getByText(/allow include parameters/i)).toBeInTheDocument()
    })
  })

  describe('redirect URIs field', () => {
    it('renders as optional when isRedirectUriRequired is false', () => {
      const {getByText, queryByText} = renderComponent(developerKey, true, {
        isRedirectUriRequired: false,
      })
      expect(getByText('Redirect URIs:')).toBeInTheDocument()
      expect(queryByText('Redirect URIs: *')).not.toBeInTheDocument()
    })

    it('renders as required when isRedirectUriRequired is true', () => {
      const {getByLabelText} = renderComponent(developerKey, true, {isRedirectUriRequired: true})
      expect(getByLabelText('Redirect URIs: *')).toBeInTheDocument()
    })
  })

  describe('UTID Selector', () => {
    describe('when feature flag is enabled', () => {
      it('shows UTID selector for API keys', () => {
        const {getByTestId} = renderComponent(developerKey, false, {
          contextId: '1',
        })
        expect(getByTestId('utid-selector')).toBeInTheDocument()
      })

      it('does not show UTID selector for LTI keys', () => {
        const {queryByTestId} = renderComponent(developerKey, true, {
          contextId: '1',
        })
        expect(queryByTestId('utid-selector')).not.toBeInTheDocument()
      })
    })
  })

  describe('legacy Redirect URI field', () => {
    it('renders when developerKey.redirect_uri is non-empty', () => {
      const {getByTestId} = renderComponent(developerKey, false)
      expect(getByTestId('legacy-redirect-uri-input')).toBeInTheDocument()
    })

    it('does not render when developerKey.redirect_uri is null', () => {
      const key = {...developerKey, redirect_uri: null}
      const {queryByTestId} = renderComponent(key, false)
      expect(queryByTestId('legacy-redirect-uri-input')).not.toBeInTheDocument()
    })

    it('does not render when developerKey.redirect_uri is empty string', () => {
      const key = {...developerKey, redirect_uri: ''}
      const {queryByTestId} = renderComponent(key, false)
      expect(queryByTestId('legacy-redirect-uri-input')).not.toBeInTheDocument()
    })
  })

  describe('Redirect URIs help text', () => {
    it('renders the exact-match guidance below the redirect_uris textarea', () => {
      const {getByTestId} = renderComponent(developerKey, false)
      expect(getByTestId('redirect-uris-help-text')).toHaveTextContent(
        /must match exactly, including casing, protocol, host, port, path, and query string/,
      )
    })

    it('mentions the 64-URI cap', () => {
      const {getByTestId} = renderComponent(developerKey, false)
      expect(getByTestId('redirect-uris-help-text')).toHaveTextContent(
        /Up to 64 redirect URIs are allowed/,
      )
    })
  })

  describe('64-URI count validation', () => {
    it('does not show an error when within the cap', () => {
      const key = {
        ...developerKey,
        redirect_uris: Array.from({length: 64}, (_, i) => `https://example.com/${i}`).join('\n'),
      }
      const {queryByText} = renderComponent(key, false)
      expect(queryByText(/cannot have more than 64 redirect URIs/)).not.toBeInTheDocument()
    })

    it('shows an error message when more than 64 URIs are entered', () => {
      const key = {
        ...developerKey,
        redirect_uris: Array.from({length: 65}, (_, i) => `https://example.com/${i}`).join('\n'),
      }
      const {getByText} = renderComponent(key, false)
      expect(
        getByText(/cannot have more than 64 redirect URIs\. Please remove some entries/),
      ).toBeInTheDocument()
    })
  })

  describe('inactive redirect URIs', () => {
    it('does not render the section when there are no inactive URIs', () => {
      const {queryByTestId} = renderComponent(developerKey, false)
      expect(queryByTestId('inactive-redirect-uris')).not.toBeInTheDocument()
    })

    it('does not render the section when all_redirect_uris contains only active entries', () => {
      const key = {
        ...developerKey,
        all_redirect_uris: [
          {
            redirect_uri: 'https://active.example.com/',
            last_used_at: '2026-01-01T00:00:00Z',
            workflow_state: 'active' as const,
          },
        ],
      }
      const {queryByTestId} = renderComponent(key, false)
      expect(queryByTestId('inactive-redirect-uris')).not.toBeInTheDocument()
    })

    it('renders the section with an explanation when inactive URIs are present', () => {
      const key = {
        ...developerKey,
        all_redirect_uris: [
          {
            redirect_uri: 'https://stale.example.com/',
            last_used_at: null,
            workflow_state: 'inactive' as const,
          },
        ],
      }
      const {getByTestId} = renderComponent(key, false)
      expect(getByTestId('inactive-redirect-uris')).toHaveTextContent(
        /automatically de-activated because they have not been used recently/,
      )
    })

    it('shows each inactive URI in a list', () => {
      const key = {
        ...developerKey,
        all_redirect_uris: [
          {
            redirect_uri: 'https://stale-a.example.com/',
            last_used_at: '2026-01-01T00:00:00Z',
            workflow_state: 'inactive' as const,
          },
          {
            redirect_uri: 'https://stale-b.example.com/',
            last_used_at: null,
            workflow_state: 'inactive' as const,
          },
        ],
      }
      const {getByTestId} = renderComponent(key, false)
      const list = getByTestId('inactive-redirect-uris-list')
      expect(list).toHaveTextContent('https://stale-a.example.com/')
      expect(list).toHaveTextContent('https://stale-b.example.com/')
    })

    it('only shows inactive entries from all_redirect_uris', () => {
      const key = {
        ...developerKey,
        all_redirect_uris: [
          {
            redirect_uri: 'https://active.example.com/',
            last_used_at: '2026-01-01T00:00:00Z',
            workflow_state: 'active' as const,
          },
          {
            redirect_uri: 'https://stale.example.com/',
            last_used_at: null,
            workflow_state: 'inactive' as const,
          },
        ],
      }
      const {getByTestId} = renderComponent(key, false)
      const list = getByTestId('inactive-redirect-uris-list')
      expect(list).toHaveTextContent('https://stale.example.com/')
      expect(list).not.toHaveTextContent('https://active.example.com/')
    })

    it("renders 'never' for entries with no last_used_at", () => {
      const key = {
        ...developerKey,
        all_redirect_uris: [
          {
            redirect_uri: 'https://stale.example.com/',
            last_used_at: null,
            workflow_state: 'inactive' as const,
          },
        ],
      }
      const {getByTestId} = renderComponent(key, false)
      expect(getByTestId('inactive-redirect-uris-list')).toHaveTextContent(/last used: never/)
    })

    it('includes the last_used_at timestamp when present', () => {
      const key = {
        ...developerKey,
        all_redirect_uris: [
          {
            redirect_uri: 'https://stale.example.com/',
            last_used_at: '2026-01-15T10:30:00Z',
            workflow_state: 'inactive' as const,
          },
        ],
      }
      const {getByTestId} = renderComponent(key, false)
      expect(getByTestId('inactive-redirect-uris-list')).toHaveTextContent(/last used:/)
    })
  })
})
