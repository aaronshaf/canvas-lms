import {test, expect} from '../../fixtures/test'

// <dfn> marks the defining instance of a term. Used in course glossaries,
// textbook content, and reference materials. Often paired with <abbr> for
// acronym definitions, or wrapped in <p> with additional explanatory text.
test.describe('<dfn> definition term element', () => {
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

  test('<dfn> term in paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><dfn>Algorithm</dfn> is a step-by-step procedure for solving a problem.</p>',
    )
    expect(content).toContain('Algorithm')
    expect(content).toContain('step-by-step procedure')
  })

  test('<dfn title=""> with abbreviation — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><dfn title="HyperText Markup Language">HTML</dfn> is the language of the web.</p>',
    )
    expect(content).toContain('HTML')
    expect(content).toContain('language of the web')
  })

  test('<dfn> inside <dt> in definition list — term preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<dl><dt><dfn>Recursion</dfn></dt><dd>A function that calls itself.</dd></dl>',
    )
    expect(content).toContain('Recursion')
    expect(content).toContain('A function that calls itself')
  })

  test('multiple <dfn> elements — all terms preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Key terms: <dfn>Array</dfn>, <dfn>Stack</dfn>, and <dfn>Queue</dfn>.</p>',
    )
    expect(content).toContain('Array')
    expect(content).toContain('Stack')
    expect(content).toContain('Queue')
  })

  test('<dfn> inside <abbr> — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The <dfn><abbr title="Application Programming Interface">API</abbr></dfn> defines how software communicates.</p>',
    )
    expect(content).toContain('API')
    expect(content).toContain('communicates')
  })
})
