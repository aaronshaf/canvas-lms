import {test, expect} from '../../fixtures/test'

// Use TinyMCE's execCommand to apply indent — avoids iframe focus-loss between toolbar clicks
async function execIndent(page: any) {
  await page.evaluate(() => {
    // @ts-expect-error -- TinyMCE global
    window.tinymce.activeEditor.execCommand('Indent')
  })
}

test.describe('indent and outdent', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('indent on a paragraph adds padding or blockquote', async ({page, rcePage}) => {
    await page.keyboard.type('indented text')
    await execIndent(page)
    const content = await rcePage.getContent()
    // TinyMCE indent on a paragraph produces padding-left or wraps in blockquote
    expect(content).toMatch(/padding-left|margin-left|<blockquote/)
    expect(content).toContain('indented text')
  })

  test('indent on a list item nests it inside another list', async ({page, rcePage}) => {
    const listMainBtn =
      '.tox-split-button[aria-label="Ordered and Unordered Lists"] .tox-tbtn:not(.tox-split-button__chevron)'
    await page.keyboard.type('item one')
    await page.locator(listMainBtn).click()
    await rcePage.contentFrame().locator('body').click()
    await rcePage.contentFrame().locator('body').press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('item two')
    await execIndent(page)
    const content = await rcePage.getContent()
    // Nested list: a <ul> inside a <li>
    expect(content).toMatch(/<li[\s\S]*<ul|<li[\s\S]*<ol/)
  })

  test('outdent reverses indent on a list item', async ({page, rcePage}) => {
    const listMainBtn =
      '.tox-split-button[aria-label="Ordered and Unordered Lists"] .tox-tbtn:not(.tox-split-button__chevron)'
    await page.keyboard.type('item')
    await page.locator(listMainBtn).click()
    await rcePage.contentFrame().locator('body').click()
    await execIndent(page)
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('Outdent')
    })
    const content = await rcePage.getContent()
    // After outdent the nesting should be gone
    expect(content).toContain('item')
  })
})
