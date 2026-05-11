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

// CFA-998: sanitizeUrl must reject cross-origin protocol-relative URLs (//host).
// The WHATWG URL parser resolves //evil.com against window.location.origin
// and returns protocol==='https:' which passes the scheme allowlist —
// even though the host is external. Reject when resolved origin is cross-origin.
// Same-origin //hostname forms are accepted (used by isCrossSite helper).

import sanitizeUrl from '../sanitizeUrl'

describe('sanitizeUrl protocol-relative URL hardening (CFA-998)', () => {
  it('rejects //evil.com/x (cross-origin)', () => {
    expect(sanitizeUrl('//evil.com/x')).toBe('about:blank')
  })

  it('rejects \\t//evil.com/x (leading tab)', () => {
    expect(sanitizeUrl('\t//evil.com/x')).toBe('about:blank')
  })

  it('rejects "  //evil.com/x" (leading spaces)', () => {
    expect(sanitizeUrl('  //evil.com/x')).toBe('about:blank')
  })

  it('rejects \\\\evil.com\\\\x (backslash form)', () => {
    expect(sanitizeUrl('\\\\evil.com\\x')).toBe('about:blank')
  })

  it('passes //localhost/x (same-origin protocol-relative)', () => {
    // isCrossSite uses sanitizeUrl with //hostname to check cross-origin
    const sameOriginUrl = `//${window.location.hostname}/courses/1`
    expect(sanitizeUrl(sameOriginUrl)).toBe(sameOriginUrl)
  })

  it('passes /courses/1/files/2 (same-origin relative path)', () => {
    expect(sanitizeUrl('/courses/1/files/2')).toBe('/courses/1/files/2')
  })

  it('passes images/foo.png (relative path)', () => {
    expect(sanitizeUrl('images/foo.png')).toBe('images/foo.png')
  })

  it('passes https://canvas.example.com/x (absolute https)', () => {
    expect(sanitizeUrl('https://canvas.example.com/x')).toBe('https://canvas.example.com/x')
  })

  it('passes https://external-allowed.com/x (explicit scheme still allowed)', () => {
    expect(sanitizeUrl('https://external-allowed.com/x')).toBe('https://external-allowed.com/x')
  })
})
