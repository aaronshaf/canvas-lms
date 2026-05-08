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
//
// At runtime returns a TrustedHTML object in browsers that support the
// Trusted Types API (Chrome, Firefox, Safari 18+) and a plain string
// elsewhere (older Safari, jsdom). The TypeScript return type is
// declared `string` — a deliberate lie that mirrors the same lie the
// browser DOM lib (`Element.innerHTML: string`), React (`__html:
// string`), and jQuery (`html(string)`) already tell. All those sinks
// runtime-accept TrustedHTML even though their TS signatures only
// declare string; lying here lets callers continue to assign the
// result to those sinks without a per-call cast. The semantic
// guarantee for callers is "treat the result as opaque and assign it
// directly to a DOM sink." Do not string-manipulate the result
// (.slice, .match, etc.) — those methods do not exist on TrustedHTML
// and will throw at runtime in modern browsers. (Verified: no caller
// in ui/ currently does so as of 2026-05-08.)
//
// Returning a TrustedHTML means most wrapped sites bypass the
// @canvas/trusted-types default policy (the browser sees a
// TrustedHTML and writes it directly), so the dev console.debug
// telemetry sharpens for the wrapped subset — measured ~14% fewer
// createHTML invocations on a representative discussion-topic
// page. Most logs on a real Canvas page come from non-sanitize-html
// sources (jQuery UI internals, raw render paths, 3rd-party libs)
// which fire regardless of this commit. Sites that route the
// sanitize-html result through .toString() coercion before
// assignment (jQuery fillTemplateData, Backbone .data() /
// Handlebars templates) also still invoke the default policy at
// the eventual write — works correctly, just doesn't quiet those
// particular paths. DOMPurify auto-registers its own `dompurify`
// policy on first sanitize() call when TT is active — that policy
// name is allowlisted in lib/csp_report_only_config.rb.

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
  // `true as const` (not bare `true`) is required so DOMPurify's overload
  // resolution picks the TrustedHTML-returning signature. A bare boolean
  // gets widened to `boolean` at the variable boundary and matches the
  // string-returning overload instead.
  RETURN_TRUSTED_TYPE: true as const,
}

export const sanitizeHTML = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html ?? '', CONFIG) as unknown as string
