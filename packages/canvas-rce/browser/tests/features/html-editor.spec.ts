import {test, expect} from '../../fixtures/test'

// The pretty HTML editor is CodeMirror — no native textarea
const htmlEditorContent = '.RceHtmlEditor .cm-content'
const htmlEditorContainer = '.RceHtmlEditor'
const toggleBtn = '[data-btn-id="rce-edit-btn"]'

test.describe('HTML editor toggle', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('switch to pretty HTML editor shows code editor', async ({page, rcePage}) => {
    await rcePage.typeContent('Hello world')
    await page.locator(toggleBtn).click()
    await expect(page.locator(htmlEditorContainer)).toBeVisible({timeout: 10_000})
    const text = await page.locator(htmlEditorContent).innerText()
    expect(text).toContain('Hello world')
  })

  test('switch back to rich text restores WYSIWYG', async ({page, rcePage}) => {
    await rcePage.typeContent('Round trip')
    await page.locator(toggleBtn).click()
    await expect(page.locator(htmlEditorContainer)).toBeVisible({timeout: 10_000})
    await page.locator(toggleBtn).click()
    await rcePage.waitForEditor()
    const content = await rcePage.getContent()
    expect(content).toContain('Round trip')
  })

  test('HTML entered in code editor appears in rich text view', async ({page, rcePage}) => {
    await page.locator(toggleBtn).click()
    const cmContent = page.locator(htmlEditorContent)
    await cmContent.waitFor({state: 'visible', timeout: 10_000})
    // Select all and replace with new HTML
    await cmContent.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('<p>Typed in HTML editor</p>')
    await page.locator(toggleBtn).click()
    await rcePage.waitForEditor()
    await expect(rcePage.contentFrame().locator('body')).toContainText('Typed in HTML editor')
  })
})
