import {test, expect} from '../../fixtures/test'

test.describe('RCE loads', () => {
  test('editor mounts and toolbar is visible', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await expect(rcePage.toolbar()).toBeVisible()
  })

  test('content iframe is present', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await expect(rcePage.contentFrame().locator('body')).toBeVisible()
  })

  test('status bar is visible', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await expect(rcePage.statusBar()).toBeVisible()
  })
})
