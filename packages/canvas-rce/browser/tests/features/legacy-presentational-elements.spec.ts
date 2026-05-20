import {test, expect} from '../../fixtures/test'

// Legacy presentational elements (<font>, <center>, <u>) exist in course content
// authored years ago or imported from Word/HTML files. Canvas must not crash or
// silently blank this content — even if TinyMCE converts the elements to CSS,
// the text must survive so old courses remain readable after an RCE refactor.
test.describe('legacy presentational elements from old content', () => {
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

  test('<font> element text is preserved (may be converted to span+style)', async ({page}) => {
    const content = await setAndGet(page, '<p><font color="red" size="4">Red large text</font></p>')
    expect(content).toContain('Red large text')
  })

  test('<font face="..."> text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p><font face="Arial">Arial text</font></p>')
    expect(content).toContain('Arial text')
  })

  test('<center> element text is preserved (may become text-align:center)', async ({page}) => {
    const content = await setAndGet(page, '<center>Centered content</center>')
    expect(content).toContain('Centered content')
  })

  test('<u> underline element is preserved or normalized', async ({page}) => {
    const content = await setAndGet(page, '<p><u>underlined text</u></p>')
    expect(content).toContain('underlined text')
  })

  test('<big> element text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p><big>big text</big></p>')
    expect(content).toContain('big text')
  })

  test('<small> element text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p><small>fine print</small></p>')
    expect(content).toContain('fine print')
  })

  test('<font> nested in a table cell preserves text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td><font color="blue">Blue cell text</font></td></tr></table>',
    )
    expect(content).toContain('Blue cell text')
  })

  test('mixed legacy and semantic elements in same paragraph', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><font color="green">green</font> and <strong>bold</strong> and <u>underlined</u></p>',
    )
    expect(content).toContain('green')
    expect(content).toContain('bold')
    expect(content).toContain('underlined')
  })

  test('<font> inside a list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><font color="red">Important item</font></li><li>Normal item</li></ul>',
    )
    expect(content).toContain('Important item')
    expect(content).toContain('Normal item')
  })
})
