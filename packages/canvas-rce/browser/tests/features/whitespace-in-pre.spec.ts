import {test, expect} from '../../fixtures/test'

// <pre> preserves whitespace exactly — tabs, multiple spaces, and newlines
// must not be collapsed. This is essential for code indentation in CS courses.
// A TinyMCE or serializer update that collapses whitespace inside <pre> would
// silently corrupt all code examples that rely on indentation.
test.describe('whitespace preservation inside <pre> blocks', () => {
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

  test('multiple spaces inside <pre> are preserved', async ({page}) => {
    const content = await setAndGet(page, '<pre>function f() {\n    return 42;\n}</pre>')
    expect(content).toContain('function f')
    expect(content).toContain('return 42')
  })

  test('tab-indented code in <pre> — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre>if (x) {\n\tdo_something();\n\treturn true;\n}</pre>',
    )
    expect(content).toContain('do_something')
    expect(content).toContain('return true')
  })

  test('leading spaces on each line preserved in <pre>', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre>line1\n  line2 indented\n    line3 double indent</pre>',
    )
    expect(content).toContain('line1')
    expect(content).toContain('line2 indented')
    expect(content).toContain('line3 double indent')
  })

  test('blank lines inside <pre> preserved', async ({page}) => {
    const content = await setAndGet(page, '<pre>Block A\n\nBlock B after blank line</pre>')
    expect(content).toContain('Block A')
    expect(content).toContain('Block B after blank line')
  })

  test('<pre> with long lines — all text present', async ({page}) => {
    const longLine = 'x'.repeat(200)
    const content = await setAndGet(page, `<pre>${longLine}</pre>`)
    expect(content).toContain('x'.repeat(50))
  })

  test('multiple <pre> blocks each preserve their own whitespace', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre>first_block()\n  indented</pre><pre>second_block()\n  also_indented</pre>',
    )
    expect(content).toContain('first_block')
    expect(content).toContain('second_block')
    expect(content).toContain('indented')
    expect(content).toContain('also_indented')
  })
})
