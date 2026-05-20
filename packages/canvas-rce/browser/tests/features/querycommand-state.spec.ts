import {test, expect} from '../../fixtures/test'

// queryCommandState and queryCommandValue let toolbar buttons reflect the
// current format state (bold button highlighted when cursor is inside <strong>).
// If these return wrong values, toolbar state becomes out-of-sync with content
// — a regression that breaks the editing UX without corrupting saved content.
test.describe('queryCommandState and queryCommandValue', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('queryCommandState("Bold") is true inside strong', async ({page}) => {
    const state = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Bold text</strong></p>')
      ed.selection.select(ed.getBody().querySelector('strong'))
      return ed.queryCommandState('Bold')
    })
    expect(state).toBe(true)
  })

  test('queryCommandState("Bold") is false on normal text', async ({page}) => {
    const state = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Normal paragraph</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      return ed.queryCommandState('Bold')
    })
    expect(state).toBe(false)
  })

  test('queryCommandState("Italic") is true inside em', async ({page}) => {
    const state = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><em>Italic text</em></p>')
      ed.selection.select(ed.getBody().querySelector('em'))
      return ed.queryCommandState('Italic')
    })
    expect(state).toBe(true)
  })

  test('queryCommandValue("FontName") returns string', async ({page}) => {
    const value = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p style="font-family: Arial;">Arial text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      return ed.queryCommandValue('FontName')
    })
    expect(typeof value).toBe('string')
  })

  test('queryCommandState is consistent before and after setContent', async ({page}) => {
    const [before, after] = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Plain text</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      const b = ed.queryCommandState('Bold')
      ed.setContent('<p><strong>Now bold</strong></p>')
      ed.selection.select(ed.getBody().querySelector('strong'))
      const a = ed.queryCommandState('Bold')
      return [b, a]
    })
    expect(before).toBe(false)
    expect(after).toBe(true)
  })
})
