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

import {render} from '@testing-library/react'
import React from 'react'
import {SearchSpan} from '../SearchSpan'

const setup = props => {
  return render(<SearchSpan searchTerm="" htmlBody="" {...props} />)
}

describe('SearchSpan', () => {
  it('should perform no highlights if no searchTerm is present', () => {
    const {queryAllByTestId} = setup()
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(0)
  })

  it('should highlight search term if found in message', () => {
    const {queryAllByTestId} = setup({searchTerm: 'Posts', htmlBody: 'Posts'})
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(1)
  })

  it('should not create highlight spans if no term is found', () => {
    const {queryAllByTestId} = setup({searchTerm: 'Posts', htmlBody: 'A message'})
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(0)
  })

  it('should highlight multiple terms in message', () => {
    const {queryAllByTestId} = setup({
      searchTerm: 'here',
      htmlBody: 'a longer message with multiple highlights here and here',
    })
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(2)
  })

  it('highlighting should be case-insensitive', () => {
    const {queryAllByTestId} = setup({
      searchTerm: 'here',
      htmlBody: 'here and HeRe',
    })
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(2)
  })

  it('should not highlight when in split screen view', () => {
    const {queryAllByTestId} = setup({
      searchTerm: 'here',
      htmlBody: 'here and HeRe',
      isSplitView: true,
    })
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(0)
  })

  it('should remove inner html tags', () => {
    const container = setup({
      searchTerm: 'strong',
      htmlBody:
        "Around here, however, we don't look backwards for very long. <strong>We keep moving forward</strong>, opening up new doors and doing new things, because we're curious... and curiosity keeps leading us down new paths.",
    })
    expect(container.queryAllByTestId('highlighted-search-item')).toHaveLength(0)
    expect(container.queryByText('strong')).toBeNull()
  })

  it('should ignore iframe html tags', () => {
    const iframe = `<iframe style="width: 400px; height: 225px; display: inline-block;" title="Video player for 2023-05-23 13-24-01.mp4" data-media-type="video" src="https://mediacenter.com" allowfullscreen="allowfullscreen" allow="fullscreen" data-media-id="m-4ws5T"></iframe>`
    const content = `<p>Testing whether only the iframe html tag is ignored: ${iframe}<br /> will the i-f-r-a-m-e html ta get highlighted?</p>`

    const container = setup({
      searchTerm: 'iframe',
      htmlBody: content,
    })

    // iframe is in the content 3 times
    expect(content.split('iframe').length - 1).toBe(3)
    // only the 'iframe' text that is not in an html tag should be highlighted.
    expect(container.queryAllByTestId('highlighted-search-item')).toHaveLength(1)
    // The iframe html tag wasn't removed
    expect(container.container.innerHTML).toContain('<iframe')
  })

  it('should handle special characters in searchTerm', () => {
    const {queryAllByTestId} = setup({
      searchTerm: '(',
      htmlBody: 'This is a (here) test with (here) special characters',
    })
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(2)
  })

  it('should not crash on empty htmlBody', () => {
    const {container} = setup({htmlBody: ''})
    expect(container.querySelector('div.user_content')).not.toBeNull()
  })

  it('should not crash on undefined htmlBody', () => {
    const {container} = render(<SearchSpan />)
    expect(container.querySelector('div.user_content')).not.toBeNull()
  })

  it('should highlight search term nested inside multiple elements', () => {
    const {queryAllByTestId} = setup({
      searchTerm: 'here',
      htmlBody: '<div><strong>look here</strong> and <em>here</em></div>',
    })
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(2)
  })

  it('should highlight only one match across an element boundary, not both halves', () => {
    // The string "abc" appears split as "ab" + "c" across a tag.
    // The DOM walker visits text nodes individually, so the term cannot
    // match across the boundary — neither half should be highlighted.
    const {queryAllByTestId} = setup({
      searchTerm: 'abc',
      htmlBody: '<span>ab</span><span>c</span>',
    })
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(0)
  })

  it('should not highlight inside <script> tags', () => {
    const {queryAllByTestId} = setup({
      searchTerm: 'evil',
      htmlBody: '<script>var x = "evil"</script>visible',
    })
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(0)
  })

  it('should not highlight inside <style> tags', () => {
    const {queryAllByTestId} = setup({
      searchTerm: 'color',
      htmlBody: '<style>.x { color: red }</style><p>visible</p>',
    })
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(0)
  })

  it('highlight spans should carry the highlight style and testid', () => {
    const {queryAllByTestId} = setup({searchTerm: 'foo', htmlBody: 'foo'})
    const spans = queryAllByTestId('highlighted-search-item')
    expect(spans).toHaveLength(1)
    const styleAttr = spans[0].getAttribute('style') ?? ''
    expect(styleAttr).toMatch(/font-weight:\s*bold/i)
    expect(styleAttr).toMatch(/background-color/i)
  })

  it('should preserve text before, between, and after multiple matches', () => {
    const {container, queryAllByTestId} = setup({
      searchTerm: 'X',
      htmlBody: 'before X middle X after',
    })
    expect(queryAllByTestId('highlighted-search-item')).toHaveLength(2)
    // The text content is preserved verbatim around the highlight spans.
    expect(container.textContent).toBe('before X middle X after')
  })

  it('renders className="user_content" on a <div> wrapper', () => {
    const {container} = setup({htmlBody: 'plain'})
    expect(container.querySelector('div.user_content')).not.toBeNull()
    expect(container.querySelector('span.user_content')).toBeNull()
  })

  it('should pass through lang attribute', () => {
    const {container} = setup({htmlBody: 'plain', lang: 'fr'})
    expect(container.querySelector('div.user_content')?.getAttribute('lang')).toBe('fr')
  })

  it('should pass through data-resource-id and data-testid', () => {
    const {container} = setup({htmlBody: 'plain', resourceId: '99', testId: 't-x'})
    const span = container.querySelector('div.user_content')
    expect(span).not.toBeNull()
    expect(span.getAttribute('data-resource-id')).toBe('99')
    expect(span.getAttribute('data-testid')).toBe('t-x')
  })

  describe('resource-type data attribute', () => {
    it('is undefined when both isAnnouncement and isTopic are missing', () => {
      const {container} = setup({htmlBody: 'plain'})
      const span = container.querySelector('div.user_content')
      expect(span).not.toBeNull()
      expect(span.hasAttribute('data-resource-type')).toBe(false)
    })

    it('is announcement.body for an announcement topic', () => {
      const {container} = setup({htmlBody: 'plain', isAnnouncement: true, isTopic: true})
      expect(container.querySelector('div.user_content')?.getAttribute('data-resource-type')).toBe(
        'announcement.body',
      )
    })

    it('is announcement.reply for an announcement reply', () => {
      const {container} = setup({htmlBody: 'plain', isAnnouncement: true, isTopic: false})
      expect(container.querySelector('div.user_content')?.getAttribute('data-resource-type')).toBe(
        'announcement.reply',
      )
    })

    it('is discussion_topic.body for a discussion topic', () => {
      const {container} = setup({htmlBody: 'plain', isAnnouncement: false, isTopic: true})
      expect(container.querySelector('div.user_content')?.getAttribute('data-resource-type')).toBe(
        'discussion_topic.body',
      )
    })

    it('is discussion_topic.reply for a discussion reply', () => {
      const {container} = setup({htmlBody: 'plain', isAnnouncement: false, isTopic: false})
      expect(container.querySelector('div.user_content')?.getAttribute('data-resource-type')).toBe(
        'discussion_topic.reply',
      )
    })
  })
})
