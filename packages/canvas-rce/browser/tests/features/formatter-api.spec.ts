import {test, expect} from '../../fixtures/test'

// TinyMCE's editor.formatter API applies named formats (bold, italic,
// custom canvas formats) to selected content. Canvas toolbar buttons
// use this API instead of raw execCommand in newer TinyMCE builds.
// Tests verify that formatter.apply/remove correctly modify content.
test.describe('editor.formatter API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('formatter.apply("bold") wraps selection in strong', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Apply bold here</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.formatter.apply('bold')
    })
    const content = await page.evaluate(
      // @ts-expect-error -- TinyMCE global
      () => window.tinymce.activeEditor.getContent(),
    )
    expect(content).toContain('Apply bold here')
    expect(content).toMatch(/<strong>|font-weight/)
  })

  test('formatter.apply("italic") wraps selection in em', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Apply italic here</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.formatter.apply('italic')
    })
    const content = await page.evaluate(
      // @ts-expect-error -- TinyMCE global
      () => window.tinymce.activeEditor.getContent(),
    )
    expect(content).toContain('Apply italic here')
    expect(content).toMatch(/<em>|font-style/)
  })

  test('formatter.remove("bold") strips bold from selection', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Remove bold</strong></p>')
      ed.selection.select(ed.getBody().querySelector('strong'))
      ed.formatter.remove('bold')
    })
    const content = await page.evaluate(
      // @ts-expect-error -- TinyMCE global
      () => window.tinymce.activeEditor.getContent(),
    )
    expect(content).toContain('Remove bold')
    expect(content).not.toContain('<strong>')
  })

  test('formatter.match("bold") returns true on bold node', async ({page}) => {
    const isBold = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Bold node</strong></p>')
      ed.selection.select(ed.getBody().querySelector('strong'))
      return ed.formatter.match('bold')
    })
    expect(isBold).toBe(true)
  })

  test('formatter.match("bold") returns false on normal text', async ({page}) => {
    const isBold = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Normal text only</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      return ed.formatter.match('bold')
    })
    expect(isBold).toBe(false)
  })
})
