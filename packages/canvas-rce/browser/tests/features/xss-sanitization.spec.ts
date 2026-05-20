import {test, expect} from '../../fixtures/test'

// These cases mirror canvas-rce/src/rce/__tests__/contentRendering.xss.test.js
// They assert that the *output* HTML from getContent() is safe — the compliance
// contract for any canvas-rce refactor.
const htmlEditorContainer = '.RceHtmlEditor'
const toggleBtn = '[data-btn-id="rce-edit-btn"]'

async function setRawHtml(page: any, html: string) {
  await page.locator(toggleBtn).click()
  await expect(page.locator(htmlEditorContainer)).toBeVisible({timeout: 10_000})
  const cmContent = page.locator('.RceHtmlEditor .cm-content')
  await cmContent.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type(html)
  await page.locator(toggleBtn).click()
}

test.describe('XSS sanitization', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('script tags are stripped from content', async ({page, rcePage}) => {
    await setRawHtml(page, '<p>hello</p><script>alert("xss")</script>')
    await rcePage.waitForEditor()
    const content = await rcePage.getContent()
    expect(content).not.toContain('<script>')
    expect(content).toContain('hello')
  })

  test('onerror event attributes are stripped', async ({page, rcePage}) => {
    await setRawHtml(page, '<img src="x" onerror="alert(1)">')
    await rcePage.waitForEditor()
    const content = await rcePage.getContent()
    expect(content).not.toContain('onerror')
  })

  test('javascript: href is stripped', async ({page, rcePage}) => {
    await setRawHtml(page, '<a href="javascript:alert(1)">click</a>')
    await rcePage.waitForEditor()
    const content = await rcePage.getContent()
    expect(content).not.toMatch(/href="javascript:/)
  })
})
