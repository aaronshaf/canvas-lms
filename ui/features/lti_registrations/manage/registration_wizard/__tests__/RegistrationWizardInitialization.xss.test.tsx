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

// Regression coverage for XSS via the LTI 1.1 informational message in
// RegistrationWizardInitialization. The component injects `props.accountId`
// directly into a wrapper `<a href=...>` template that is rendered through
// dangerouslySetInnerHTML. Without DOMPurify sanitization, an
// attacker-controlled accountId can break out of the (unquoted) href
// attribute and land arbitrary inline event handlers (e.g. onmouseover) in
// the live DOM.
//
// "Safety" assertion is "no event handler attribute survives in the
// rendered DOM" — DOMPurify legitimately allows <a> tags but strips on*
// handlers, so the link may appear while remaining inert.

import {cleanup, render, screen} from '@testing-library/react'
import React from 'react'
import {ZAccountId} from '../../model/AccountId'
import {RegistrationWizardModal} from '../RegistrationWizardModal'
import {
  openRegistrationWizard,
  useRegistrationModalWizardState,
} from '../RegistrationWizardModalState'
import {mockJsonUrlWizardService} from './helpers'
import {
  mockDynamicRegistrationWizardService,
  mockLti1p3RegistrationWizardService,
} from '../../dynamic_registration_wizard/__tests__/helpers'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlersInDoc = () => {
  document.body.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('RegistrationWizardInitialization — XSS regression', () => {
  let error: (...data: any[]) => void
  let warn: (...data: any[]) => void

  beforeAll(() => {
    error = console.error
    warn = console.warn
    console.error = vi.fn()
    console.warn = vi.fn()
  })

  afterAll(() => {
    console.error = error
    console.warn = warn
  })

  const fetchRegistrationToken = vi.fn().mockImplementation(() => new Promise(() => {}))

  const emptyServices = {
    jsonUrlWizardService: mockJsonUrlWizardService({}),
    dynamicRegistrationWizardService: mockDynamicRegistrationWizardService({
      fetchRegistrationToken,
    }),
    lti1p3RegistrationWizardService: mockLti1p3RegistrationWizardService({}),
  }

  beforeEach(() => {
    delete (window as any).__xss_fired
    openRegistrationWizard({
      dynamicRegistrationUrl: '',
      lti_version: '1p1',
      isInstructureTool: undefined,
      showBlankConfigurationMessage: undefined,
      method: 'dynamic_registration',
      registering: false,
      jsonUrl: '',
      jsonCode: '',
      onSuccessfulInstallation: vi.fn(),
      jsonFetch: {_tag: 'initial'},
    })
  })

  afterEach(() => {
    useRegistrationModalWizardState.getState().close()
    cleanup()
    delete (window as any).__xss_fired
  })

  const renderModal = (accountId: string) => {
    const parsed = ZAccountId.parse(accountId)
    render(<RegistrationWizardModal accountId={parsed} {...emptyServices} />)
    // Sanity: the 1.1 informational message must actually render so that
    // these assertions are observing the sink we care about.
    expect(screen.getByText(/Thank you for your interest in 1\.1/i)).toBeInTheDocument()
  }

  it('strips inline event handlers injected via accountId in the 1.1 message', () => {
    // accountId interpolates raw into an <a href=...> attribute (no quotes),
    // so a payload that breaks out of the href and adds an onmouseover handler
    // would otherwise render a live event handler.
    renderModal('1 onmouseover=window.__xss_fired=true x=')

    expectNoEventHandlersInDoc()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags injected via accountId in the 1.1 message', () => {
    renderModal('1><script>window.__xss_fired=true</script><a href=')

    expect(document.body.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs injected via accountId in the 1.1 message', () => {
    // Break out of the bare href= (no quotes) and replace with a javascript: URL.
    renderModal('javascript:window.__xss_fired=true// ')

    document.body.querySelectorAll('a[href]').forEach(a => {
      expect(a.getAttribute('href') || '').not.toMatch(/^\s*javascript:/i)
    })
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders the legitimate informational message for a benign accountId', () => {
    renderModal('123')

    expect(screen.getByText(/legacy apps page/i)).toBeInTheDocument()
  })
})
