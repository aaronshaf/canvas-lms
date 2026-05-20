import {test, expect} from '../../fixtures/test'

// The tinymce global object exposes version, editors array, get(), and utility
// methods. These are entry points for Canvas integrations, plugins, and tests.
// Verifying them ensures the TinyMCE bundle is loading correctly and the
// global API surface is intact after any dependency upgrade.
test.describe('tinymce global API object', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('tinymce global exists and is an object', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce
    })
    expect(type).toBe('object')
  })

  test('tinymce.majorVersion is a numeric string', async ({page}) => {
    const major = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.majorVersion
    })
    expect(typeof major).toBe('string')
    expect(major).toMatch(/^\d+$/)
  })

  test('tinymce.minorVersion is a string', async ({page}) => {
    const minor = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.minorVersion
    })
    expect(typeof minor).toBe('string')
    expect(minor.length).toBeGreaterThan(0)
  })

  test('tinymce.editors is an array with at least one editor', async ({page}) => {
    const count = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.editors.length
    })
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('tinymce.get() by id returns the editor', async ({page}) => {
    const found = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const id = window.tinymce.activeEditor.id
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.get(id) !== null
    })
    expect(found).toBe(true)
  })

  test('tinymce.get() with unknown id returns null', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.get('nonexistent-id-xyz-999')
    })
    expect(result).toBeNull()
  })

  test('tinymce.activeEditor matches tinymce.editors[0]', async ({page}) => {
    const same = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const active = window.tinymce.activeEditor
      // @ts-expect-error -- TinyMCE global
      const first = window.tinymce.editors[0]
      return active.id === first.id
    })
    expect(same).toBe(true)
  })
})
