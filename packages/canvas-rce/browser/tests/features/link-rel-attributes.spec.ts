import {test, expect} from '../../fixtures/test'

// External links opened with target="_blank" should carry rel="noopener noreferrer"
// for security (prevents the opened tab from accessing window.opener).
// Canvas course content links must have this attribute added or preserved.
// Also tests rel="nofollow" and other valid rel values.
test.describe('link rel attribute handling', () => {
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

  test('rel="noopener noreferrer" on external link is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">external</a>',
    )
    expect(content).toContain('external')
    expect(content).toMatch(/href="https:\/\/example\.com"/)
    expect(content).toMatch(/target="_blank"/)
    // rel should be preserved — it is a security attribute
    expect(content).toMatch(/rel="noopener noreferrer"/)
  })

  test('rel="nofollow" on link is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://example.com" rel="nofollow">sponsored link</a>',
    )
    expect(content).toContain('sponsored link')
    expect(content).toMatch(/href="https:\/\/example\.com"/)
  })

  test('link without rel attribute is preserved as-is', async ({page}) => {
    const content = await setAndGet(page, '<a href="https://example.com">plain link</a>')
    expect(content).toContain('plain link')
    expect(content).toMatch(/href="https:\/\/example\.com"/)
  })

  test('link with rel and title together are both preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://example.com" rel="noopener" title="External resource">link text</a>',
    )
    expect(content).toContain('link text')
    expect(content).toMatch(/href="https:\/\/example\.com"/)
  })

  test('internal anchor link has no rel requirement', async ({page}) => {
    const content = await setAndGet(page, '<a href="#section-2">Jump to section 2</a>')
    expect(content).toContain('Jump to section 2')
    expect(content).toMatch(/href="#section-2"/)
  })

  test('mailto link with rel attribute is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="mailto:help@example.com" rel="noopener">Email support</a>',
    )
    expect(content).toContain('Email support')
    expect(content).toContain('mailto:help@example.com')
  })

  test('target="_blank" without rel still preserves both', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://canvas.instructure.com" target="_blank">Canvas</a>',
    )
    expect(content).toContain('Canvas')
    expect(content).toMatch(/target="_blank"/)
  })
})
