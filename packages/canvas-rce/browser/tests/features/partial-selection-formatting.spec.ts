import {test, expect} from '../../fixtures/test'

// Formatting must scope exactly to the selected text, not bleed into surrounding content.
// This tests a critical TinyMCE selection API contract that must hold after any refactor.
test.describe('partial selection formatting', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('bold applies only to selected word, not entire paragraph', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>before middle after</p>')
    })
    // Select just "middle" by positioning cursor then shift-selecting
    const body = rcePage.contentFrame().locator('body')
    await body.click()
    await page.keyboard.press('Home')
    // Move right past "before " (7 chars), then shift-select 6 chars ("middle")
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight')
    for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Control+b')

    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>middle<\/strong>/)
    // Surrounding text must NOT be bolded
    expect(content).toContain('before')
    expect(content).toContain('after')
    expect(content).not.toMatch(/<strong>before/)
    expect(content).not.toMatch(/after<\/strong>/)
  })

  test('italic applies only to selected characters', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>aaa bbb ccc</p>')
    })
    const body = rcePage.contentFrame().locator('body')
    await body.click()
    await page.keyboard.press('Home')
    // Skip past "aaa " (4 chars), select "bbb" (3 chars)
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Control+i')

    const content = await rcePage.getContent()
    expect(content).toMatch(/<em>bbb<\/em>/)
    expect(content).not.toMatch(/<em>aaa/)
    expect(content).not.toMatch(/ccc<\/em>/)
  })

  test('toggling bold off removes it from selected text only', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p><strong>all bold text here</strong></p>')
    })
    const body = rcePage.contentFrame().locator('body')
    await body.click()
    await page.keyboard.press('Home')
    // Select "all" (3 chars)
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight')
    // Toggle bold off for just "all"
    await page.keyboard.press('Control+b')

    const content = await rcePage.getContent()
    // "all" should no longer be bold; "bold text here" should still be
    expect(content).toContain('all')
    expect(content).toMatch(/bold text here/)
    // "bold text here" should still be in a <strong>
    expect(content).toMatch(/<strong>/)
  })

  test('formatting multiple non-adjacent words simultaneously is scoped to selection', async ({
    page,
    rcePage,
  }) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>start target end</p>')
    })
    const body = rcePage.contentFrame().locator('body')
    await body.click()
    await page.keyboard.press('Home')
    // Position at "target" (6 chars in from start)
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
    // Select "target" (6 chars)
    for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Control+b')

    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>target<\/strong>/)
    expect(content).not.toMatch(/<strong>start/)
    expect(content).not.toMatch(/end<\/strong>/)
  })
})
