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

// Sanitize jquery's HTML-accepting DOM mutation methods at the prototype
// so every call site inherits sanitization. Covers $.fn.html (CFA-953)
// and the sibling methods .append/.prepend/.before/.after/.replaceWith
// (CFA-954). Loaded as a side-effect of jquery.instructure_jquery_patches
// (imported before @canvas/trusted-types in ui/index.ts), so the default
// policy never sees a string argument.
//
// Strategy — post-sanitize via DOMPurify IN_PLACE:
//   1. Pass the raw string/function to the original jQuery method.
//   2. jQuery sets the element's innerHTML in the correct DOM context
//      (so a <tr> context correctly preserves <td> children, a <tbody>
//      context correctly preserves <tr> children, etc.).
//   3. DOMPurify.sanitize(el, {IN_PLACE:true}) walks the live DOM tree
//      and strips forbidden nodes/attributes (event handlers, <script>,
//      javascript: URIs, etc.) without a re-parse step, so table
//      structure is never touched.
//
// This is equivalent to pre-sanitizing for the security properties that
// matter: no forbidden content survives in the final DOM. The brief
// window between step 1 and step 3 (same event loop tick) cannot be
// observed by any event handler firing, so it is acceptable for Phase 1.
//
// TrustedHTML arguments (already sanitized by @canvas/sanitize-html) are
// converted to plain strings before being passed to jQuery so that jQuery's
// internal typeof checks and string methods (e.g. htmlPrefilter, buildFragment)
// work correctly — TrustedHTML objects are not plain strings and cause
// "Cannot read properties of undefined" TypeErrors in jQuery's internals.
// After conversion the content goes through IN_PLACE sanitization (harmless
// double-pass on already-clean HTML). Non-string/non-function arguments
// (DOM nodes, jQuery objects, DocumentFragments) pass through unchanged since
// they do not involve HTML string parsing.
//
// Phase 2 migration path (require-trusted-types-for 'script' enforcement):
//   Step 1 (raw-string → jQuery innerHTML) will throw under enforcement.
//   Fix: replace the string arg with a pre-sanitized DocumentFragment before
//   calling originalHtml. Use DOMParser to preserve table context:
//     const doc = new DOMParser().parseFromString(sanitizeHTML(str), 'text/html')
//   `sanitizeHTML` returns TrustedHTML (RETURN_TRUSTED_TYPE:true), so the
//   DOMParser call receives a TrustedHTML object and bypasses the default policy.
//   Move child nodes into a DocumentFragment and pass the fragment to jQuery.
//   jQuery's fragment path uses appendChild() — no innerHTML — so TT is silent.
//   Table-structure context is preserved because DOMParser produces a full
//   <html><body> tree; caller context awareness shifts to the DOMParser path
//   (identical to how browsers handle full-page HTML). Adjust the function-arg
//   case similarly (call the function first, then sanitize its return value).

import $ from 'jquery'
import DOMPurify from 'dompurify'

// DOMPurify config matching @canvas/sanitize-html — widened minimally for
// legitimate Canvas content (Studio/mediacenter/LTI iframes). RETURN_TRUSTED_TYPE
// is not applicable in IN_PLACE mode.
// <style> is left in DOMPurify's default ALLOWED_TAGS: forbidding it outright
// breaks Backbone view rendering on pages that legitimately inject <style>
// elements (e.g. RCE plugin toolbar CSS). DOMPurify already sanitizes <style>
// content (strips expression(), url() with js: / data: protocols, @import),
// which is sufficient protection at this layer. The primary XSS defense
// remains per-sink sanitizeHTML applied to user content before it reaches jQuery.
// contenteditable is added because DOMPurify's default allowlist omits it,
// and Canvas/TinyMCE use it in editor surfaces that may pass through jQuery.
const IN_PLACE_CONFIG = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: [
    'allowfullscreen',
    'allow',
    'frameborder',
    'sandbox',
    'data-media-id',
    'data-media-type',
    'target',
    'webkitallowfullscreen',
    'mozallowfullscreen',
    'scrolling',
    'contenteditable',
  ],
  // DOMPurify's SANITIZE_DOM (default true) strips id/name attributes whose
  // values shadow DOM properties (e.g. name="name", name="action") to prevent
  // DOM-clobbering attacks. Canvas developer-authored templates legitimately
  // use name="name" (assignment name field in EditView). Stripping it empties
  // this.$name (a jQuery cached ref in EditView), making .val() return
  // undefined and crashing initialization with "Cannot read properties of
  // undefined (reading 'length')". Primary DOM-clobbering protection is
  // upstream (sanitizeHtml applied to user content before reaching jQuery).
  SANITIZE_DOM: false,
  IN_PLACE: true,
} as const

const isTrustedHTML = (value: unknown): boolean => {
  if (typeof window === 'undefined') return false
  const tt = (window as unknown as {trustedTypes?: {isHTML?: (v: unknown) => boolean}}).trustedTypes
  return Boolean(tt?.isHTML?.(value))
}

// Convert any TrustedHTML objects in args to plain strings.
// jQuery's internals (htmlPrefilter, buildFragment) call string methods like
// .replace() and .trim() on arguments — TrustedHTML objects lack these and
// cause TypeError crashes. String(trustedHtml) returns the underlying HTML.
const normalizeTrustedHTML = (args: unknown[]): unknown[] =>
  args.map(a => (isTrustedHTML(a) ? String(a) : a))

// Post-sanitize a single DOM element in-place.
// DOMPurify throws "root node is forbidden and cannot be sanitized in-place"
// when the element itself is explicitly forbidden (e.g. <script>). Those
// elements are never safe — remove them.
const sanitizeEl = (el: Element): void => {
  try {
    DOMPurify.sanitize(el, IN_PLACE_CONFIG as unknown as Parameters<typeof DOMPurify.sanitize>[1])
  } catch (e) {
    if (e instanceof TypeError && (e as TypeError).message.includes('forbidden')) {
      el.remove()
    } else {
      throw e
    }
  }
}

// Return true when at least one arg requires in-place post-sanitization
// (i.e. is a plain string or function — not a DOM node/jQuery object).
const needsPostSanitize = (args: unknown[]): boolean =>
  args.some(a => typeof a === 'string' || typeof a === 'function')

// $.fn.html — getter on no-args, setter otherwise. Special-cased so the
// no-args getter doesn't go through sanitization.
const originalHtml = $.fn.html as unknown as (this: JQuery, ...args: unknown[]) => unknown

const sanitizingHtml = function (this: JQuery, ...args: unknown[]): unknown {
  if (args.length === 0) return originalHtml.call(this)

  // TrustedHTML objects → plain strings so jQuery's string methods work.
  const normalizedArgs = normalizeTrustedHTML(args)

  // String or function: let jQuery set content in the correct DOM context
  // (preserves <td> inside <tr>, <tr> inside <tbody>, etc.), then
  // sanitize the resulting DOM in-place.
  if (needsPostSanitize(normalizedArgs)) {
    originalHtml.apply(this, normalizedArgs)
    this.each(function (this: Element) {
      if (this.nodeType === Node.ELEMENT_NODE) sanitizeEl(this)
    })
    return this
  }

  // DOM nodes, jQuery objects, DocumentFragments, etc.: pass through.
  return originalHtml.apply(this, normalizedArgs)
}

$.fn.html = sanitizingHtml as unknown as typeof $.fn.html

// Sibling HTML-accepting setters.
const SIBLING_METHODS = ['append', 'prepend', 'before', 'after', 'replaceWith'] as const

type SiblingMethod = (typeof SIBLING_METHODS)[number]

// Methods that insert content as CHILDREN of `this` — sanitize `this`.
const CHILD_INSERTION_METHODS: ReadonlySet<SiblingMethod> = new Set(['append', 'prepend'] as const)

// Methods that insert content as SIBLINGS of `this` — sanitize `this`'s
// parent so the newly inserted siblings are covered.
const SIBLING_INSERTION_METHODS: ReadonlySet<SiblingMethod> = new Set([
  'before',
  'after',
  'replaceWith',
] as const)

for (const method of SIBLING_METHODS) {
  const original = $.fn[method] as unknown as (this: JQuery, ...args: unknown[]) => unknown

  const wrapped = function (this: JQuery, ...args: unknown[]) {
    // TrustedHTML objects → plain strings so jQuery's string methods work.
    const normalizedArgs = normalizeTrustedHTML(args)

    // No string/function args: delegate unchanged (DOM nodes, etc.).
    if (!needsPostSanitize(normalizedArgs)) {
      return original.apply(this, normalizedArgs)
    }

    if (CHILD_INSERTION_METHODS.has(method as 'append' | 'prepend')) {
      // Snapshot existing children so we sanitize only the NEW nodes —
      // not pre-existing siblings like <style> elements added via DOM API
      // (e.g. calendar per-course color rules from CFA-955).
      const snapshots: {parent: Element; before: Set<Node>}[] = []
      this.each(function (this: Element) {
        if (this.nodeType === Node.ELEMENT_NODE)
          snapshots.push({parent: this, before: new Set(this.childNodes)})
      })
      original.apply(this, normalizedArgs)
      snapshots.forEach(({parent, before}) => {
        parent.childNodes.forEach(node => {
          if (!before.has(node) && node.nodeType === Node.ELEMENT_NODE) sanitizeEl(node as Element)
        })
      })
      return this
    }

    if (SIBLING_INSERTION_METHODS.has(method as 'before' | 'after' | 'replaceWith')) {
      // Collect parents and snapshot their children BEFORE insertion/removal.
      // .replaceWith detaches `this` first, so parents must be gathered before
      // the call. We snapshot children so we only sanitize the newly inserted
      // nodes — not pre-existing siblings (e.g. <style> elements from DOM API).
      const snapshots: {parent: Element; before: Set<Node>}[] = []
      this.each(function (this: Element) {
        if (this.parentElement)
          snapshots.push({
            parent: this.parentElement,
            before: new Set(this.parentElement.childNodes),
          })
      })
      original.apply(this, normalizedArgs)
      snapshots.forEach(({parent, before}) => {
        parent.childNodes.forEach(node => {
          if (!before.has(node) && node.nodeType === Node.ELEMENT_NODE) sanitizeEl(node as Element)
        })
      })
      return this
    }

    return original.apply(this, normalizedArgs)
  }

  ;($.fn as unknown as Record<SiblingMethod, unknown>)[method] = wrapped
}

export {}
