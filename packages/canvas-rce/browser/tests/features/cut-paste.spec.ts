import {test, expect} from '../../fixtures/test'

// Tests for selection-based content manipulation within the editor.
// Note: Ctrl+X/V rely on system clipboard which is blocked in headless Playwright.
// These tests use TinyMCE's execCommand/insertContent to simulate equivalent operations.
test.describe('selection and content manipulation', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('selecting text and pressing Delete removes it', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>alpha beta gamma</p>')
    })
    const body = rcePage.contentFrame().locator('body')
    await body.click()
    await page.keyboard.press('Home')
    // Select "alpha " (6 chars)
    for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Delete')

    const content = await rcePage.getContent()
    expect(content).not.toContain('alpha')
    expect(content).toContain('beta')
    expect(content).toContain('gamma')
  })

  test('insertContent appends at cursor position', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>start</p>')
    })
    // Position cursor at end, then insert more content
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.selection.select(ed.getBody(), true)
      ed.selection.collapse(false) // collapse to end
      ed.insertContent(' appended')
    })
    const content = await rcePage.getContent()
    expect(content).toContain('start')
    expect(content).toContain('appended')
    // "start" should appear before "appended"
    expect(content.indexOf('start')).toBeLessThan(content.indexOf('appended'))
  })

  test('replacing selected text via insertContent works correctly', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>old content here</p>')
    })
    const body = rcePage.contentFrame().locator('body')
    await body.click()
    await page.keyboard.press('Home')
    // Select "old" (3 chars)
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight')
    // Type replacement (replaces selection)
    await page.keyboard.type('new')

    const content = await rcePage.getContent()
    expect(content).toContain('new content here')
    expect(content).not.toContain('old content')
  })

  test('select-all then type replaces entire content', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>everything will be replaced</p>')
    })
    const body = rcePage.contentFrame().locator('body')
    await body.click()
    await body.press('Control+a')
    await page.keyboard.type('brand new content')

    const content = await rcePage.getContent()
    expect(content).toContain('brand new content')
    expect(content).not.toContain('everything will be replaced')
  })

  test('Backspace on selection removes only selected content', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>keep remove keep</p>')
    })
    const body = rcePage.contentFrame().locator('body')
    await body.click()
    await page.keyboard.press('Home')
    // Skip "keep " (5 chars), select "remove" (6 chars)
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
    for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Backspace')

    const content = await rcePage.getContent()
    expect(content).not.toContain('remove')
    // Both "keep" instances should remain (might merge into "keep  keep" or "keep keep")
    expect(content.match(/keep/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
