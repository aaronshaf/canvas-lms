import {test, expect} from '../../fixtures/test'

// Canvas course content uses many link types beyond plain https://. These tests
// verify that mailto:, tel:, anchor (#hash), and relative links all survive
// canvas-rce's sanitization pipeline without being stripped or rewritten.
test.describe('link types — protocols and forms', () => {
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

  test('mailto: link is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="mailto:instructor@example.edu">Email the instructor</a>',
    )
    expect(content).toContain('Email the instructor')
    expect(content).toContain('mailto:instructor@example.edu')
  })

  test('anchor (#hash) link is preserved', async ({page}) => {
    const content = await setAndGet(page, '<a href="#section-2">Jump to section</a>')
    expect(content).toContain('Jump to section')
    expect(content).toMatch(/href="#section-2"/)
  })

  test('tel: link is preserved', async ({page}) => {
    const content = await setAndGet(page, '<a href="tel:+15551234567">Call us</a>')
    expect(content).toContain('Call us')
    // tel: is a legitimate protocol for click-to-call
    expect(content).toContain('tel:')
  })

  test('https:// link with query params is preserved', async ({page}) => {
    const url = 'https://example.com/course?id=123&section=overview'
    const content = await setAndGet(page, `<a href="${url}">course overview</a>`)
    expect(content).toContain('course overview')
    // URL may have & encoded as &amp; — both are acceptable
    expect(content).toMatch(/href="https:\/\/example\.com\/course/)
  })

  test('relative path link is preserved', async ({page}) => {
    const content = await setAndGet(page, '<a href="/courses/123/assignments/456">Assignment</a>')
    expect(content).toContain('Assignment')
    expect(content).toMatch(/\/courses\/123\/assignments\/456/)
  })

  test('link with both href and title is preserved intact', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://example.com" title="Opens example.com" target="_blank">Example</a>',
    )
    expect(content).toContain('Example')
    expect(content).toMatch(/href="https:\/\/example\.com"/)
    expect(content).toMatch(/title="Opens example\.com"/)
    expect(content).toMatch(/target="_blank"/)
  })

  test('javascript: link is still stripped for all link forms', async ({page}) => {
    const content = await setAndGet(page, '<a href="javascript:void(document.cookie)">Click</a>')
    expect(content).not.toContain('javascript:')
    expect(content).toContain('Click')
  })
})
