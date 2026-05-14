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

// Named Trusted Types policy for canvas-rce innerHTML assignments.
// Content assigned through this policy is TinyMCE editor HTML — sanitized
// server-side before storage and managed entirely within the RCE sandbox.
// The pass-through body acknowledges the reviewed contract without adding
// a redundant DOMPurify pass on every editor operation.

// canvas-rce's tsconfig targets ES5 lib which lacks TrustedTypes globals.
// Cast to access the API without adding a lib dependency on the main app.
const _win = (typeof window !== 'undefined' ? window : null) as
  | (Window & {
      trustedTypes?: {
        createPolicy: (
          name: string,
          policy: {createHTML: (s: string) => string},
        ) => {createHTML: (s: string) => unknown}
      }
    })
  | null

export const rceTTPolicy = _win?.trustedTypes?.createPolicy
  ? _win.trustedTypes.createPolicy('canvas-rce', {createHTML: (s: string) => s})
  : null

export function setRceHTML(el: Element, html: string): void {
  el.innerHTML = rceTTPolicy ? (rceTTPolicy.createHTML(html) as unknown as string) : html
}
