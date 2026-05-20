import {test, expect} from '../../fixtures/test'

// Tests the full round-trip: switch to HTML source view, make edits, switch back
// to visual mode, and verify the visual editor reflects the HTML changes.
// This tests a core canvas-rce UX contract — the two modes must stay in sync.
test.describe('HTML editor round-trip', () => {
  const toggleBtn = '[data-btn-id="rce-edit-btn"]'

  async function openHtmlEditor(page: any) {
    await page.locator(toggleBtn).click()
    await page.locator('.RceHtmlEditor').waitFor({state: 'visible', timeout: 10_000})
  }

  async function closeHtmlEditor(page: any) {
    await page.locator(toggleBtn).click()
    await page.locator('.tox-tinymce').waitFor({state: 'visible', timeout: 10_000})
  }

  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('content typed in visual mode appears in HTML source', async ({page, rcePage}) => {
    await rcePage.contentFrame().locator('body').click()
    await rcePage.typeContent('hello world')
    await openHtmlEditor(page)

    const htmlContent = await page.locator('.RceHtmlEditor .cm-content').textContent()
    expect(htmlContent).toContain('hello world')
  })

  test('HTML edited in source mode appears in visual editor', async ({page, rcePage}) => {
    await openHtmlEditor(page)

    // Clear existing content and type new HTML
    const editor = page.locator('.RceHtmlEditor .cm-content[role="textbox"]')
    await editor.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('<p><strong>from html editor</strong></p>')

    await closeHtmlEditor(page)

    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>from html editor<\/strong>/)
  })

  test('switching modes does not corrupt existing content', async ({page, rcePage}) => {
    await rcePage.contentFrame().locator('body').click()
    await rcePage.typeContent('preserve me')

    // Switch to HTML and back without editing
    await openHtmlEditor(page)
    await closeHtmlEditor(page)

    const content = await rcePage.getContent()
    expect(content).toContain('preserve me')
  })

  test('invalid HTML in source view does not crash the editor', async ({page, rcePage}) => {
    await openHtmlEditor(page)

    const editor = page.locator('.RceHtmlEditor .cm-content[role="textbox"]')
    await editor.click()
    await page.keyboard.press('Control+a')
    // Unclosed tag — browser/TinyMCE should handle gracefully
    await page.keyboard.type('<p>unclosed tag <strong>no close')

    await closeHtmlEditor(page)

    // Editor should still be functional
    const content = await rcePage.getContent()
    expect(content).toContain('unclosed tag')
    // TinyMCE should have auto-corrected the HTML
    expect(content).toMatch(/<\/strong>/)
    expect(content).toMatch(/<\/p>/)
  })
})
