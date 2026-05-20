import {test, expect} from '../../fixtures/test'

// Advanced XSS patterns beyond basic script tags. These test the sanitization
// pipeline against real-world attack vectors that naive sanitizers miss.
test.describe('advanced XSS sanitization', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  async function insert(page: any, html: string): Promise<string> {
    await page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(content)
    }, html)
    return page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    })
  }

  test('data: URI in img src is stripped', async ({page, rcePage}) => {
    // data: URIs in images can be used to exfiltrate data via load events
    const content = await insert(page, '<img src="data:text/html,<script>alert(1)</script>" />')
    // Either the img is removed entirely, or the data: src is sanitized
    if (content.includes('<img')) {
      expect(content).not.toContain('data:text/html')
      expect(content).not.toContain('<script>')
    }
  })

  test('SVG with embedded script is stripped or sanitized', async ({page, rcePage}) => {
    const content = await insert(page, '<svg><script>alert("svg-xss")</script></svg>')
    expect(content).not.toContain('alert("svg-xss")')
  })

  test('onload attribute on img is stripped', async ({page, rcePage}) => {
    const content = await insert(page, '<img src="x" onload="alert(1)" />')
    expect(content).not.toContain('onload')
  })

  test('onerror attribute on img is stripped', async ({page, rcePage}) => {
    const content = await insert(page, '<img src="invalid.png" onerror="alert(1)" />')
    expect(content).not.toContain('onerror')
  })

  test('meta refresh redirect is stripped', async ({page, rcePage}) => {
    const content = await insert(
      page,
      '<meta http-equiv="refresh" content="0; url=javascript:alert(1)">',
    )
    expect(content).not.toContain('http-equiv')
    expect(content).not.toContain('javascript:')
  })

  test('event handler on table cell is stripped', async ({page, rcePage}) => {
    const content = await insert(page, '<table><tr><td onclick="alert(1)">cell</td></tr></table>')
    expect(content).not.toContain('onclick')
    expect(content).toContain('cell')
  })

  test('style with expression (IE-style CSS injection) is sanitized', async ({page, rcePage}) => {
    const content = await insert(page, '<span style="width:expression(alert(1))">text</span>')
    // expression() should be stripped from style attributes
    expect(content).not.toContain('expression(')
  })

  test('base tag is stripped', async ({page, rcePage}) => {
    // A <base> tag could redirect all relative URLs to an attacker domain
    const content = await insert(page, '<base href="https://evil.example.com/" />')
    expect(content).not.toContain('<base')
  })

  test('comment-wrapped script does not produce an executable script tag', async ({
    page,
    rcePage,
  }) => {
    // TinyMCE may preserve HTML comments as-is; what matters is no *active* <script> tag
    // outside of a comment context appears in the serialized content
    const content = await insert(page, '<!--<script>alert(1)</script>-->')
    // If a <script> appears, it must be inside a comment (<!--...-->), not bare
    const bareScript = content.replace(/<!--[\s\S]*?-->/g, '').includes('<script>')
    expect(bareScript).toBe(false)
  })
})
