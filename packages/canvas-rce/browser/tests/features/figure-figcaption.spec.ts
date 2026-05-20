import {test, expect} from '../../fixtures/test'

// <figure> and <figcaption> are HTML5 semantic elements for self-contained
// content with an optional caption (images, diagrams, code examples).
// They improve accessibility by associating the caption with the content.
// Canvas RCE must preserve their text through round-trips.
test.describe('<figure> and <figcaption> elements', () => {
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

  test('<figcaption> text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><img src="diagram.png" alt="System diagram" /><figcaption>Figure 1: System Architecture</figcaption></figure>',
    )
    expect(content).toContain('Figure 1: System Architecture')
  })

  test('<figure> without figcaption text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<figure><p>Figure content without caption</p></figure>')
    expect(content).toContain('Figure content without caption')
  })

  test('<figcaption> with formatted text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><img src="photo.jpg" alt="photo" /><figcaption><strong>Photo:</strong> Students in the lab</figcaption></figure>',
    )
    expect(content).toContain('Students in the lab')
    expect(content).toMatch(/<strong>/)
  })

  test('multiple <figure> elements all preserve captions', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><figcaption>Caption one</figcaption></figure><figure><figcaption>Caption two</figcaption></figure>',
    )
    expect(content).toContain('Caption one')
    expect(content).toContain('Caption two')
  })

  test('<figure> with a code block preserves caption and code', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><pre><code>const x = 1;</code></pre><figcaption>Listing 1: Variable declaration</figcaption></figure>',
    )
    expect(content).toContain('const x = 1')
    expect(content).toContain('Listing 1')
  })

  test('<figure> inside a list item preserves caption', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li><figure><figcaption>Step 1 diagram</figcaption></figure></li></ol>',
    )
    expect(content).toContain('Step 1 diagram')
  })
})
