import {test, expect} from '../../fixtures/test'

// Legacy HTML (especially from WYSIWYG editors, old CMS exports, and Word)
// often uses uppercase or mixed-case tag names: <P>, <BR>, <STRONG>, <TABLE>.
// TinyMCE normalizes these to lowercase. Tests verify that text is never lost
// during normalization — a refactor must not break this sanitization step.
test.describe('uppercase and mixed-case HTML tag normalization', () => {
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

  test('<P> uppercase paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<P>Uppercase paragraph text</P>')
    expect(content).toContain('Uppercase paragraph text')
  })

  test('<STRONG> uppercase bold — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<P><STRONG>Bold uppercase text</STRONG> and normal</P>')
    expect(content).toContain('Bold uppercase text')
    expect(content).toContain('and normal')
  })

  test('<TABLE><TR><TD> uppercase table — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<TABLE><TR><TD>Cell one</TD><TD>Cell two</TD></TR></TABLE>',
    )
    expect(content).toContain('Cell one')
    expect(content).toContain('Cell two')
  })

  test('<UL><LI> uppercase list — all items preserved', async ({page}) => {
    const content = await setAndGet(page, '<UL><LI>Item alpha</LI><LI>Item beta</LI></UL>')
    expect(content).toContain('Item alpha')
    expect(content).toContain('Item beta')
  })

  test('<H2> uppercase heading — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<H2>Section Title</H2><P>Section body.</P>')
    expect(content).toContain('Section Title')
    expect(content).toContain('Section body')
  })

  test('mixed-case tags — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Normal <Em>italic</Em> and <Strong>bold</Strong></p>')
    expect(content).toContain('italic')
    expect(content).toContain('bold')
  })

  test('<BR/> self-closing uppercase — content around it preserved', async ({page}) => {
    const content = await setAndGet(page, '<P>Line one<BR/>Line two</P>')
    expect(content).toContain('Line one')
    expect(content).toContain('Line two')
  })
})
