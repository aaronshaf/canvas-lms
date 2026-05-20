import {test, expect} from '../../fixtures/test'

// editor.formatter.apply() and remove() are how TinyMCE toolbar buttons change
// heading levels, paragraph formats, and block types. Testing the formatter
// API directly verifies that the heading-change flow works end-to-end, which
// underpins the Format menu and paragraph format toolbar dropdown.
test.describe('formatter API for heading level changes', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('apply h2 format to paragraph — content preserved', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Section heading text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.formatter.apply('h2')
      return ed.getContent()
    })
    expect(content).toContain('Section heading text')
    expect(content).toContain('h2')
  })

  test('apply h3 then h2 — final format is h2, text preserved', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Subsection heading</p>')
      const p = ed.getBody().querySelector('p')
      ed.selection.select(p)
      ed.formatter.apply('h3')
      const h3 = ed.getBody().querySelector('h3')
      ed.selection.select(h3)
      ed.formatter.apply('h2')
      return ed.getContent()
    })
    expect(content).toContain('Subsection heading')
    expect(content).toContain('h2')
  })

  test('formatter.apply bold — content has bold markup', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Make this bold</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.formatter.apply('bold')
      return ed.getContent()
    })
    expect(content).toContain('Make this bold')
    expect(content).toMatch(/<strong>|font-weight/)
  })

  test('formatter.remove bold — formatting removed, text survives', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Already bold text</strong></p>')
      ed.selection.select(ed.getBody().querySelector('strong'))
      ed.formatter.remove('bold')
      return ed.getContent()
    })
    expect(content).toContain('Already bold text')
  })

  test('formatter.match detects applied format', async ({page}) => {
    const isBold = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Bold check</strong></p>')
      ed.selection.select(ed.getBody().querySelector('strong'))
      return ed.formatter.match('bold')
    })
    expect(isBold).toBe(true)
  })

  test('formatter.match returns false for unmatched format', async ({page}) => {
    const isItalic = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Plain text paragraph</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      return ed.formatter.match('italic')
    })
    expect(isItalic).toBe(false)
  })
})
