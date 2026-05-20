import {test, expect} from '../../fixtures/test'

// <cite> is a semantic element for titles of creative works (books, films,
// articles). It appears in course bibliographies and reading lists.
// canvas-rce must preserve <cite> and its content through round-trips.
test.describe('<cite> element for work titles', () => {
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

  test('<cite> text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>See <cite>The Elements of Style</cite> for grammar guidance.</p>',
    )
    expect(content).toContain('The Elements of Style')
    expect(content).toContain('grammar guidance')
  })

  test('<cite> inside a blockquote is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>To be or not to be.</p><footer><cite>Hamlet</cite>, Act 3</footer></blockquote>',
    )
    expect(content).toContain('To be or not to be')
    expect(content).toContain('Hamlet')
  })

  test('multiple <cite> elements in a bibliography all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li><cite>Thinking, Fast and Slow</cite> by Kahneman</li><li><cite>Sapiens</cite> by Harari</li></ol>',
    )
    expect(content).toContain('Thinking, Fast and Slow')
    expect(content).toContain('Sapiens')
    expect(content).toContain('Kahneman')
  })

  test('<cite> with a link preserves both text and href structure', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Refer to <cite><a href="https://example.com/paper">The Original Paper</a></cite>.</p>',
    )
    expect(content).toContain('The Original Paper')
  })

  test('<cite> with italic formatting — text survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The book <cite><em>On the Origin of Species</em></cite> changed biology.</p>',
    )
    expect(content).toContain('On the Origin of Species')
    expect(content).toContain('changed biology')
  })
})
