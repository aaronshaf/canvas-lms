import {test, expect} from '../../fixtures/test'

test.describe('undo and redo', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('Ctrl+Z undoes typed text', async ({page, rcePage}) => {
    await rcePage.typeContent('hello')
    // Undo all characters
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Control+z')
    }
    const content = await rcePage.getContent()
    expect(content.replace(/<[^>]+>/g, '').trim()).toBe('')
  })

  test('Ctrl+Y redoes undone text', async ({page, rcePage}) => {
    await rcePage.typeContent('redo me')
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Control+y')
    const content = await rcePage.getContent()
    // At least some text should be back after redo
    expect(content.replace(/<[^>]+>/g, '').trim().length).toBeGreaterThan(0)
  })

  test('Ctrl+Z undoes bold formatting', async ({page, rcePage}) => {
    await rcePage.typeContent('hello')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')
    // Confirm bold applied
    expect(await rcePage.getContent()).toMatch(/<strong>/)
    // Undo
    await page.keyboard.press('Control+z')
    const content = await rcePage.getContent()
    expect(content).not.toMatch(/<strong>/)
  })
})
