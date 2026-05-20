import {test, expect} from '../../fixtures/test'

// List items can contain block-level children: multiple <p> tags, headings,
// blockquotes, and nested lists. This appears in rich course outlines and
// structured documents. All block child content must survive round-trips.
test.describe('list items with block-level children', () => {
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

  test('<li> with multiple paragraphs — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li><p>First paragraph in item.</p><p>Second paragraph in item.</p></li><li><p>Second item.</p></li></ol>',
    )
    expect(content).toContain('First paragraph in item')
    expect(content).toContain('Second paragraph in item')
    expect(content).toContain('Second item')
  })

  test('<li> with a nested blockquote — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><p>Item intro.</p><blockquote><p>Supporting quote.</p></blockquote></li></ul>',
    )
    expect(content).toContain('Item intro')
    expect(content).toContain('Supporting quote')
  })

  test('<li> with a code block — code preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li><p>Run this command:</p><pre><code>npm install canvas-rce</code></pre></li></ol>',
    )
    expect(content).toContain('Run this command')
    expect(content).toContain('npm install canvas-rce')
  })

  test('<li> with an image and caption — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><p>Step one:</p><img src="step1.png" alt="Step 1 screenshot" /><p>Click the button shown above.</p></li></ul>',
    )
    expect(content).toContain('Step one')
    expect(content).toContain('Click the button shown above')
  })

  test('<li> containing a table — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><p>Comparison:</p><table><tr><th>Option A</th><th>Option B</th></tr><tr><td>Fast</td><td>Cheap</td></tr></table></li></ul>',
    )
    expect(content).toContain('Comparison')
    expect(content).toContain('Option A')
    expect(content).toContain('Fast')
    expect(content).toContain('Cheap')
  })
})
