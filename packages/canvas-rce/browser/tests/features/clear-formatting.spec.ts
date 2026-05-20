import {test, expect} from '../../fixtures/test'

test.describe('clear formatting', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('clear formatting removes bold from selected text', async ({page, rcePage}) => {
    await rcePage.typeContent('bold text')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')
    expect(await rcePage.getContent()).toMatch(/<strong>/)

    // Format menu → Clear formatting
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item:has-text("Clear formatting")').click()
    const content = await rcePage.getContent()
    expect(content).not.toMatch(/<strong>/)
    expect(content).toContain('bold text')
  })

  test('clear formatting removes italic', async ({page, rcePage}) => {
    await rcePage.typeContent('italic text')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+i')
    expect(await rcePage.getContent()).toMatch(/<em>/)

    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item:has-text("Clear formatting")').click()
    const content = await rcePage.getContent()
    expect(content).not.toMatch(/<em>/)
    expect(content).toContain('italic text')
  })

  test('clear formatting removes inline styles applied inside a heading', async ({
    page,
    rcePage,
  }) => {
    await rcePage.contentFrame().locator('body').click()
    await page.keyboard.type('heading text')
    // Apply H2 block
    await page.locator('.tox-toolbar__primary .tox-tbtn--bespoke[aria-label="Blocks"]').click()
    await page.locator('.tox-collection__item:has-text("Heading 2")').click()
    // Apply italic inside the heading
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+i')
    expect(await rcePage.getContent()).toMatch(/<em>/)

    // Clear formatting removes the inline <em> but keeps the <h2> block
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item:has-text("Clear formatting")').click()
    const content = await rcePage.getContent()
    expect(content).not.toMatch(/<em>/)
    expect(content).toMatch(/<h2/)
    expect(content).toContain('heading text')
  })
})
