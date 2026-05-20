import {test, expect} from '../../fixtures/test'

// <link> tags belong in <head> only. In a content body they are used to
// inject external stylesheets (CSS injection attack) or load external
// resources. canvas-rce must strip them to prevent style hijacking.
test.describe('<link> tag in body — must be stripped', () => {
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

  test('<link rel="stylesheet"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<link rel="stylesheet" href="https://evil.example.com/attack.css" /><p>Safe text</p>',
    )
    expect(content).not.toContain('<link')
    expect(content).not.toContain('attack.css')
    expect(content).toContain('Safe text')
  })

  test('<link rel="import"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<link rel="import" href="https://evil.example.com/component.html" /><p>Content</p>',
    )
    expect(content).not.toContain('<link')
    expect(content).toContain('Content')
  })

  test('<link rel="preload"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<link rel="preload" href="https://tracker.example.com/pixel.png" as="image" /><p>Page content</p>',
    )
    expect(content).not.toContain('<link')
    expect(content).not.toContain('tracker.example.com')
    expect(content).toContain('Page content')
  })

  test('content around multiple <link> tags is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2>Title</h2><link rel="stylesheet" href="evil1.css" /><p>Body</p><link rel="stylesheet" href="evil2.css" /><p>Footer</p>',
    )
    expect(content).toContain('Title')
    expect(content).toContain('Body')
    expect(content).toContain('Footer')
    expect(content).not.toContain('<link')
  })
})
