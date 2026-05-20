import {test, expect} from '../../fixtures/test'

// TinyMCE's autolink plugin converts typed URLs to clickable links.
// When content is set programmatically, URLs in text may be converted
// to <a> tags. Tests verify the resulting content preserves the URL text
// whether or not it's wrapped in an anchor.
test.describe('autolink plugin behavior with URL text', () => {
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

  test('https URL in text — URL text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Visit https://example.com for details.</p>')
    expect(content).toContain('example.com')
    expect(content).toContain('for details')
  })

  test('explicit <a> href preserved through round-trip', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Go to <a href="https://canvas.instructure.com">Canvas</a> now.</p>',
    )
    expect(content).toContain('Canvas')
    expect(content).toContain('canvas.instructure.com')
    expect(content).toContain('now')
  })

  test('email address in text — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Email us at support@instructure.com with questions.</p>',
    )
    expect(content).toContain('support@instructure.com')
    expect(content).toContain('with questions')
  })

  test('URL with query parameters — full URL text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Check https://example.com/search?q=canvas&amp;page=1 for results.</p>',
    )
    expect(content).toContain('example.com')
    expect(content).toContain('for results')
  })

  test('URL inside a list item — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Documentation: https://docs.example.com</li><li>Support: https://help.example.com</li></ul>',
    )
    expect(content).toContain('docs.example.com')
    expect(content).toContain('help.example.com')
  })
})
