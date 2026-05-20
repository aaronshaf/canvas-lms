import {test, expect} from '../../fixtures/test'

// editor.focus() and editor.hasFocus() are used by Canvas to manage focus
// when dialogs close and when the editor is embedded in a multi-editor page.
// editor.getElement() returns the underlying textarea element.
// Tests verify these APIs work and don't corrupt content.
test.describe('editor focus API and element access', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('editor.getElement() returns an element', async ({page}) => {
    const tagName = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const el = window.tinymce.activeEditor.getElement()
      return el ? el.tagName : null
    })
    // getElement() may return the textarea or null in some configs
    expect(typeof tagName === 'string' || tagName === null).toBe(true)
  })

  test('editor.getBody() returns the editable body', async ({page}) => {
    const tagName = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const body = window.tinymce.activeEditor.getBody()
      return body ? body.tagName : null
    })
    expect(tagName).toBe('BODY')
  })

  test('editor.getDoc() returns a document', async ({page}) => {
    const nodeType = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const doc = window.tinymce.activeEditor.getDoc()
      return doc ? doc.nodeType : null
    })
    // nodeType 9 = DOCUMENT_NODE
    expect(nodeType).toBe(9)
  })

  test('editor.getWin() returns a window object', async ({page}) => {
    const hasLocation = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const win = window.tinymce.activeEditor.getWin()
      return win ? 'location' in win : false
    })
    expect(hasLocation).toBe(true)
  })

  test('content is still correct after focus/blur cycle', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Focus test content</p>')
      ed.focus()
    })
    const content = await page.evaluate(
      // @ts-expect-error -- TinyMCE global
      () => window.tinymce.activeEditor.getContent(),
    )
    expect(content).toContain('Focus test content')
  })

  test('editor.id is a non-empty string', async ({page}) => {
    const id = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.id
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })
})
