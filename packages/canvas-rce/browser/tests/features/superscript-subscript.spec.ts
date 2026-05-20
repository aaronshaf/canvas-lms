import {test, expect} from '../../fixtures/test'

// Superscript and Subscript are in Format menu and also via a split button
test.describe('superscript and subscript', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('superscript wraps selection in <sup>', async ({page, rcePage}) => {
    await rcePage.typeContent('H2O')
    // Select just '2' — move to position and select one char
    await rcePage.contentFrame().locator('body').press('Home')
    // Select all then apply sup via Format menu
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item[title="Superscript"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<sup>/)
  })

  test('subscript wraps selection in <sub>', async ({page, rcePage}) => {
    await rcePage.typeContent('CO2')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item[title="Subscript"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<sub>/)
  })
})
