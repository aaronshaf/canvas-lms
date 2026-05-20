import {test, expect} from '../../fixtures/test'

// editor.selection provides methods to get/set selected content and inspect
// the current node. These power copy/cut/paste behaviors and toolbar state
// (showing "Bold" as active when cursor is inside bold text).
test.describe('editor.selection content API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('selection.getContent() returns HTML of selected range', async ({page}) => {
    const selected = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Hello <strong>world</strong> here</p>')
      const strong = ed.getBody().querySelector('strong')
      const range = ed.getDoc().createRange()
      range.selectNode(strong)
      ed.selection.setRng(range)
      return ed.selection.getContent()
    })
    expect(selected).toContain('world')
    expect(selected).toContain('strong')
  })

  test('selection.getContent({format: "text"}) returns plain text', async ({page}) => {
    const text = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Bold</strong> and <em>italic</em></p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      return ed.selection.getContent({format: 'text'})
    })
    expect(text).toContain('Bold')
    expect(text).toContain('italic')
    expect(text).not.toContain('<strong>')
    expect(text).not.toContain('<em>')
  })

  test('selection.setContent() replaces selected content', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="p1">Replace me</p>')
      const p = ed.getBody().querySelector('#p1')
      ed.selection.select(p)
      ed.selection.setContent('<strong>Replaced!</strong>')
      return ed.getContent()
    })
    expect(content).toContain('Replaced!')
    expect(content).toContain('strong')
    expect(content).not.toContain('Replace me')
  })

  test('selection.getNode() returns element at cursor', async ({page}) => {
    const tag = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Bold text</strong></p>')
      const strong = ed.getBody().querySelector('strong')
      ed.selection.select(strong)
      const node = ed.selection.getNode()
      return node.tagName.toLowerCase()
    })
    // getNode returns the element containing the selection
    expect(['strong', 'p', 'body']).toContain(tag)
  })

  test('selection.select() on a paragraph — whole paragraph selected', async ({page}) => {
    const selectedText = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Full paragraph text</p><p>Second paragraph</p>')
      const firstP = ed.getBody().querySelector('p')
      ed.selection.select(firstP)
      return ed.selection.getContent({format: 'text'}).trim()
    })
    expect(selectedText).toContain('Full paragraph text')
  })

  test('selection.collapse() moves cursor without selection', async ({page}) => {
    const isCollapsed = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Some text here</p>')
      const p = ed.getBody().querySelector('p')
      ed.selection.select(p)
      ed.selection.collapse(true) // collapse to start
      return ed.selection.getRng().collapsed
    })
    expect(isCollapsed).toBe(true)
  })
})
