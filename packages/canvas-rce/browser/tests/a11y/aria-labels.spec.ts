import {test, expect} from '../../fixtures/test'

// ARIA labels on interactive editor elements must be present and descriptive.
// Screen reader users depend on these to understand and navigate the editor.
// A refactor that renames or removes these labels breaks assistive technology.
test.describe('accessibility — ARIA labels', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('editor content area has an accessible aria-label', async ({page, rcePage}) => {
    // TinyMCE sets aria-label on the contenteditable body inside the iframe
    const body = rcePage.contentFrame().locator('body[contenteditable="true"]')
    const label = await body.getAttribute('aria-label')
    expect(label).toBeTruthy()
    expect(label!.length).toBeGreaterThan(5)
  })

  test('Bold button has aria-label', async ({page, rcePage}) => {
    const boldBtn = rcePage.toolbarButton('Bold')
    const label = await boldBtn.getAttribute('aria-label')
    expect(label).toBeTruthy()
    expect(label!.toLowerCase()).toContain('bold')
  })

  test('toolbar buttons all have accessible names', async ({page, rcePage}) => {
    const unlabeled = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.tox-toolbar__primary [role="button"]')]
      return buttons
        .filter(b => {
          const label =
            b.getAttribute('aria-label') ?? b.getAttribute('title') ?? b.textContent?.trim()
          return !label
        })
        .map(b => b.outerHTML.slice(0, 120))
    })
    expect(
      unlabeled,
      `Buttons without accessible names: ${JSON.stringify(unlabeled)}`,
    ).toHaveLength(0)
  })

  test('fullscreen button has aria-label', async ({page}) => {
    const btn = page.locator('[data-btn-id="rce-fullscreen-btn"]')
    const label = await btn.getAttribute('aria-label')
    const title = await btn.getAttribute('title')
    expect(label ?? title).toBeTruthy()
  })

  test('keyboard shortcuts button has aria-label', async ({page}) => {
    const btn = page.locator('[data-btn-id="rce-kbshortcut-btn"]')
    const label = await btn.getAttribute('aria-label')
    const title = await btn.getAttribute('title')
    expect(label ?? title).toBeTruthy()
  })

  test('HTML editor toggle button has aria-label', async ({page}) => {
    const btn = page.locator('[data-btn-id="rce-edit-btn"]')
    const label = await btn.getAttribute('aria-label')
    const title = await btn.getAttribute('title')
    expect(label ?? title).toBeTruthy()
  })

  test('readonly editor content area has accessible label', async ({page, rcePage}) => {
    await page.goto('/scenarios/readonly')
    await rcePage.waitForEditor()
    const body = rcePage.contentFrame().locator('body')
    const label = await body.getAttribute('aria-label')
    // Readonly editors should still have an accessible label
    expect(label).toBeTruthy()
  })

  test('status bar is present and contains interactive buttons', async ({page}) => {
    const statusBar = page.locator('[data-testid="RCEStatusBar"]')
    await expect(statusBar).toBeVisible()
    // Status bar must contain at least the word count and fullscreen buttons
    await expect(page.locator('[data-testid="status-bar-word-count"]')).toBeVisible()
    await expect(page.locator('[data-btn-id="rce-fullscreen-btn"]')).toBeVisible()
  })
})
