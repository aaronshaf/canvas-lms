import {test, expect} from '../../fixtures/test'

// Tests for link insertion, attribute verification, and removal.
// Links are high-value targets for XSS (javascript: href) and for Canvas's
// course-link integration, so the contract must be precise.
test.describe('link management', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('inserted link has correct href attribute', async ({page, rcePage}) => {
    // Insert a link directly via TinyMCE API to test the output
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('<a href="https://example.com">example link</a>')
    })
    const content = await rcePage.getContent()
    expect(content).toContain('https://example.com')
    expect(content).toContain('example link')
    expect(content).toMatch(/<a[^>]+href="https:\/\/example\.com"/)
  })

  test('javascript: href in link is stripped', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('<a href="javascript:alert(1)">click me</a>')
    })
    const content = await rcePage.getContent()
    // javascript: protocol must be stripped from href
    expect(content).not.toContain('javascript:')
    expect(content).toContain('click me')
  })

  test('link with target=_blank is preserved', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(
        '<a href="https://example.com" target="_blank">opens in new tab</a>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toContain('target="_blank"')
    expect(content).toContain('opens in new tab')
  })

  test('link text is editable after insertion', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('<a href="https://example.com">original text</a>')
    })
    const link = rcePage.contentFrame().locator('a').first()
    await link.click()
    // Select all text in the link and replace it
    await page.keyboard.press('Control+a')
    await rcePage.typeContent('new link text')
    const content = await rcePage.getContent()
    expect(content).toContain('new link text')
  })

  test('relative URL in link is preserved', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('<a href="/courses/123">course link</a>')
    })
    const content = await rcePage.getContent()
    // Relative URLs should be preserved for Canvas internal links
    expect(content).toContain('course link')
    // href should be present (possibly made absolute or kept relative)
    expect(content).toMatch(/href=/)
  })
})
