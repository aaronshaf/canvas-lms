import {test, expect} from '../../fixtures/test'

// Multiple consecutive <br> tags are used for vertical spacing in legacy
// content authored without CSS (common in old Canvas pages and Word imports).
// TinyMCE may collapse them; tests verify that surrounding text is never lost
// and document the actual normalization behavior.
test.describe('multiple consecutive <br> tags', () => {
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

  test('text before and after two <br> tags is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Line A<br /><br />Line B</p>')
    expect(content).toContain('Line A')
    expect(content).toContain('Line B')
  })

  test('text around five consecutive <br> tags is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Top text<br /><br /><br /><br /><br />Bottom text</p>',
    )
    expect(content).toContain('Top text')
    expect(content).toContain('Bottom text')
  })

  test('<br> at start of paragraph — text still present', async ({page}) => {
    const content = await setAndGet(page, '<p><br />Text after leading br</p>')
    expect(content).toContain('Text after leading br')
  })

  test('<br> at end of paragraph — text still present', async ({page}) => {
    const content = await setAndGet(page, '<p>Text before trailing br<br /></p>')
    expect(content).toContain('Text before trailing br')
  })

  test('multiple <br> between paragraphs — both paragraphs preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Para one</p><br /><br /><p>Para two</p>')
    expect(content).toContain('Para one')
    expect(content).toContain('Para two')
  })

  test('<br> inside a list item — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>First line<br />Second line in same item</li></ul>',
    )
    expect(content).toContain('First line')
    expect(content).toContain('Second line in same item')
  })
})
