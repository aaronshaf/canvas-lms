import {test, expect} from '../../fixtures/test'

// <q> is the semantic inline quotation element — browsers render it with
// quotation marks automatically. The cite attribute points to the source URL.
// canvas-rce should preserve <q> and its content for accessible course material.
test.describe('inline quotation <q> element', () => {
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

  test('<q> element text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Einstein said <q>Imagination is more important than knowledge.</q></p>',
    )
    expect(content).toContain('Imagination is more important than knowledge')
    expect(content).toContain('Einstein said')
  })

  test('<q> with cite attribute is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>As stated in <q cite="https://example.com/source">the original text</q>.</p>',
    )
    expect(content).toContain('the original text')
    expect(content).toContain('As stated in')
  })

  test('nested <q> elements preserve both quotation levels', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>She said <q>He told me <q>come back tomorrow</q> yesterday.</q></p>',
    )
    expect(content).toContain('come back tomorrow')
    expect(content).toContain('yesterday')
  })

  test('<q> inside a list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Remember: <q>less is more</q></li><li>Also: <q>keep it simple</q></li></ul>',
    )
    expect(content).toContain('less is more')
    expect(content).toContain('keep it simple')
  })

  test('<q> with formatted text inside is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><q><strong>The key insight</strong> is that simplicity wins.</q></p>',
    )
    expect(content).toContain('The key insight')
    expect(content).toContain('simplicity wins')
    expect(content).toMatch(/<strong>/)
  })
})
