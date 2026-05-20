import {test, expect} from '../../fixtures/test'

// Verifies that setContent() (which backs the defaultContent prop) also runs
// content through canvas-rce's sanitization pipeline.
// A bypass here would let XSS into Canvas via the defaultContent prop.
test.describe('setContent sanitization', () => {
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

  test('script tag in setContent is stripped', async ({page}) => {
    const content = await setAndGet(page, '<p>safe</p><script>alert("xss")</script>')
    expect(content).not.toContain('<script>')
    expect(content).toContain('safe')
  })

  test('onclick attribute in setContent is stripped', async ({page}) => {
    const content = await setAndGet(page, '<div onclick="alert(1)">text</div>')
    expect(content).not.toContain('onclick')
    expect(content).toContain('text')
  })

  test('javascript: href in setContent is stripped', async ({page}) => {
    const content = await setAndGet(page, '<a href="javascript:alert(1)">link</a>')
    expect(content).not.toContain('javascript:')
    expect(content).toContain('link')
  })

  test('safe HTML in setContent is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2>Title</h2><p><strong>bold</strong> and <em>italic</em></p>',
    )
    expect(content).toMatch(/<h2/)
    expect(content).toMatch(/<strong>bold<\/strong>/)
    expect(content).toMatch(/<em>italic<\/em>/)
  })

  test('SVG with script in setContent is sanitized', async ({page}) => {
    const content = await setAndGet(page, '<svg><script>alert("svg")</script><rect /></svg>')
    expect(content).not.toContain('alert("svg")')
  })

  test('style attribute with expression in setContent is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span style="color:red;width:expression(alert(1))">text</span>',
    )
    expect(content).not.toContain('expression(')
    expect(content).toContain('text')
  })
})
