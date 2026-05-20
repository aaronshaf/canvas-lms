import {test, expect} from '../../fixtures/test'

// TinyMCE exposes formatting via execCommand (the legacy DOM command API).
// Canvas uses this path when toolbar buttons trigger Bold, Italic, etc.
// Tests verify that execCommand modifies content correctly and that the
// result is serialized properly — critical for toolbar refactoring.
test.describe('execCommand formatting commands', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('Bold command wraps selection in strong', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Hello world</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('Bold')
    })
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    })
    expect(content).toContain('Hello world')
    expect(content).toMatch(/<strong>|font-weight/)
  })

  test('Italic command wraps selection in em', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Italic test</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('Italic')
    })
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    })
    expect(content).toContain('Italic test')
    expect(content).toMatch(/<em>|font-style/)
  })

  test('InsertUnorderedList creates a list', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>List item text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('InsertUnorderedList')
    })
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    })
    expect(content).toContain('List item text')
    expect(content).toMatch(/<ul>|<li>/)
  })

  test('InsertOrderedList creates an ordered list', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Ordered item</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('InsertOrderedList')
    })
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    })
    expect(content).toContain('Ordered item')
    expect(content).toMatch(/<ol>|<li>/)
  })

  test('RemoveFormat strips inline formatting', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong><em>Formatted text</em></strong></p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('RemoveFormat')
    })
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    })
    expect(content).toContain('Formatted text')
    expect(content).not.toContain('<strong>')
    expect(content).not.toContain('<em>')
  })
})
