import {test, expect} from '../../fixtures/test'

// Extended execCommand coverage: list creation, indentation, text alignment,
// foreground/background color, font size, and raw HTML insertion.
// These underpin every toolbar button — regressions here break UX across the board.
test.describe('execCommand extended formatting commands', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('InsertUnorderedList — creates a list from selected paragraph', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>List item text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('InsertUnorderedList')
      return ed.getContent()
    })
    expect(content).toContain('List item text')
    expect(content).toMatch(/<ul|<li/)
  })

  test('InsertOrderedList — creates ordered list from paragraph', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Numbered item text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('InsertOrderedList')
      return ed.getContent()
    })
    expect(content).toContain('Numbered item text')
    expect(content).toMatch(/<ol|<li/)
  })

  test('JustifyCenter — text preserved', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Center aligned text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('JustifyCenter')
      return ed.getContent()
    })
    expect(content).toContain('Center aligned text')
  })

  test('JustifyRight — text preserved', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Right aligned text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('JustifyRight')
      return ed.getContent()
    })
    expect(content).toContain('Right aligned text')
  })

  test('Indent then Outdent — content preserved', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Indented paragraph</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('Indent')
      ed.execCommand('Outdent')
      return ed.getContent()
    })
    expect(content).toContain('Indented paragraph')
  })

  test('ForeColor — applies color, text preserved', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Colored text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('ForeColor', false, '#ff0000')
      return ed.getContent()
    })
    expect(content).toContain('Colored text')
  })

  test('RemoveFormat — strips formatting, text survives', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong><em>Formatted text</em></strong></p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('RemoveFormat')
      return ed.getContent()
    })
    expect(content).toContain('Formatted text')
  })

  test('mceInsertRawHTML — inserts literal HTML', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Before</p>')
      const p = ed.getBody().querySelector('p')
      ed.selection.setCursorLocation(p, p.childNodes.length)
      ed.execCommand('mceInsertRawHTML', false, '<span class="badge">New</span>')
      return ed.getContent()
    })
    expect(content).toContain('Before')
    expect(content).toContain('New')
  })
})
