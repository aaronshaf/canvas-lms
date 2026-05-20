import {test, expect} from '../../fixtures/test'

// Definition lists (dl/dt/dd) are used in course content for glossaries,
// FAQ sections, and term definitions. They are semantic HTML that screen
// readers handle specially — canvas-rce must not flatten them to paragraphs.
test.describe('definition lists (dl/dt/dd)', () => {
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

  test('basic dl/dt/dd structure is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<dl><dt>HTML</dt><dd>HyperText Markup Language</dd></dl>',
    )
    expect(content).toContain('HTML')
    expect(content).toContain('HyperText Markup Language')
  })

  test('multiple term/definition pairs are all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<dl>
        <dt>CSS</dt><dd>Cascading Style Sheets</dd>
        <dt>JS</dt><dd>JavaScript</dd>
        <dt>DOM</dt><dd>Document Object Model</dd>
      </dl>`,
    )
    expect(content).toContain('CSS')
    expect(content).toContain('Cascading Style Sheets')
    expect(content).toContain('JS')
    expect(content).toContain('JavaScript')
    expect(content).toContain('DOM')
    expect(content).toContain('Document Object Model')
  })

  test('term with multiple definitions is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<dl><dt>Bark</dt><dd>Sound made by a dog</dd><dd>Outer layer of a tree</dd></dl>',
    )
    expect(content).toContain('Bark')
    expect(content).toContain('Sound made by a dog')
    expect(content).toContain('Outer layer of a tree')
  })

  test('dl inside a section paragraph context', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Key terms for this module:</p><dl><dt>Algorithm</dt><dd>A step-by-step procedure</dd></dl><p>Review before the exam.</p>',
    )
    expect(content).toContain('Key terms for this module')
    expect(content).toContain('Algorithm')
    expect(content).toContain('A step-by-step procedure')
    expect(content).toContain('Review before the exam')
  })

  test('definition with formatted text in dd is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<dl><dt>Bold term</dt><dd>Definition with <strong>important</strong> word and <em>emphasized</em> concept.</dd></dl>',
    )
    expect(content).toContain('Bold term')
    expect(content).toContain('important')
    expect(content).toContain('emphasized')
  })

  test('dt with strong for emphasis is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<dl><dt><strong>Critical Term</strong></dt><dd>Must know for the exam.</dd></dl>',
    )
    expect(content).toContain('Critical Term')
    expect(content).toContain('Must know for the exam')
  })
})
