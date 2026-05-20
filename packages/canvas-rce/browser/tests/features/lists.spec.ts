import {test, expect} from '../../fixtures/test'

// The list split-button: main action is inside .tox-tbtn, chevron opens the dropdown.
const listMainBtn =
  '.tox-split-button[aria-label="Ordered and Unordered Lists"] .tox-tbtn:not(.tox-split-button__chevron)'
const listChevron =
  '.tox-split-button[aria-label="Ordered and Unordered Lists"] .tox-split-button__chevron'

test.describe('lists', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('clicking list button wraps content in <ul>', async ({page, rcePage}) => {
    await rcePage.typeContent('item one')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.locator(listMainBtn).click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<ul/)
    expect(content).toContain('item one')
  })

  test('ordered list via dropdown wraps content in <ol>', async ({page, rcePage}) => {
    await rcePage.typeContent('step one')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.locator(listChevron).click()
    await page.locator('[title="default numerical ordered list"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<ol/)
    expect(content).toContain('step one')
  })

  test('Enter key adds new list item', async ({page, rcePage}) => {
    await rcePage.typeContent('first item')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.locator(listMainBtn).click()
    // Re-focus the iframe body after toolbar click
    await rcePage.contentFrame().locator('body').click()
    await rcePage.contentFrame().locator('body').press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('second item')
    const content = await rcePage.getContent()
    const liMatches = content.match(/<li/g) ?? []
    expect(liMatches.length).toBeGreaterThanOrEqual(2)
  })
})
