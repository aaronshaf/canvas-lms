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

// DOMPurify wrapper for RCE-produced HTML (autosave preview, stored content
// display). Mirrors the config in @canvas/sanitize-html but lives here so
// canvas-rce stays independent of ui/shared workspace packages.
//
// CSS overlay properties (position, z-index, clip, transform) are stripped
// after sanitization to prevent UI-redressing attacks in the preview modal.

import DOMPurify from 'dompurify'

// Properties that could be used to overlay or obscure surrounding UI.
const DANGEROUS_CSS_PROPS = [
  'position',
  'z-index',
  'top',
  'left',
  'right',
  'bottom',
  'clip',
  'clip-path',
  'transform',
  'opacity',
  'pointer-events',
]

DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (!(node instanceof Element) || !node.hasAttribute('style')) return
  const style = (node as HTMLElement).style
  for (const prop of DANGEROUS_CSS_PROPS) style.removeProperty(prop)
  if (style.length === 0) node.removeAttribute('style')
})

const CONFIG = {
  // RCE content legitimately contains iframes (Studio, LTI, media embeds).
  ADD_TAGS: ['iframe'],
  ADD_ATTR: [
    'allowfullscreen',
    'allow',
    'frameborder',
    'sandbox',
    'data-media-id',
    'data-media-type',
    // target="_blank" is in the backend allowlist and produced by the RCE.
    'target',
    // Legacy vendor attributes the RCE still emits.
    'webkitallowfullscreen',
    'mozallowfullscreen',
    'scrolling',
  ],
  // Rails UJS turns these data-* attributes into state-changing requests.
  FORBID_ATTR: ['data-method', 'data-remote', 'data-url', 'data-confirm', 'data-disable-with'],
  // Returns TrustedHTML in browsers that support the Trusted Types API.
  // The return type is declared `string` (same lie told by innerHTML / React
  // __html / jQuery .html()) — do not string-manipulate the result.
  RETURN_TRUSTED_TYPE: true as const,
}

export const sanitizeHtml = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html ?? '', CONFIG) as unknown as string
