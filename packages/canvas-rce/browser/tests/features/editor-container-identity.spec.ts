import {test, expect} from '../../fixtures/test'

// editor.getContainer(), editor.getBody(), editor.getDoc(), editor.getWin(),
// editor.id, and editor.targetElm are the identity and DOM access properties
// that plugins and the Canvas RCE wrapper use to wire up initialization logic,
// toolbar positioning, and event binding.
test.describe('editor container and identity properties', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('editor.id is a non-empty string', async ({page}) => {
    const id = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.id
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  test('editor.getContainer() returns a DOM element', async ({page}) => {
    const tag = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const container = window.tinymce.activeEditor.getContainer()
      return container ? container.tagName.toLowerCase() : null
    })
    expect(tag).not.toBeNull()
    expect(typeof tag).toBe('string')
  })

  test('editor.getBody() returns the body of the iframe document', async ({page}) => {
    const tag = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const body = window.tinymce.activeEditor.getBody()
      return body ? body.tagName.toLowerCase() : null
    })
    expect(tag).toBe('body')
  })

  test('editor.getDoc() returns the iframe document', async ({page}) => {
    const nodeType = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const doc = window.tinymce.activeEditor.getDoc()
      return doc ? doc.nodeType : null
    })
    expect(nodeType).toBe(9) // Node.DOCUMENT_NODE = 9
  })

  test('editor.getWin() returns the iframe window', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const win = window.tinymce.activeEditor.getWin()
      return typeof win
    })
    expect(type).toBe('object')
  })

  test('editor.targetElm is the textarea element', async ({page}) => {
    const tag = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const el = window.tinymce.activeEditor.targetElm
      return el ? el.tagName.toLowerCase() : null
    })
    expect(tag).toBe('textarea')
  })

  test('tinymce.get(editor.id) returns the same editor', async ({page}) => {
    const sameEditor = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      // @ts-expect-error -- TinyMCE global
      const found = window.tinymce.get(ed.id)
      return found === ed
    })
    expect(sameEditor).toBe(true)
  })
})
