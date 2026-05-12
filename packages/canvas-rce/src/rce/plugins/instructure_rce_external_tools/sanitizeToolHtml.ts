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

// Defense-in-depth sanitizer for HTML payloads authored by LTI tools before
// they reach the RCE. LTI 1.1 (`RceLti11ContentItem.codePayload`) and LTI 1.3
// (`parsedItem.toHtmlString()`) both build raw HTML — iframe / anchor / img /
// raw text — from tool-controlled fields, and `RCEWrapper.insertCode` /
// `replaceCode` are tinymce content normalizers, not security sanitizers.
// Running the markup through DOMPurify here defuses script tags, event
// handlers, and javascript: URIs from a compromised/malicious tool.
//
// Config mirrors `ui/shared/sanitize-html` (allowlist of iframe-embed
// attributes, anchor `target`, vendor iframe attrs the RCE round-trips,
// CSS-property allowlist via afterSanitizeAttributes, FORBID_ATTR list for
// Rails-UJS-actionable data-* attributes). This file cannot import
// `@canvas/sanitize-html` directly — it lives in the publishable
// `@instructure/canvas-rce` package, which does not depend on Canvas-internal
// `@canvas/*` packages — so the config is duplicated. Keep the two in sync
// when updating either.
//
// We use an isolated DOMPurify instance via `createDOMPurify(window)` so the
// `afterSanitizeAttributes` hook registered below does not stack with the one
// `@canvas/sanitize-html` registers on the singleton. Both hooks are
// idempotent, but isolation avoids the duplicate per-call work.

import createDOMPurify from 'dompurify'

const DOMPurify = createDOMPurify(window)

// CSS properties allowed in style attributes, mirroring the backend
// CanvasSanitize allowlist (gems/canvas_sanitize/lib/canvas_sanitize/canvas_sanitize.rb)
// minus overlay-capable primitives (position, z-index, top/left/right/bottom, clip).
const ALLOWED_CSS_PROPERTIES = new Set([
  // layout
  'display',
  'float',
  'clear',
  'overflow',
  'overflow-x',
  'overflow-y',
  'visibility',
  'cursor',
  'direction',
  'user-select',
  'zoom',
  // sizing
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  // spacing
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'margin-offset',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  // typography
  'font',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'font-width',
  'line-height',
  'text-align',
  'text-decoration',
  'text-indent',
  'white-space',
  'vertical-align',
  // color & background
  'color',
  'background',
  'background-color',
  'background-image',
  'background-attachment',
  'background-position',
  'background-position-x',
  'background-position-y',
  'background-repeat',
  // border
  'border',
  'border-color',
  'border-style',
  'border-width',
  'border-radius',
  'border-collapse',
  'border-spacing',
  'border-top',
  'border-top-color',
  'border-top-style',
  'border-top-width',
  'border-right',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-bottom',
  'border-bottom-color',
  'border-bottom-style',
  'border-bottom-width',
  'border-left',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  // list
  'list-style',
  'list-style-image',
  'list-style-position',
  'list-style-type',
  // table
  'table-layout',
  // flex
  'flex',
  'flex-basis',
  'flex-direction',
  'flex-flow',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'align-content',
  'align-items',
  'align-self',
  'justify-content',
  'justify-items',
  'justify-self',
  'order',
  'gap',
  'row-gap',
  'column-gap',
  'place-content',
  'place-items',
  'place-self',
  // grid
  'grid',
  'grid-area',
  'grid-auto-columns',
  'grid-auto-flow',
  'grid-auto-rows',
  'grid-column',
  'grid-column-end',
  'grid-column-gap',
  'grid-column-start',
  'grid-gap',
  'grid-row',
  'grid-row-end',
  'grid-row-gap',
  'grid-row-start',
  'grid-template',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
])

// Strip disallowed CSS properties from every style attribute after sanitization.
// DOMPurify does not natively filter CSS property names, only attribute names.
DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (!(node instanceof Element) || !node.hasAttribute('style')) return
  const style = (node as HTMLElement).style
  const toRemove: string[] = []
  for (let i = 0; i < style.length; i++) {
    const prop = style.item(i)
    if (!ALLOWED_CSS_PROPERTIES.has(prop)) toRemove.push(prop)
  }
  for (const prop of toRemove) style.removeProperty(prop)
  if (style.length === 0) node.removeAttribute('style')
})

const CONFIG = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: [
    'allowfullscreen',
    'allow',
    'frameborder',
    'sandbox',
    'data-media-id',
    'data-media-type',
    // anchor target — RCE produces target="_blank" for external links.
    'target',
    // legacy / vendor iframe attributes the RCE still produces and the
    // backend allowlist accepts.
    'webkitallowfullscreen',
    'mozallowfullscreen',
    'scrolling',
  ],
  RETURN_TRUSTED_TYPE: true as const,
  // Rails UJS treats certain `data-*` attributes as instructions, not opaque
  // metadata: a data-method/data-url pair on a clickable element turns a
  // click into a state-changing request with the victim's session. DOMPurify
  // allows all `data-*` by default (ALLOW_DATA_ATTR); deny the
  // UJS-actionable subset explicitly.
  FORBID_ATTR: ['data-method', 'data-remote', 'data-url', 'data-confirm', 'data-disable-with'],
}

export function sanitizeToolHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', CONFIG) as unknown as string
}
