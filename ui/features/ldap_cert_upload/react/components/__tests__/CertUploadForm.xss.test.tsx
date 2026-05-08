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

// Regression coverage for XSS via the LDAP cert-upload validation panels.
// The CertUploadForm renders two `dangerouslySetInnerHTML` sinks that wrap
// translated strings — one in the empty/no-cert state, one in the
// cert-loaded state. Both inject HTML via `I18n.t(..., {wrapper: ...})`.
// Translations are pulled from external locale catalogs (Transifex etc.),
// so a hostile or compromised translation could smuggle event handlers,
// `<script>`, or javascript: URIs into the rendered DOM. CFA-871 wraps
// each sink with the shared DOMPurify wrapper as defense-in-depth.
//
// Strategy: mock `@canvas/i18n` so `t()` returns whatever payload the test
// supplies, mock the cert parsing/file-drop UI so the two render branches
// are reachable without driving a real X509Certificate parse. The
// DOMPurify wrapper at the sink should defang every payload.

import {render} from '@testing-library/react'
import React from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

// Only the two "Drag and drop ..." strings flow through the
// `dangerouslySetInnerHTML` sinks. Substituting *every* translation with
// the hostile payload would also stuff escaped text into adjacent <dt>s
// and button labels, polluting the assertions. Restrict the override to
// the two sink keys.
const SINK_KEYS = new Set([
  'Drag and drop or *browse your files* to replace',
  'Drag and drop or *browse your files*',
])

let payload = ''

vi.mock('@canvas/i18n', () => ({
  useScope: () => ({
    t: (key: string, _opts?: Record<string, unknown>) => (SINK_KEYS.has(key) ? payload : key),
  }),
}))

// Bypass real cert parsing so we can reach the cert-present render branch
// just by setting `inputField.value`.
vi.mock('@peculiar/x509', () => ({
  X509Certificate: vi.fn().mockImplementation(() => ({
    subject: 'CN=test',
    notBefore: new Date('2020-01-01'),
    notAfter: new Date('2099-01-01'),
    privateKey: undefined,
    toString: () => 'pem-stub',
  })),
}))

vi.mock('../../../utils/certUtils', () => ({
  isCa: () => true,
  withinValidityPeriod: () => true,
  parseCertificate: vi.fn().mockResolvedValue({}),
}))

import {CertUploadForm} from '../CertUploadForm'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderWithCert = () => {
  const inputField = document.createElement('input')
  inputField.value = 'BEGIN CERTIFICATE-stub'
  return render(<CertUploadForm inputField={inputField} />)
}

const renderEmpty = () => {
  const inputField = document.createElement('input')
  return render(<CertUploadForm inputField={inputField} />)
}

describe('CertUploadForm — XSS regression', () => {
  beforeEach(() => {
    payload = ''
    delete (window as unknown as {__xss_fired?: boolean}).__xss_fired
  })

  afterEach(() => {
    delete (window as unknown as {__xss_fired?: boolean}).__xss_fired
  })

  describe('cert-present sink (line 132)', () => {
    it('strips inline event handlers from a hostile translation', () => {
      payload = '<img src=x onerror="window.__xss_fired = true">replace'
      const {container} = renderWithCert()

      expectNoEventHandlers(container)
      expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
      expect((window as unknown as {__xss_fired?: boolean}).__xss_fired).toBeUndefined()
    })

    it('strips <script> tags from a hostile translation', () => {
      payload = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
      const {container} = renderWithCert()

      expect(container.querySelector('script')).toBeNull()
      expect(container.innerHTML).not.toMatch(/<script/i)
      expect((window as unknown as {__xss_fired?: boolean}).__xss_fired).toBeUndefined()
    })

    it('strips javascript: hrefs from a hostile translation', () => {
      payload = '<a href="javascript:window.__xss_fired = true">click</a>'
      const {container} = renderWithCert()

      const anchors = container.querySelectorAll('a')
      anchors.forEach(a => {
        expect(a.getAttribute('href') || '').not.toMatch(/^javascript:/i)
      })
      expect((window as unknown as {__xss_fired?: boolean}).__xss_fired).toBeUndefined()
    })
  })

  describe('no-cert sink (line 151)', () => {
    it('strips inline event handlers from a hostile translation', () => {
      payload = '<img src=x onerror="window.__xss_fired = true">browse'
      const {container} = renderEmpty()

      expectNoEventHandlers(container)
      expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
      expect((window as unknown as {__xss_fired?: boolean}).__xss_fired).toBeUndefined()
    })

    it('strips <script> tags from a hostile translation', () => {
      payload = '<script>window.__xss_fired = true</script>browse'
      const {container} = renderEmpty()

      expect(container.querySelector('script')).toBeNull()
      expect(container.innerHTML).not.toMatch(/<script/i)
      expect((window as unknown as {__xss_fired?: boolean}).__xss_fired).toBeUndefined()
    })

    it('strips javascript: hrefs from a hostile translation', () => {
      payload = '<a href="javascript:window.__xss_fired = true">click</a>'
      const {container} = renderEmpty()

      const anchors = container.querySelectorAll('a')
      anchors.forEach(a => {
        expect(a.getAttribute('href') || '').not.toMatch(/^javascript:/i)
      })
      expect((window as unknown as {__xss_fired?: boolean}).__xss_fired).toBeUndefined()
    })
  })

  it('preserves benign formatting in legitimate validation message markup', () => {
    payload = '<strong>error:</strong> bad cert'
    const {container} = renderEmpty()

    expect(container.querySelector('strong')?.textContent).toBe('error:')
    expectNoEventHandlers(container)
  })
})
