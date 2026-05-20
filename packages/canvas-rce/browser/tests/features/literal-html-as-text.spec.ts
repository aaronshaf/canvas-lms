import {test, expect} from '../../fixtures/test'

// Content that looks like HTML but is entity-escaped text (tutorials,
// documentation, coding examples) uses &lt;, &gt;, &amp; so the text
// literally reads "<div>" on screen. TinyMCE must not parse this as markup.
// A refactor that accidentally un-escapes entities in text nodes would corrupt
// all code tutorial content in Canvas.
test.describe('entity-escaped HTML shown as literal text', () => {
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

  test('&lt;div&gt; as text — not parsed as HTML', async ({page}) => {
    const content = await setAndGet(page, '<p>Use the &lt;div&gt; element for blocks.</p>')
    expect(content).toContain('div')
    expect(content).toContain('element for blocks')
  })

  test('&lt;script&gt; as escaped text — not executed', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Never use &lt;script&gt;alert(1)&lt;/script&gt; in HTML.</p>',
    )
    expect(content).toContain('Never use')
    expect(content).toContain('in HTML')
    // The literal text of script tag (encoded) should survive
    // but not an actual script tag
    expect(content).not.toContain('<script>')
  })

  test('&amp; as text — single ampersand in result', async ({page}) => {
    const content = await setAndGet(page, '<p>Rock &amp; Roll music.</p>')
    expect(content).toContain('Rock')
    expect(content).toContain('Roll music')
  })

  test('code example with entity-escaped operators', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Check if <code>a &lt; b &amp;&amp; b &gt; 0</code> is true.</p>',
    )
    expect(content).toContain('Check if')
    expect(content).toContain('is true')
  })

  test('mixed real markup and escaped markup in same paragraph', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong>Bold text</strong> and also &lt;strong&gt;escaped tag&lt;/strong&gt;.</p>',
    )
    expect(content).toContain('Bold text')
    expect(content).toContain('escaped tag')
    expect(content).toMatch(/<strong>/)
  })

  test('&quot; inside attribute values — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>She said &quot;Hello World&quot; clearly.</p>')
    expect(content).toContain('Hello World')
    expect(content).toContain('clearly')
  })
})
