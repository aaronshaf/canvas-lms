import {test, expect} from '../../fixtures/test'

test.describe('text formatting', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('bold wraps selection in <strong>', async ({rcePage}) => {
    await rcePage.typeContent('hello')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await rcePage.toolbarButton('Bold').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>hello<\/strong>/)
  })

  test('italic wraps selection in <em>', async ({rcePage}) => {
    await rcePage.typeContent('hello')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await rcePage.toolbarButton('Italic').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/<em>hello<\/em>/)
  })

  test('underline wraps selection in <span> with text-decoration', async ({rcePage}) => {
    await rcePage.typeContent('hello')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await rcePage.toolbarButton('Underline').click()
    const content = await rcePage.getContent()
    expect(content).toMatch(/text-decoration[^"]*underline/)
  })

  test('keyboard shortcut Ctrl+B applies bold', async ({page, rcePage}) => {
    await rcePage.typeContent('shortcut')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>/)
  })

  test('keyboard shortcut Ctrl+I applies italic', async ({page, rcePage}) => {
    await rcePage.typeContent('shortcut')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+i')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<em>/)
  })
})
