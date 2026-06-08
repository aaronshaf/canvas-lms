/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import React from 'react'
import {sanitizeHTML} from '@canvas/sanitize-html'

interface SearchSpanProps {
  /**
   * String containing the term to highlight
   */
  searchTerm?: string
  /**
   * String containing displayable message. Can include HTML tags.
   */
  htmlBody?: string
  isSplitView?: boolean
  isAnnouncement?: boolean
  isTopic?: boolean
  resourceId?: string
  testId?: string
  /**
   * Language code if the span has been translated
   */
  lang?: string
}

const HIGHLIGHT_STYLE =
  'font-weight: bold; background-color: rgba(0,142,226,0.2); border-radius: .25rem; padding-bottom: 3px; padding-top: 1px;'

// Tags whose text content we should not search inside, matching the prior
// behavior where `<iframe>...iframe...</iframe>` text content was excluded
// from highlighting. Browsers keep iframe inner content as a text node when
// parsed via DOMParser, so we need to skip it explicitly.
const SKIP_HIGHLIGHT_PARENTS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'NOSCRIPT', 'TEMPLATE'])

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Sets target="_top" on every <a> in the parsed tree when the page is
// rendered in embedded mode. Operating on the DOM tree (rather than a regex
// over the raw HTML string) means attribute values that happen to contain
// the literal text `<a ` cannot be mutated — they remain inert text inside
// the title/alt/etc. attribute on the parent element.
const addTargetToLinks = (root: HTMLElement): void => {
  const isEmbedded = new URLSearchParams(window.location.search).get('embed') === 'true'
  if (!isEmbedded) return

  root.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_top')
  })
}

// Walks text nodes in the parsed tree and wraps matches of `searchTerm`
// with a highlight <span>. Because we only visit Node.TEXT_NODE, attribute
// values (which are stored on Element nodes, not as children) are never
// mutated. This also means HTML tag names like <iframe> aren't accidentally
// highlighted just because the search term matches the tag name.
const addSearchHighlighting = (root: HTMLElement, searchTerm: string): void => {
  if (!searchTerm) return

  const pattern = new RegExp(escapeRegExp(searchTerm), 'gi')
  const doc = root.ownerDocument || document

  // Collect first, mutate after — replacing a text node mid-walk would
  // confuse a live TreeWalker.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) => {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (SKIP_HIGHLIGHT_PARENTS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT
      if (!pattern.test(node.nodeValue)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const matches: Text[] = []
  let current = walker.nextNode()
  while (current) {
    matches.push(current as Text)
    current = walker.nextNode()
  }

  matches.forEach(textNode => {
    const text = textNode.nodeValue ?? ''
    // Reset regex state — `g` flag pattern is stateful across .exec().
    pattern.lastIndex = 0

    const fragment = doc.createDocumentFragment()
    let lastIndex = 0
    let match: RegExpExecArray | null = pattern.exec(text)

    while (match) {
      if (match.index > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)))
      }
      const span = doc.createElement('span')
      span.setAttribute('data-testid', 'highlighted-search-item')
      span.setAttribute('style', HIGHLIGHT_STYLE)
      span.textContent = match[0]
      fragment.appendChild(span)

      lastIndex = match.index + match[0].length

      // Guard against zero-width matches (defensive — escapeRegExp output
      // shouldn't produce them, but be safe).
      if (match[0].length === 0) {
        pattern.lastIndex++
      }
      match = pattern.exec(text)
    }

    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)))
    }

    textNode.parentNode?.replaceChild(fragment, textNode)
  })
}

export function SearchSpan({...props}: SearchSpanProps) {
  const resourceType = () => {
    if (props.isAnnouncement == null || props.isTopic == null) {
      return undefined
    }

    return `${props.isAnnouncement ? 'announcement' : 'discussion_topic'}.${
      props.isTopic ? 'body' : 'reply'
    }`
  }

  // Pre-sanitize to TrustedHTML before parsing: DOMParser.parseFromString is
  // a TrustedHTML sink in Chrome's Trusted Types implementation. Passing a
  // TrustedHTML object bypasses the default policy under Phase 2 enforcement
  // instead of relying on the pass-through policy to accept a raw string.
  // sanitizeHTML still runs again after DOM mutation as defense-in-depth.
  const sanitizedBody = sanitizeHTML(props.htmlBody ?? '')
  const doc = new DOMParser().parseFromString(sanitizedBody as unknown as string, 'text/html')
  addTargetToLinks(doc.body)
  if (props.searchTerm && !props.isSplitView) {
    addSearchHighlighting(doc.body, props.searchTerm)
  }
  const finalHtml = sanitizeHTML(doc.body.innerHTML)

  return (
    <div
      lang={props.lang}
      className="user_content"
      data-resource-type={resourceType()}
      data-resource-id={props.resourceId}
      data-testid={props.testId}
      dangerouslySetInnerHTML={{
        __html: finalHtml,
      }}
    />
  )
}
