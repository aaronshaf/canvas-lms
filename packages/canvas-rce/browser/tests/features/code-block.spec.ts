import {test, expect} from '../../fixtures/test'

// Code (inline) is in Format menu; Preformatted block is via Blocks dropdown
test.describe('code and preformatted', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('inline code wraps selection in <code>', async ({page, rcePage}) => {
    await rcePage.typeContent('const x = 1')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item[title="Code"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<code>/)
    expect(content).toContain('const x = 1')
  })

  test('preformatted block wraps content in <pre>', async ({page, rcePage}) => {
    await rcePage.contentFrame().locator('body').click()
    await page.keyboard.type('function hello() {}')
    await page.locator('.tox-toolbar__primary .tox-tbtn--bespoke[aria-label="Blocks"]').click()
    await page.locator('.tox-collection__item:has-text("Preformatted")').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<pre/)
    expect(content).toContain('function hello() {}')
  })

  test('inline code is removed by clear formatting', async ({page, rcePage}) => {
    await rcePage.typeContent('snippet')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item[title="Code"]').click()
    expect(await rcePage.getContent()).toMatch(/<code>/)

    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item:has-text("Clear formatting")').click()
    expect(await rcePage.getContent()).not.toMatch(/<code>/)
  })
})
