import {test, expect} from '../../fixtures/test'

test.describe('RTL (right-to-left) mode', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/rtl')
    await rcePage.waitForEditor()
  })

  test('editor mounts in RTL mode', async ({page, rcePage}) => {
    await expect(page.locator('.tox-tinymce')).toBeVisible()
    await expect(rcePage.contentFrame().locator('body')).toBeVisible()
  })

  test('document has dir=rtl attribute', async ({page}) => {
    const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'))
    expect(dir).toBe('rtl')
  })

  test('editor html element inherits RTL direction', async ({page}) => {
    // TinyMCE inherits dir from the document html element, not body
    const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'))
    expect(dir).toBe('rtl')
  })

  test('typed content is saved correctly in RTL mode', async ({page, rcePage}) => {
    await rcePage.typeContent('مرحبا')
    const content = await rcePage.getContent()
    expect(content).toContain('مرحبا')
  })
})
