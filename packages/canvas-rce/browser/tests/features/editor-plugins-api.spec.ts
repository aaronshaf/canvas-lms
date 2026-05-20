import {test, expect} from '../../fixtures/test'

// TinyMCE's plugin system exposes APIs through editor.plugins.*. The
// word-count, autoresize, and lists plugins are commonly loaded in Canvas.
// These tests verify plugin APIs are accessible and return expected types
// so future refactors don't silently break plugin integration.
test.describe('editor.plugins API access', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('editor.plugins is an object', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.plugins
    })
    expect(type).toBe('object')
  })

  test('editor has initialized plugins list', async ({page}) => {
    const pluginCount = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      return Object.keys(ed.plugins).length
    })
    expect(pluginCount).toBeGreaterThan(0)
  })

  test('editor.getParam returns configured value', async ({page}) => {
    const toolbar = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      // toolbar config is always a string or empty string
      return typeof ed.getParam('toolbar')
    })
    // toolbar param is always defined (string, array, or false)
    expect(['string', 'boolean', 'object']).toContain(toolbar)
  })

  test('editor.theme is defined', async ({page}) => {
    const theme = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.theme
    })
    expect(theme).toBe('object')
  })

  test('editor.mode.get() returns current mode string', async ({page}) => {
    const mode = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      return typeof ed.mode.get()
    })
    expect(mode).toBe('string')
  })

  test('editor.mode is design in basic scenario', async ({page}) => {
    const mode = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.mode.get()
    })
    expect(mode).toBe('design')
  })
})
