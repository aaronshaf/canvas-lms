import {test, expect} from '../../fixtures/test'

// editor.notificationManager shows toast-style notifications to users —
// used by Canvas plugins to surface save errors, validation warnings, and
// upload progress. Testing the API exists and returns correct types verifies
// the notification infrastructure before plugin code uses it.
test.describe('editor.notificationManager API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('notificationManager is defined on editor', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.notificationManager
    })
    expect(type).toBe('object')
  })

  test('notificationManager.open is a function', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.notificationManager.open
    })
    expect(type).toBe('function')
  })

  test('notificationManager.open() returns a notification object', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const nm = window.tinymce.activeEditor.notificationManager
      const notification = nm.open({text: 'Test notification', type: 'info'})
      const hasClose = notification && typeof notification.close === 'function'
      if (notification && typeof notification.close === 'function') {
        notification.close()
      }
      return hasClose
    })
    expect(result).toBe(true)
  })

  test('notification can be opened and closed — no crash', async ({page}) => {
    const noCrash = await page.evaluate(() => {
      try {
        // @ts-expect-error -- TinyMCE global
        const nm = window.tinymce.activeEditor.notificationManager
        const n = nm.open({text: 'Save successful', type: 'success', timeout: 100})
        if (n && typeof n.close === 'function') n.close()
        return true
      } catch {
        return false
      }
    })
    expect(noCrash).toBe(true)
  })

  test('notificationManager.getNotifications returns array', async ({page}) => {
    const isArray = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const nm = window.tinymce.activeEditor.notificationManager
      return Array.isArray(nm.getNotifications())
    })
    expect(isArray).toBe(true)
  })
})
