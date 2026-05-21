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

import {
  getMenubarForVariant,
  getMenuForVariant,
  getToolbarForVariant,
  getStatusBarFeaturesForVariant,
} from '../RCEVariants'

describe('getMenubarForVariant', () => {
  it('returns the full menubar for the full variant', () => {
    const spec = getMenubarForVariant('full')
    expect(spec).toContain('edit')
    expect(spec).toContain('format')
    expect(spec).toContain('insert')
    expect(spec).toContain('tools')
    expect(spec).toContain('table')
    expect(spec).toContain('view')
  })

  it('returns an empty string for the lite variant', () => {
    expect(getMenubarForVariant('lite')).toBe('')
  })

  it('returns an empty string for text-only', () => {
    expect(getMenubarForVariant('text-only')).toBe('')
  })

  it('returns an empty string for text-block', () => {
    expect(getMenubarForVariant('text-block')).toBe('')
  })

  it('returns an empty string for block-content-editor', () => {
    expect(getMenubarForVariant('block-content-editor')).toBe('')
  })
})

describe('getMenuForVariant', () => {
  describe('full variant', () => {
    it('returns an object with the expected top-level menu keys', () => {
      const menus = getMenuForVariant('full')
      expect(Object.keys(menus)).toEqual(
        expect.arrayContaining(['edit', 'format', 'insert', 'tools', 'view']),
      )
    })

    it('edit menu contains undo and selectall', () => {
      const menus = getMenuForVariant('full')
      expect(menus.edit.items).toContain('undo')
      expect(menus.edit.items).toContain('selectall')
    })

    it('format menu contains bold and removeformat', () => {
      const menus = getMenuForVariant('full')
      expect(menus.format.items).toContain('bold')
      expect(menus.format.items).toContain('removeformat')
    })

    it('insert menu contains instructure_links and inserttable', () => {
      const menus = getMenuForVariant('full')
      expect(menus.insert.items).toContain('instructure_links')
      expect(menus.insert.items).toContain('inserttable')
    })

    it('view menu contains instructure_fullscreen and instructure_html_view', () => {
      const menus = getMenuForVariant('full')
      expect(menus.view.items).toContain('instructure_fullscreen')
      expect(menus.view.items).toContain('instructure_html_view')
    })
  })

  it('returns an empty object for lite', () => {
    expect(getMenuForVariant('lite')).toEqual({})
  })

  it('returns an empty object for text-only', () => {
    expect(getMenuForVariant('text-only')).toEqual({})
  })

  it('returns an empty object for text-block', () => {
    expect(getMenuForVariant('text-block')).toEqual({})
  })

  it('returns an empty object for block-content-editor', () => {
    expect(getMenuForVariant('block-content-editor')).toEqual({})
  })
})

describe('getToolbarForVariant', () => {
  describe('lite variant', () => {
    it('returns toolbar groups including Formatting with bold', () => {
      const groups = getToolbarForVariant('lite')
      const formattingGroup = groups.find(g => g.items.includes('bold'))
      expect(formattingGroup).toBeDefined()
      expect(formattingGroup?.items).toContain('italic')
      expect(formattingGroup?.items).toContain('underline')
    })

    it('includes instructure_links in content group', () => {
      const groups = getToolbarForVariant('lite')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).toContain('instructure_links')
    })

    it('includes bullist in lists group', () => {
      const groups = getToolbarForVariant('lite')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).toContain('bullist')
    })

    it('does not include lti_tool_dropdown', () => {
      const groups = getToolbarForVariant('lite')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).not.toContain('lti_tool_dropdown')
    })

    it('includes instructure_equation in Miscellaneous group (regression: 3e98b16192c)', () => {
      const groups = getToolbarForVariant('lite')
      const miscGroup = groups.find(g => g.items.includes('instructure_equation'))
      expect(miscGroup).toBeDefined()
      expect(miscGroup?.name).toMatch(/miscellaneous/i)
    })
  })

  describe('text-only variant', () => {
    it('includes bold, italic, underline', () => {
      const groups = getToolbarForVariant('text-only')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).toContain('bold')
      expect(allItems).toContain('italic')
      expect(allItems).toContain('underline')
    })

    it('includes instructure_links', () => {
      const groups = getToolbarForVariant('text-only')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).toContain('instructure_links')
    })

    it('does not include instructure_image', () => {
      const groups = getToolbarForVariant('text-only')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).not.toContain('instructure_image')
    })
  })

  describe('text-block variant', () => {
    it('includes color formatting items', () => {
      const groups = getToolbarForVariant('text-block')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).toContain('instructure_color')
      expect(allItems).toContain('inst_subscript')
      expect(allItems).toContain('inst_superscript')
    })

    it('includes alignment and list items', () => {
      const groups = getToolbarForVariant('text-block')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).toContain('align')
      expect(allItems).toContain('bullist')
      expect(allItems).toContain('inst_indent')
      expect(allItems).toContain('inst_outdent')
    })
  })

  describe('block-content-editor variant', () => {
    it('includes keyboard shortcuts and word count header items', () => {
      const groups = getToolbarForVariant('block-content-editor')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).toContain('instructure_keyboard_shortcuts_header')
      expect(allItems).toContain('instructure_wordcount_header')
    })

    it('does not include instructure_image or instructure_documents', () => {
      const groups = getToolbarForVariant('block-content-editor')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).not.toContain('instructure_image')
    })
  })

  describe('full variant', () => {
    it('includes the External Tools group by default with lti_tool_dropdown', () => {
      const groups = getToolbarForVariant('full')
      const externalToolsGroup = groups.find(g => g.items.includes('lti_tool_dropdown'))
      expect(externalToolsGroup).toBeDefined()
      expect(externalToolsGroup?.items).toContain('lti_mru_button')
    })

    it('includes table and instructure_media_embed in miscellaneous group', () => {
      const groups = getToolbarForVariant('full')
      const allItems = groups.flatMap(g => g.items)
      expect(allItems).toContain('table')
      expect(allItems).toContain('instructure_media_embed')
    })

    it('prepends ltiToolFavorites into the External Tools group', () => {
      const favorites = ['my_tool_1', 'my_tool_2']
      const groups = getToolbarForVariant('full', favorites)
      const externalGroup = groups.find(g => g.items.includes('lti_tool_dropdown'))
      expect(externalGroup?.items[0]).toBe('my_tool_1')
      expect(externalGroup?.items[1]).toBe('my_tool_2')
    })

    it('external tools group has no favorites when none provided', () => {
      const groups = getToolbarForVariant('full')
      const externalGroup = groups.find(g => g.items.includes('lti_tool_dropdown'))
      expect(externalGroup?.items[0]).toBe('lti_tool_dropdown')
    })
  })
})

describe('getStatusBarFeaturesForVariant', () => {
  it('returns empty array for text-block', () => {
    expect(getStatusBarFeaturesForVariant('text-block')).toEqual([])
  })

  it('returns empty array for block-content-editor', () => {
    expect(getStatusBarFeaturesForVariant('block-content-editor')).toEqual([])
  })

  it('returns desktop platform features for lite on desktop (regression: 3a852b320ee)', () => {
    const features = getStatusBarFeaturesForVariant('lite', {isDesktop: true})
    expect(features).toContain('keyboard_shortcuts')
    expect(features).toContain('a11y_checker')
    expect(features).toContain('word_count')
    expect(features).not.toContain('html_view')
    expect(features).not.toContain('fullscreen')
  })

  it('returns mobile platform features for lite on mobile (regression: 3a852b320ee)', () => {
    const features = getStatusBarFeaturesForVariant('lite', {isDesktop: false})
    expect(features).not.toContain('keyboard_shortcuts')
    expect(features).toContain('a11y_checker')
    expect(features).toContain('word_count')
  })

  it('returns full set including html_view and fullscreen for the full variant on desktop', () => {
    const features = getStatusBarFeaturesForVariant('full', {isDesktop: true})
    expect(features).toContain('keyboard_shortcuts')
    expect(features).toContain('html_view')
    expect(features).toContain('fullscreen')
    expect(features).toContain('resize_handle')
  })

  it('includes a11y_resize_handlers when a11yResizers is true', () => {
    const features = getStatusBarFeaturesForVariant('full', {isDesktop: true, a11yResizers: true})
    expect(features).toContain('a11y_resize_handlers')
  })

  it('excludes a11y_resize_handlers when a11yResizers is false', () => {
    const features = getStatusBarFeaturesForVariant('full', {isDesktop: true, a11yResizers: false})
    expect(features).not.toContain('a11y_resize_handlers')
  })
})
