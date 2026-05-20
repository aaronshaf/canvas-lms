import {test, expect} from '../../fixtures/test'

// editor.windowManager opens TinyMCE dialogs and alerts. Canvas plugins use
// this to show the link dialog, image dialog, equation editor, and media
// insertion dialogs. Testing the API's presence and basic structure ensures
// the plugin infrastructure is intact before any refactor of the RCE wrapper.
test.describe('editor.windowManager API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('windowManager is defined on editor', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.windowManager
    })
    expect(type).toBe('object')
  })

  test('windowManager.open is a function', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.windowManager.open
    })
    expect(type).toBe('function')
  })

  test('windowManager.alert is a function', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.windowManager.alert
    })
    expect(type).toBe('function')
  })

  test('windowManager.confirm is a function', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.windowManager.confirm
    })
    expect(type).toBe('function')
  })

  test('windowManager.close is a function', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.windowManager.close
    })
    expect(type).toBe('function')
  })

  test('windowManager has expected method signatures', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const wm = window.tinymce.activeEditor.windowManager
      return {
        openIsFunction: typeof wm.open === 'function',
        alertIsFunction: typeof wm.alert === 'function',
        confirmIsFunction: typeof wm.confirm === 'function',
        closeIsFunction: typeof wm.close === 'function',
      }
    })
    expect(result.openIsFunction).toBe(true)
    expect(result.alertIsFunction).toBe(true)
    expect(result.confirmIsFunction).toBe(true)
    expect(result.closeIsFunction).toBe(true)
  })
})
