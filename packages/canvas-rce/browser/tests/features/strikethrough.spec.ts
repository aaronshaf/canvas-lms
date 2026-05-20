import {test, expect} from '../../fixtures/test'

test.describe('strikethrough', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('strikethrough via Format menu wraps selection in <s>', async ({page, rcePage}) => {
    await rcePage.typeContent('delete me')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item[title="Strikethrough"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<s>|<del>|text-decoration[^"]*line-through/)
    expect(content).toContain('delete me')
  })

  test('strikethrough can be toggled off', async ({page, rcePage}) => {
    await rcePage.typeContent('toggle')
    await rcePage.contentFrame().locator('body').press('Control+a')
    // Apply strikethrough
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item[title="Strikethrough"]').click()
    // Apply again to toggle off
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item[title="Strikethrough"]').click()
    const content = await rcePage.getContent()
    // Should not have strikethrough markup
    expect(content).not.toMatch(/<s>|<del>/)
    expect(content).toContain('toggle')
  })
})
