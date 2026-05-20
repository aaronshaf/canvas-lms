import {test, expect} from '../../fixtures/test'

// editor.addShortcut() registers keyboard shortcuts that trigger commands or
// callbacks. Canvas toolbar extensions and custom plugins use this to add
// power-user shortcuts. The registration should succeed without throwing and
// the shortcut should be retrievable or at least not corrupt the editor.
test.describe('editor.addShortcut() API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('addShortcut with command — registration does not throw', async ({page}) => {
    const success = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      try {
        ed.addShortcut('meta+shift+b', 'Bold text shortcut', 'Bold')
        return true
      } catch {
        return false
      }
    })
    expect(success).toBe(true)
  })

  test('addShortcut with callback function — registration does not throw', async ({page}) => {
    const success = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      try {
        ed.addShortcut('meta+shift+h', 'Custom heading shortcut', () => {
          ed.execCommand('FormatBlock', false, 'h2')
        })
        return true
      } catch {
        return false
      }
    })
    expect(success).toBe(true)
  })

  test('multiple addShortcut registrations — all succeed', async ({page}) => {
    const count = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let registered = 0
      const shortcuts = [
        ['meta+shift+1', 'Heading 1', 'mceApplyTextcolor'],
        ['meta+shift+2', 'Heading 2', 'Bold'],
        ['meta+shift+3', 'Heading 3', 'Italic'],
      ]
      for (const [keys, desc, cmd] of shortcuts) {
        try {
          ed.addShortcut(keys, desc, cmd)
          registered++
        } catch {
          // count only successes
        }
      }
      return registered
    })
    expect(count).toBe(3)
  })

  test('addShortcut does not corrupt editor content', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.addShortcut('meta+shift+q', 'Quote block', () => {
        ed.execCommand('FormatBlock', false, 'blockquote')
      })
      ed.setContent('<p>Content after shortcut registration.</p>')
    })
    const content = await rcePage.getContent()
    expect(content).toContain('Content after shortcut registration')
  })

  test('addShortcut is a function on the editor', async ({page}) => {
    const isFunction = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.addShortcut === 'function'
    })
    expect(isFunction).toBe(true)
  })
})
