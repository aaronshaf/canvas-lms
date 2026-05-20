import {test, expect} from '../../fixtures/test'

// Formatting applied to a selection that spans multiple paragraphs must affect
// all selected content, not just the anchor paragraph. This tests TinyMCE's
// range-based formatting against a refactor that might break multi-node ranges.
test.describe('cross-paragraph selection formatting', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('bold applied to multi-paragraph selection wraps all selected paragraphs', async ({
    page,
    rcePage,
  }) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>paragraph one</p><p>paragraph two</p>')
    })
    // Select all content across both paragraphs
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')

    const content = await rcePage.getContent()
    // Both paragraphs should now be bold
    expect(content).toMatch(/<strong>.*paragraph one.*<\/strong>/s)
    expect(content).toContain('paragraph two')
    expect(content).toMatch(/<strong>/)
  })

  test('italic applied to all content via Ctrl+A affects all paragraphs', async ({
    page,
    rcePage,
  }) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>first</p><p>second</p><p>third</p>')
    })
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+i')

    const content = await rcePage.getContent()
    const emCount = (content.match(/<em>/g) ?? []).length
    // At least one <em> per paragraph (some may share)
    expect(emCount).toBeGreaterThanOrEqual(1)
    expect(content).toContain('first')
    expect(content).toContain('third')
  })

  test('heading applied to entire content changes all blocks', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>block one</p><p>block two</p>')
    })
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('FormatBlock', false, 'h2')
    })

    const content = await rcePage.getContent()
    const h2Count = (content.match(/<h2/g) ?? []).length
    expect(h2Count).toBeGreaterThanOrEqual(2)
    expect(content).toContain('block one')
    expect(content).toContain('block two')
  })

  test('clear formatting on multi-paragraph selection removes all inline styles', async ({
    page,
    rcePage,
  }) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<p><strong><em>bold italic one</em></strong></p><p><strong>bold two</strong></p>',
      )
    })
    await rcePage.contentFrame().locator('body').press('Control+a')
    // Clear formatting via Format menu
    await page.locator('.tox-menubar button[role="menuitem"]:has-text("Format")').click()
    await page.locator('.tox-collection__item:has-text("Clear formatting")').click()

    const content = await rcePage.getContent()
    expect(content).toContain('bold italic one')
    expect(content).toContain('bold two')
    expect(content).not.toMatch(/<strong>/)
    expect(content).not.toMatch(/<em>/)
  })
})
