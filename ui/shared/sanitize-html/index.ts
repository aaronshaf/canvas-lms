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

// Canvas-wide DOMPurify wrapper. Use at every `dangerouslySetInnerHTML` /
// `innerHTML` sink that takes user-authored HTML, as defense-in-depth on top
// of backend `CanvasSanitize`. Backend allowlisting correctly treats
// attribute values as inert text, but downstream client code (regex
// rewrites, parse->serialize round-trips) can mutate attribute contents
// into real DOM and trigger XSS — DOMPurify at the sink defuses that.
//
// DOMPurify defaults already strip <script>, event handlers, javascript:
// URIs, etc. — that's the actual XSS defense. We widen the allowlist
// minimally so legitimate Canvas content (iframe-embedded video from
// Studio / mediacenter / LTI tools) survives. Resist expanding further;
// every added tag/attr is potential mXSS surface, and matching the
// backend allowlist exactly defeats the "catch what backend missed"
// property that makes client-side sanitization valuable.

import DOMPurify from 'dompurify'

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
    // DOMPurify omits target by default to limit tabnabbing surface, but
    // modern browsers treat target="_blank" as implicit rel="noopener",
    // and the backend allowlist already includes target.
    'target',
    // legacy / vendor iframe attributes the RCE still produces and the
    // backend allowlist accepts — kept here so RCE-authored content
    // survives intact on egress paths (sanitizeData, RCE round-trip).
    // XSS-irrelevant: vendor-prefixed booleans + a deprecated layout attr
    // that does not execute.
    'webkitallowfullscreen',
    'mozallowfullscreen',
    'scrolling',
  ],
}

export const sanitizeHTML = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html ?? '', CONFIG)
