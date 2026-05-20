import {test, expect} from '../../fixtures/test'

// Microsoft Word generates verbose HTML with proprietary styles when content
// is copy-pasted. Canvas instructors paste from Word constantly. TinyMCE's
// paste plugin strips Word-specific markup but must preserve the meaningful
// text and structure. Tests use typical Word HTML patterns.
test.describe('Word-style HTML paste patterns', () => {
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

  test('Word paragraph with mso-* styles — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p class="MsoNormal" style="margin: 0in; font-size: 12pt; font-family: Times New Roman, serif; mso-fareast-font-family: Calibri;">Word document paragraph text</p>',
    )
    expect(content).toContain('Word document paragraph text')
  })

  test('Word heading with mso class — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h1 class="MsoHeading1" style="mso-style-priority: 9;">Chapter One: Introduction</h1>',
    )
    expect(content).toContain('Chapter One: Introduction')
    expect(content).toMatch(/<h1/)
  })

  test('Word list with mso-list styles — list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p class="MsoListParagraph" style="mso-list: l0 level1 lfo1;">First list item</p><p class="MsoListParagraph" style="mso-list: l0 level1 lfo1;">Second list item</p>',
    )
    expect(content).toContain('First list item')
    expect(content).toContain('Second list item')
  })

  test('Word table with mso border styles — all cells preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table class="MsoTableGrid" style="border-collapse: collapse; mso-border-alt: solid windowtext .5pt;"><tr><td style="border: solid windowtext 1pt; mso-border-alt: solid windowtext .5pt; padding: 0in 5.4pt;">Cell A</td><td style="border: solid windowtext 1pt;">Cell B</td></tr></table>',
    )
    expect(content).toContain('Cell A')
    expect(content).toContain('Cell B')
  })

  test('Word conditional comments — body text preserved', async ({page}) => {
    // TinyMCE preserves IE conditional comments (<!--[if gte mso 9]>...<![endif]-->)
    // as HTML comments, including <xml> content inside them. The body paragraph
    // must always be present; the conditional comment form is documented behavior.
    const content = await setAndGet(
      page,
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View></w:WordDocument></xml><![endif]--><p>Main content text</p>',
    )
    expect(content).toContain('Main content text')
    expect(typeof content).toBe('string')
  })

  test('Word span with font styling — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-size: 11pt; font-family: Calibri, sans-serif; mso-ascii-theme-font: minor-latin;">Calibri text from Word</span></p>',
    )
    expect(content).toContain('Calibri text from Word')
  })
})
