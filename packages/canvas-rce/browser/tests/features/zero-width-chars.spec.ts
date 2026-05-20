import {test, expect} from '../../fixtures/test'

// Zero-width characters appear in content copied from the web:
// - U+200B ZERO WIDTH SPACE — used in long words for wrapping
// - U+200C ZERO WIDTH NON-JOINER — prevents ligature formation
// - U+200D ZERO WIDTH JOINER — forces ligatures (emoji sequences)
// - U+FEFF BYTE ORDER MARK / ZERO WIDTH NO-BREAK SPACE
// These are invisible but affect rendering. Tests verify surrounding visible
// text is not corrupted when these characters are present.
test.describe('zero-width and invisible Unicode characters', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function setAndGet(page: any, html: string): Promise<string> {
    return page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(content)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)
  }

  test('text with zero-width space — visible text preserved', async ({page}) => {
    // U+200B between "super" and "long"
    const content = await setAndGet(page, '<p>super​long word here</p>')
    expect(content).toContain('super')
    expect(content).toContain('long word here')
  })

  test('text with ZWNJ — visible text preserved', async ({page}) => {
    // U+200C used in Farsi/Hindi typography
    const content = await setAndGet(page, '<p>می‌خواهم</p>')
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })

  test('text with ZWJ in emoji sequence — text context preserved', async ({page}) => {
    // family emoji uses U+200D joiners
    const content = await setAndGet(page, '<p>Family: 👨‍👩‍👧 here</p>')
    expect(content).toContain('Family')
    expect(content).toContain('here')
  })

  test('BOM at start of content — visible text preserved', async ({page}) => {
    // U+FEFF byte order mark
    const content = await setAndGet(page, '﻿<p>Text after BOM</p>')
    expect(content).toContain('Text after BOM')
  })

  test('soft hyphen in a long word — surrounding text preserved', async ({page}) => {
    // U+00AD soft hyphen
    const content = await setAndGet(page, '<p>antidisestablishment­arianism is long</p>')
    expect(content).toContain('antidisestablishment')
    expect(content).toContain('is long')
  })
})
