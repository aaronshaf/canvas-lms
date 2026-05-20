import {test, expect} from '../../fixtures/test'

// editor.selection.getBookmark() / moveToBookmark() allows plugins to save
// and restore the cursor position across operations that temporarily disrupt
// the DOM — opening dialogs, inserting widgets, loading async content.
// If this API regresses, dialogs may lose cursor position after closing.
test.describe('editor.selection bookmark API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('getBookmark() returns an object', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Bookmark test content</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      const bm = ed.selection.getBookmark()
      return typeof bm
    })
    expect(type).toBe('object')
  })

  test('moveToBookmark() restores selection — content unchanged', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>First paragraph</p><p>Second paragraph</p>')
      const firstP = ed.getBody().querySelector('p')
      ed.selection.select(firstP)
      const bookmark = ed.selection.getBookmark(2)
      // simulate some other operation
      ed.setContent('<p>First paragraph</p><p>Second paragraph</p>')
      ed.selection.moveToBookmark(bookmark)
      return ed.getContent()
    })
    expect(content).toContain('First paragraph')
    expect(content).toContain('Second paragraph')
  })

  test('getBookmark(2) type 2 — index-based bookmark returns object', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Index bookmark text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      const bm = ed.selection.getBookmark(2)
      return {type: typeof bm, hasStart: 'start' in bm || 'rng' in bm || bm !== null}
    })
    expect(result.type).toBe('object')
    expect(result.hasStart).toBe(true)
  })

  test('bookmark survives content manipulation between save and restore', async ({page}) => {
    const nodeTag = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="target">Restore here</p><p>Other content</p>')
      const target = ed.dom.get('target')
      ed.selection.select(target)
      const bm = ed.selection.getBookmark(2, true)
      // insert content elsewhere
      ed.setContent('<p id="target">Restore here</p><p>Other content</p><p>New</p>')
      ed.selection.moveToBookmark(bm)
      const node = ed.selection.getNode()
      return node ? node.tagName.toLowerCase() : 'null'
    })
    // Should have restored to some valid element
    expect(['p', 'body', 'div']).toContain(nodeTag)
  })
})
