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

// Regression coverage for the instructions `dangerouslySetInnerHTML` sink
// in ManageThreadedReplies. The string is built from an I18n.t template
// with a `<i>$1</i>` wrapper and reaches the DOM via
// dangerouslySetInnerHTML. CFA-863 wraps the sink with the shared
// DOMPurify helper as defense-in-depth so a hostile locale override or
// future template change cannot smuggle event-handler attributes into
// the rendered DOM.
//
// The modal containing the sink is gated on internal isOpen state. We
// stub useState's initial value so the modal mounts open, mock the store
// hook, and replace I18n.t with a payload-emitting stub so the sink sees
// adversarial HTML.

import React from 'react'
import {render} from '@testing-library/react'

let xssPayload = ''

vi.mock('@canvas/i18n', () => ({
  useScope: () => ({
    t: (...args: unknown[]) => {
      const opts = args[args.length - 1]
      if (opts && typeof opts === 'object' && 'wrappers' in (opts as object)) {
        return xssPayload
      }
      const key = args[0]
      return typeof key === 'string' ? key : ''
    },
  }),
}))

vi.mock('../../../hooks/useManageThreadedRepliesStore', () => ({
  useManageThreadedRepliesStore: (selector: (s: unknown) => unknown) =>
    selector({
      initialize: () => {},
      discussionStates: {},
      setModalClose: () => {},
      loading: false,
      validate: () => true,
      errorCount: 0,
      isDirty: false,
    }),
}))

vi.mock('../DiscussionTable', () => ({
  default: () => <div data-testid="discussion-table-stub" />,
}))

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@apollo/client')
  return {
    ...actual,
    gql: () => '',
    useQuery: () => ({data: {legacyNode: {name: 'Course'}}}),
  }
})

vi.mock('@instructure/platform-alerts', () => ({
  AlertManagerContext: React.createContext({
    setOnFailure: () => {},
    setOnSuccess: () => {},
  }),
}))

// The modal's body is gated on internal isOpen state. Replace the modal
// shell with a transparent container so the sink renders unconditionally.
vi.mock('@instructure/ui-modal', () => {
  const Modal = ({children}: {children: React.ReactNode}) => <div>{children}</div>
  Modal.Header = ({children}: {children: React.ReactNode}) => <div>{children}</div>
  Modal.Body = ({children}: {children: React.ReactNode}) => <div>{children}</div>
  Modal.Footer = ({children}: {children: React.ReactNode}) => <div>{children}</div>
  return {Modal}
})

import ManageThreadedReplies from '../ManageThreadedReplies'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderModal = () => render(<ManageThreadedReplies courseId="1" discussions={[{id: '1'}]} />)

describe('ManageThreadedReplies — XSS regression', () => {
  beforeEach(() => {
    delete (window as unknown as {__xss_fired?: unknown}).__xss_fired
    xssPayload = ''
  })

  afterEach(() => {
    delete (window as unknown as {__xss_fired?: unknown}).__xss_fired
  })

  it('strips inline event handlers from the instructions sink', () => {
    xssPayload = '<img src=x onerror="window.__xss_fired = true">attack'
    const {baseElement} = renderModal()
    // ui-modal portals into document.body, so query the full baseElement
    expectNoEventHandlers(baseElement)
    expect(baseElement.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as unknown as {__xss_fired?: unknown}).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the instructions sink', () => {
    xssPayload = 'before<script>window.__xss_fired = true</script>after'
    const {baseElement} = renderModal()
    expect(baseElement.querySelector('script')).toBeNull()
    expect(baseElement.innerHTML).not.toMatch(/<script/i)
    expect((window as unknown as {__xss_fired?: unknown}).__xss_fired).toBeUndefined()
  })

  it('renders benign italic + strong tags unchanged', () => {
    xssPayload = '<i>info</i> and <strong>bold</strong>'
    const {baseElement} = renderModal()
    expect(baseElement.querySelectorAll('i').length).toBeGreaterThan(0)
    expect(baseElement.querySelectorAll('strong').length).toBeGreaterThan(0)
    expectNoEventHandlers(baseElement)
  })
})
