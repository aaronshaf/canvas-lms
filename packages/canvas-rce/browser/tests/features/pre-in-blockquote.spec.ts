import {test, expect} from '../../fixtures/test'

// <pre> inside <blockquote> appears in quoted code samples and technical
// documentation. This combination is common in CS course pages that quote
// code from a reference and show it pre-formatted. Both elements must
// preserve their structural semantics and text content.
test.describe('<pre> inside <blockquote>', () => {
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

  test('<pre> inside <blockquote> — code text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>From the docs:</p><pre>const result = compute();\nreturn result;</pre></blockquote>',
    )
    expect(content).toContain('From the docs')
    expect(content).toContain('const result')
    expect(content).toContain('return result')
  })

  test('<pre><code> inside <blockquote> — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><pre><code class="language-python">def hello():\n    print("world")</code></pre></blockquote>',
    )
    expect(content).toContain('def hello')
    expect(content).toContain('print')
    expect(content).toContain('world')
  })

  test('paragraph and <pre> siblings in <blockquote> — both preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>Usage example:</p><pre>$ command --flag value</pre><p>Output above.</p></blockquote>',
    )
    expect(content).toContain('Usage example')
    expect(content).toContain('command --flag value')
    expect(content).toContain('Output above')
  })

  test('<blockquote> with <pre> and a cite attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote cite="https://docs.example.com"><pre>sample.code()</pre></blockquote><p>Source linked.</p>',
    )
    expect(content).toContain('sample.code')
    expect(content).toContain('Source linked')
  })
})
