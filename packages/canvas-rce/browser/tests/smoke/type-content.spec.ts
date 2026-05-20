import {test, expect} from '../../fixtures/test'

test.describe('typing content', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('typed text appears in editor content', async ({rcePage}) => {
    await rcePage.typeContent('Hello world')
    const content = await rcePage.getContent()
    expect(content).toContain('Hello world')
  })

  test('content is empty on load', async ({rcePage}) => {
    const content = await rcePage.getContent()
    expect(content.trim()).toBe('')
  })
})
