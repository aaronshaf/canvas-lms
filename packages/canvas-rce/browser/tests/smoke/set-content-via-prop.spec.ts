import {test, expect} from '../../fixtures/test'

test.describe('defaultContent prop', () => {
  test('pre-loads HTML into the editor', async ({page, rcePage}) => {
    await page.goto('/scenarios/with-default-content')
    await rcePage.waitForEditor()
    const body = rcePage.contentFrame().locator('body')
    await expect(body).toContainText('Pre-loaded content from')
    await expect(body).toContainText('defaultContent')
  })

  test('defaultContent HTML is preserved in getContent()', async ({page, rcePage}) => {
    await page.goto('/scenarios/with-default-content')
    await rcePage.waitForEditor()
    const content = await rcePage.getContent()
    expect(content).toContain('Pre-loaded content from')
    expect(content).toMatch(/<strong>defaultContent<\/strong>/)
  })

  test('content is editable after being pre-loaded', async ({page, rcePage}) => {
    await page.goto('/scenarios/with-default-content')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').press('End')
    await page.keyboard.type(' appended')
    const content = await rcePage.getContent()
    expect(content).toContain('appended')
  })
})
