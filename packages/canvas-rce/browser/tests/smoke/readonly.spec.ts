import {test, expect} from '../../fixtures/test'

test.describe('readonly mode', () => {
  test('editor is in readonly mode', async ({page, rcePage}) => {
    await page.goto('/scenarios/readonly')
    await rcePage.waitForEditor()
    // TinyMCE sets aria-disabled="true" on the editor container in readonly mode
    await expect(page.locator('.tox-tinymce')).toHaveAttribute('aria-disabled', 'true')
  })

  test('defaultContent is visible', async ({page, rcePage}) => {
    await page.goto('/scenarios/readonly')
    await rcePage.waitForEditor()
    const body = rcePage.contentFrame().locator('body')
    await expect(body).toContainText('This content is read-only.')
  })
})
