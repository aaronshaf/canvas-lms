import {test, expect} from '../../fixtures/test'

// editor.insertContent() inserts HTML at the current cursor position.
// Canvas uses this when the Link dialog, Image dialog, and Equation editor
// inject their output into the document. Tests verify the inserted content
// appears correctly alongside existing content.
test.describe('editor.insertContent() API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('insertContent adds text at cursor position', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Before | After</p>')
      ed.insertContent('<strong>INSERTED</strong>')
      return ed.getContent()
    })
    expect(content).toContain('INSERTED')
  })

  test('insertContent after setContent preserves both', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Existing text</p>')
      // move cursor to body then insert
      ed.selection.select(ed.getBody(), true)
      ed.selection.collapse(false)
      ed.insertContent('<p>New paragraph</p>')
      return ed.getContent()
    })
    expect(content).toContain('Existing text')
    expect(content).toContain('New paragraph')
  })

  test('insertContent with an image element', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Caption: </p>')
      ed.insertContent('<img src="photo.jpg" alt="Inserted photo" />')
      return ed.getContent()
    })
    expect(content).toContain('alt')
  })

  test('insertContent with a link element', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>See: </p>')
      ed.insertContent('<a href="https://example.com">the resource</a>')
      return ed.getContent()
    })
    expect(content).toContain('the resource')
    expect(content).toContain('example.com')
  })

  test('insertContent with a table', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('')
      ed.insertContent('<table><tr><td>Inserted cell A</td><td>Inserted cell B</td></tr></table>')
      return ed.getContent()
    })
    expect(content).toContain('Inserted cell A')
    expect(content).toContain('Inserted cell B')
  })
})
