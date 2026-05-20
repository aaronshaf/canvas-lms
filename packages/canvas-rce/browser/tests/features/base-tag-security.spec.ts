import {test, expect} from '../../fixtures/test'

// <base> in a content body is a serious security issue: it rewrites all
// relative URLs on the page, so <base href="https://attacker.com"> redirects
// all link clicks to the attacker's server. It must be stripped from
// canvas-rce content body, just like <meta> and <script>.
test.describe('<base> tag security — must be stripped', () => {
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

  test('<base href> is stripped from content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<base href="https://evil.example.com" /><p>Safe content</p>',
    )
    expect(content).not.toContain('<base')
    expect(content).not.toContain('evil.example.com')
    expect(content).toContain('Safe content')
  })

  test('<base target="_blank"> is stripped', async ({page}) => {
    const content = await setAndGet(page, '<base target="_blank" /><p>Page text</p>')
    expect(content).not.toContain('<base')
    expect(content).toContain('Page text')
  })

  test('<base> with both href and target is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<base href="https://attacker.net" target="_top" /><h2>Heading</h2><p>Body paragraph.</p>',
    )
    expect(content).not.toContain('<base')
    expect(content).not.toContain('attacker.net')
    expect(content).toContain('Heading')
    expect(content).toContain('Body paragraph')
  })

  test('content before and after <base> tag is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>First paragraph</p><base href="https://evil.example.com" /><p>Second paragraph</p>',
    )
    expect(content).toContain('First paragraph')
    expect(content).toContain('Second paragraph')
    expect(content).not.toContain('<base')
  })

  test('multiple <base> tags are all stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<base href="https://a.evil.com" /><base href="https://b.evil.com" /><p>Content</p>',
    )
    expect(content).not.toContain('<base')
    expect(content).not.toContain('evil.com')
    expect(content).toContain('Content')
  })
})
