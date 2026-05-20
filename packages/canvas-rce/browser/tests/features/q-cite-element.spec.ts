import {test, expect} from '../../fixtures/test'

// <q> marks inline quotations and supports a cite attribute for the source URL.
// Course content uses <q> for short quotes within paragraphs, distinguished from
// block-level <blockquote>. The cite attribute is informational (not rendered by
// browsers) but must survive for semantic preservation.
test.describe('<q> inline quotation element', () => {
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

  test('<q> inline quotation — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>As Shakespeare wrote, <q>To be or not to be</q>, that is the question.</p>',
    )
    expect(content).toContain('To be or not to be')
    expect(content).toContain('that is the question')
  })

  test('<q> with cite attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>According to the spec: <q cite="https://html.spec.whatwg.org/">The cite attribute gives the address of the source.</q></p>',
    )
    expect(content).toContain('gives the address of the source')
  })

  test('nested <q> for quote within quote — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>She said <q>He told me <q>come back tomorrow</q> last week</q>.</p>',
    )
    expect(content).toContain('come back tomorrow')
    expect(content).toContain('last week')
  })

  test('multiple <q> in paragraph — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The terms <q>array</q> and <q>list</q> are sometimes used interchangeably.</p>',
    )
    expect(content).toContain('array')
    expect(content).toContain('list')
    expect(content).toContain('interchangeably')
  })

  test('<q> inside <blockquote> — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>The author noted: <q>brevity is the soul of wit.</q></p></blockquote>',
    )
    expect(content).toContain('brevity is the soul of wit')
  })

  test('<q lang="fr"> — French quote text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>In French: <q lang="fr">Liberté, Égalité, Fraternité</q>.</p>',
    )
    // French accented chars may be entity-encoded
    expect(content).toContain('Libert')
  })
})
