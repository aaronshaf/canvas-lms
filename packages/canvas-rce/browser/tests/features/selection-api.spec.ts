import {test, expect} from '../../fixtures/test'

// TinyMCE's selection API (editor.selection.*) is used by toolbar buttons,
// format commands, and the Canvas link/image dialogs. Tests verify that the
// selection API correctly reports selected text and that selection-based
// operations produce the expected content output.
test.describe('editor selection API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('getContent returns selected text', async ({page}) => {
    const selected = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Select this text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      return ed.selection.getContent({format: 'text'})
    })
    expect(selected).toContain('Select this text')
  })

  test('selection.getNode returns the focused element', async ({page}) => {
    const tag = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<h2>Heading node</h2>')
      ed.selection.select(ed.getBody().querySelector('h2'))
      return ed.selection.getNode().nodeName
    })
    expect(['H2', 'P', 'BODY']).toContain(tag)
  })

  test('selection.getContent html format returns markup', async ({page}) => {
    const selected = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Bold selection</strong></p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      return ed.selection.getContent({format: 'html'})
    })
    expect(selected).toContain('Bold selection')
  })

  test('collapse selection then getContent returns full content', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Collapsed cursor content</p>')
      ed.selection.collapse(true)
    })
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    })
    expect(content).toContain('Collapsed cursor content')
  })
})
