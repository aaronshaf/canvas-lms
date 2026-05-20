import {test, expect} from '../../fixtures/test'

// Tests for onInitted and onContentChange prop callbacks
test.describe('RCE prop callbacks', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/with-callbacks')
    await rcePage.waitForEditor()
  })

  test('onInitted is called with the editor on mount', async ({page}) => {
    // The harness records getContent() from onInitted into data-testid="init-content"
    const initContent = page.locator('[data-testid="init-content"]')
    // init-content should be empty string (editor starts empty)
    expect(await initContent.textContent()).toBe('')
  })

  test('onContentChange fires when content is typed', async ({page, rcePage}) => {
    await rcePage.typeContent('hello')
    // change-count should be > 0 after typing
    const changeCount = page.locator('[data-testid="change-count"]')
    await expect(changeCount).not.toHaveText('0', {timeout: 3_000})
  })

  test('onContentChange receives current HTML content', async ({page, rcePage}) => {
    await rcePage.typeContent('callback text')
    // Wait for at least one change event
    await expect(page.locator('[data-testid="change-count"]')).not.toHaveText('0', {timeout: 3_000})
    const lastChange = await page.locator('[data-testid="last-change"]').textContent()
    expect(lastChange).toContain('callback text')
  })

  test('onContentChange fires after bold formatting applied', async ({page, rcePage}) => {
    await rcePage.typeContent('bold me')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')
    const lastChange = page.locator('[data-testid="last-change"]')
    await expect(lastChange).toContainText('<strong>', {timeout: 3_000})
  })
})
