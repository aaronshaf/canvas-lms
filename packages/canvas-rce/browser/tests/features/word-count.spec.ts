import {test, expect} from '../../fixtures/test'

test.describe('word count', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('shows 0 words on empty editor', async ({page}) => {
    await expect(page.locator('[data-testid="status-bar-word-count"]')).toContainText('0 words')
  })

  test('word count updates after typing', async ({page, rcePage}) => {
    await rcePage.typeContent('one two three')
    await expect(page.locator('[data-testid="status-bar-word-count"]')).toContainText('3 words')
  })

  test('word count updates after typing multiple sentences', async ({page, rcePage}) => {
    await rcePage.typeContent('The quick brown fox jumps over the lazy dog')
    await expect(page.locator('[data-testid="status-bar-word-count"]')).toContainText('9 words')
  })
})
