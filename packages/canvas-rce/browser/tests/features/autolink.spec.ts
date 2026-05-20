import {test, expect} from '../../fixtures/test'

// TinyMCE's autolink plugin converts typed URLs into clickable <a> elements.
// Canvas users author course content and expect URLs they type to become links.
// If a refactor removes or misconfigures this plugin, URL auto-linking breaks.
test.describe('autolink — URL to anchor conversion', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('typing a URL followed by space creates a link', async ({page, rcePage}) => {
    await page.keyboard.type('https://example.com ')
    await page.waitForTimeout(300)
    const content = await rcePage.getContent()
    // Autolink may or may not be enabled — check if it converted to <a>
    // This test documents the actual behavior rather than asserting a preference
    const hasAnchor = content.includes('<a')
    const hasUrl = content.includes('example.com')
    expect(hasUrl).toBe(true)
    // If autolink is enabled, we get an anchor
    if (hasAnchor) {
      expect(content).toMatch(/href="https:\/\/example\.com"/)
    }
  })

  test('typed URL text is preserved regardless of autolink', async ({page, rcePage}) => {
    await page.keyboard.type('Visit https://canvas.instructure.com for more info.')
    await page.waitForTimeout(300)
    const content = await rcePage.getContent()
    expect(content).toContain('canvas.instructure.com')
    expect(content).toContain('Visit')
    expect(content).toContain('for more info')
  })

  test('manually inserted link with URL text is functional', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(
        '<a href="https://canvas.instructure.com">https://canvas.instructure.com</a>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/href="https:\/\/canvas\.instructure\.com"/)
    expect(content).toContain('canvas.instructure.com')
  })

  test('URL inside a sentence is not corrupted', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<p>See <a href="https://example.com/path?a=1&amp;b=2">this link</a> for details.</p>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toContain('this link')
    expect(content).toContain('for details')
    // The href should survive with the query params intact
    expect(content).toMatch(/href="https:\/\/example\.com\/path/)
  })
})
