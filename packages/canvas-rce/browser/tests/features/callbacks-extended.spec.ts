import {test, expect} from '../../fixtures/test'

// onContentChange must fire for ALL edit types, not just keyboard typing.
// A refactor that wires the callback only to keyboard input would miss changes
// from bold-application, table insertion, or programmatic setContent calls.
test.describe('onContentChange — fires for all edit types', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/with-callbacks')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  async function getChangeCount(page: any): Promise<number> {
    const text = await page.locator('[data-testid="change-count"]').textContent()
    return parseInt(text ?? '0', 10)
  }

  test('onContentChange fires when bold is applied via keyboard shortcut', async ({
    page,
    rcePage,
  }) => {
    await rcePage.typeContent('test')
    const countBefore = await getChangeCount(page)

    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')

    await page.waitForTimeout(300)
    const countAfter = await getChangeCount(page)
    expect(countAfter).toBeGreaterThan(countBefore)
  })

  test('onContentChange fires when a list is created', async ({page, rcePage}) => {
    await rcePage.typeContent('a list item')
    const countBefore = await getChangeCount(page)

    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('InsertUnorderedList')
    })

    await page.waitForTimeout(300)
    const countAfter = await getChangeCount(page)
    expect(countAfter).toBeGreaterThan(countBefore)
  })

  test('onContentChange fires when a table is inserted', async ({page, rcePage}) => {
    const countBefore = await getChangeCount(page)

    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('mceInsertTable', false, {rows: 2, columns: 2})
    })

    await page.waitForTimeout(300)
    const countAfter = await getChangeCount(page)
    expect(countAfter).toBeGreaterThan(countBefore)
  })

  test('last-change value contains the full HTML after bold formatting', async ({
    page,
    rcePage,
  }) => {
    await rcePage.typeContent('bold this')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')

    await expect(page.locator('[data-testid="last-change"]')).toContainText('<strong>', {
      timeout: 3_000,
    })
  })

  test('last-change value updates after heading is applied', async ({page, rcePage}) => {
    await rcePage.typeContent('heading text')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('FormatBlock', false, 'h2')
    })

    await page.waitForTimeout(300)
    const lastChange = await page.locator('[data-testid="last-change"]').textContent()
    expect(lastChange).toMatch(/<h2/)
    expect(lastChange).toContain('heading text')
  })
})
