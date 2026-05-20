import {test, expect} from '../../fixtures/test'

// editor.insertContent() inserts HTML at the current cursor position.
// Canvas uses this to insert media embeds, file links, and equation images
// from dialogs. Position matters: content must land where the cursor was,
// not at the beginning/end, and existing content must not be displaced.
test.describe('editor.insertContent() position and behavior', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('insertContent after placing cursor at end of paragraph', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Existing text</p>')
      const p = ed.getBody().querySelector('p')
      ed.selection.setCursorLocation(p, p.childNodes.length)
      ed.insertContent(' <strong>inserted</strong>')
      return ed.getContent()
    })
    expect(content).toContain('Existing text')
    expect(content).toContain('inserted')
  })

  test('insertContent replaces selected text', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Replace this word please</p>')
      const p = ed.getBody().querySelector('p')
      // select all text in the paragraph
      ed.selection.select(p)
      ed.insertContent('<em>New content</em>')
      return ed.getContent()
    })
    expect(content).toContain('New content')
    expect(content).not.toContain('Replace this word please')
  })

  test('insertContent with an image tag — surrounding text preserved', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Before image</p>')
      const p = ed.getBody().querySelector('p')
      ed.selection.setCursorLocation(p, p.childNodes.length)
      ed.insertContent('<img src="inserted.png" alt="Inserted image">')
      return ed.getContent()
    })
    expect(content).toContain('Before image')
    expect(content).toContain('Inserted image')
  })

  test('insertContent with a table — table is present in output', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Before table</p>')
      const p = ed.getBody().querySelector('p')
      ed.selection.setCursorLocation(p, p.childNodes.length)
      ed.insertContent('<table><tr><td>Inserted cell</td></tr></table>')
      return ed.getContent()
    })
    expect(content).toContain('Before table')
    expect(content).toContain('Inserted cell')
  })

  test('insertContent called twice — both insertions present', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Start</p>')
      ed.insertContent(' <span>First insert</span>')
      ed.insertContent(' <span>Second insert</span>')
      return ed.getContent()
    })
    expect(content).toContain('First insert')
    expect(content).toContain('Second insert')
  })
})
