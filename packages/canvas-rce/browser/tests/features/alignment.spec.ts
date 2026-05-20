import {test, expect} from '../../fixtures/test'

// Align is a select button; dropdown shows "Left Align", "Center Align", "Right Align"
const alignBtn = '.tox-toolbar__primary .tox-tbtn--select[aria-label="Align"]'

test.describe('alignment', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('center alignment adds text-align:center style', async ({page, rcePage}) => {
    await page.keyboard.type('centered')
    await page.locator(alignBtn).click()
    await page.locator('.tox-collection__item[title="Center Align"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/text-align:\s*center/)
    expect(content).toContain('centered')
  })

  test('right alignment adds text-align:right style', async ({page, rcePage}) => {
    await page.keyboard.type('right aligned')
    await page.locator(alignBtn).click()
    await page.locator('.tox-collection__item[title="Right Align"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/text-align:\s*right/)
    expect(content).toContain('right aligned')
  })

  test('left alignment is the default — no explicit style', async ({page, rcePage}) => {
    await page.keyboard.type('left text')
    // Apply center first, then reset to left
    await page.locator(alignBtn).click()
    await page.locator('.tox-collection__item[title="Center Align"]').click()
    await page.locator(alignBtn).click()
    await page.locator('.tox-collection__item[title="Left Align"]').click()
    const content = await rcePage.getContent()
    // Left align either has no style or text-align:left — either is acceptable
    expect(content).not.toMatch(/text-align:\s*center/)
    expect(content).toContain('left text')
  })
})
