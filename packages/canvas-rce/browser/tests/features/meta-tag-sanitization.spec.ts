import {test, expect} from '../../fixtures/test'

// <meta> tags inside content body are injection vectors:
// - meta http-equiv="refresh" redirects users to malicious pages
// - meta http-equiv="set-cookie" injects cookies
// - meta charset changes page encoding (can bypass other filters)
// All meta tags must be stripped from the RCE content body.
test.describe('<meta> tag sanitization', () => {
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

  test('<meta http-equiv="refresh"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<meta http-equiv="refresh" content="0;url=https://evil.example.com" /><p>safe</p>',
    )
    expect(content).not.toContain('<meta')
    expect(content).not.toContain('evil.example.com')
    expect(content).toContain('safe')
  })

  test('<meta charset="utf-7"> encoding override is stripped', async ({page}) => {
    const content = await setAndGet(page, '<meta charset="utf-7" /><p>content</p>')
    expect(content).not.toContain('<meta')
    expect(content).toContain('content')
  })

  test('<meta name="viewport"> is stripped from body', async ({page}) => {
    const content = await setAndGet(
      page,
      '<meta name="viewport" content="width=device-width" /><p>page text</p>',
    )
    expect(content).not.toContain('<meta')
    expect(content).toContain('page text')
  })

  test('<meta http-equiv="set-cookie"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<meta http-equiv="set-cookie" content="session=hijacked" /><p>body</p>',
    )
    expect(content).not.toContain('set-cookie')
    expect(content).not.toContain('hijacked')
    expect(content).toContain('body')
  })

  test('content around <meta> tags is fully preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2>Title</h2><meta name="description" content="bad" /><p>Body text.</p>',
    )
    expect(content).toContain('Title')
    expect(content).toContain('Body text')
    expect(content).not.toContain('<meta')
  })
})
