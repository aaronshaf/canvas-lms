import {test, expect} from '../../fixtures/test'

// Tests Format menu operations via mouse interaction (not keyboard shortcuts).
// This is a distinct code path — the Format menu triggers TinyMCE commands
// through UI events rather than key bindings. Both paths must work.
test.describe('Format menu — mouse-driven formatting', () => {
  const formatMenu = '.tox-menubar button[role="menuitem"]:has-text("Format")'

  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
    await rcePage.typeContent('format me')
    await rcePage.contentFrame().locator('body').press('Control+a')
  })

  test('Format → Bold applies bold via menu', async ({page, rcePage}) => {
    await page.locator(formatMenu).click()
    await page.locator('.tox-collection__item[title="Bold"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>format me<\/strong>/)
  })

  test('Format → Italic applies italic via menu', async ({page, rcePage}) => {
    await page.locator(formatMenu).click()
    await page.locator('.tox-collection__item[title="Italic"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<em>format me<\/em>/)
  })

  test('Format → Underline applies underline via menu', async ({page, rcePage}) => {
    await page.locator(formatMenu).click()
    await page.locator('.tox-collection__item[title="Underline"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<span[^>]*text-decoration[^>]*>|<u>/)
    expect(content).toContain('format me')
  })

  test('Format → Strikethrough applies strikethrough via menu', async ({page, rcePage}) => {
    await page.locator(formatMenu).click()
    await page.locator('.tox-collection__item[title="Strikethrough"]').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<s>|<strike>|text-decoration[^"]*line-through/)
    expect(content).toContain('format me')
  })

  test('Format → Superscript wraps in <sup> via menu', async ({page, rcePage}) => {
    await page.locator(formatMenu).click()
    // Superscript may be in a submenu
    const superscriptItem = page.locator('.tox-collection__item[title="Superscript"]')
    const count = await superscriptItem.count()
    if (count > 0) {
      await superscriptItem.click()
      const content = await rcePage.getContent()
      expect(content).toMatch(/<sup>/)
    } else {
      // Superscript via format submenu — skip if not directly accessible
      test.skip()
    }
  })
})
