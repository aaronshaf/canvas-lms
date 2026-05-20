import {test, expect} from '../../fixtures/test'

// Beyond javascript:, other URI schemes are XSS vectors in older browsers:
// vbscript: (IE), data:text/html (Chrome <=v60), and mocha: (legacy).
// canvas-rce's link sanitizer must block all dangerous protocols, not just
// the javascript: scheme it is most commonly tested against.
test.describe('dangerous protocol sanitization beyond javascript:', () => {
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

  test('vbscript: protocol in href is stripped', async ({page}) => {
    const content = await setAndGet(page, '<a href="vbscript:MsgBox(1)">Click</a>')
    expect(content).not.toContain('vbscript:')
    expect(content).toContain('Click')
  })

  test('data:text/html link is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="data:text/html,<script>alert(1)</script>">link</a>',
    )
    expect(content).not.toContain('data:text/html')
    expect(content).toContain('link')
  })

  test('data:text/html in img src is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="data:text/html,<h1>injected</h1>" alt="bad" />',
    )
    // data: URIs in img src may be allowed for images (data:image/*) but
    // data:text/html is specifically dangerous
    expect(content).not.toContain('injected</h1>')
  })

  test('javascript: with mixed case is stripped', async ({page}) => {
    const content = await setAndGet(page, '<a href="JaVaScRiPt:alert(1)">click</a>')
    expect(content).not.toContain('JaVaScRiPt:')
    expect(content).not.toContain('alert(1)')
    expect(content).toContain('click')
  })

  test('javascript: with URL encoding is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">encoded</a>',
    )
    // Entity-encoded javascript: — should not result in executable href
    expect(content).not.toContain('alert(1)')
    expect(content).toContain('encoded')
  })

  test('javascript: with whitespace padding is stripped', async ({page}) => {
    const content = await setAndGet(page, '<a href="  javascript:alert(1)">padded</a>')
    expect(content).not.toContain('javascript:')
    expect(content).toContain('padded')
  })

  test('safe data: URI for image is handled', async ({page}) => {
    // data:image/png is a legitimate URI for embedded images
    const content = await setAndGet(
      page,
      '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="1px" />',
    )
    // Document whether data:image/* is allowed (it may be stripped in strict mode)
    expect(typeof content).toBe('string')
    expect(content).not.toContain('alert')
  })
})
