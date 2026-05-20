import {test, expect} from '../../fixtures/test'

// Tab key inside a list item must indent to create a nested sub-list.
// Canvas assignments and course content rely heavily on nested lists.
test.describe('nested lists', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('Tab inside a list item creates a nested list', async ({page, rcePage}) => {
    // Create a bulleted list with two items
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<ul><li>parent</li><li>child candidate</li></ul>')
    })
    // Click the second list item
    const secondItem = rcePage.contentFrame().locator('li').nth(1)
    await secondItem.click()
    await page.keyboard.press('Tab')

    const content = await rcePage.getContent()
    // Should contain a nested <ul> inside the first <li>
    expect(content).toMatch(/<li>[\s\S]*<ul/)
    expect(content).toContain('child candidate')
  })

  test('Shift+Tab inside a nested item outdents it', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<ul><li>parent<ul><li>nested item</li></ul></li></ul>',
      )
    })
    const nestedItem = rcePage.contentFrame().locator('li li').first()
    await nestedItem.click()
    await page.keyboard.press('Shift+Tab')

    const content = await rcePage.getContent()
    // After outdent, "nested item" should be at the top level
    const lis = content.match(/<li/g) ?? []
    expect(lis.length).toBeGreaterThanOrEqual(2)
    // The nesting depth should have decreased
    expect(content).toContain('nested item')
  })

  test('ordered list can be nested inside unordered list', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<ul><li>top level<ol><li>ordered nested</li></ol></li></ul>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<ul/)
    expect(content).toMatch(/<ol/)
    expect(content).toContain('ordered nested')
    expect(content).toContain('top level')
  })

  test('deeply nested list preserves all levels', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<ul><li>level 1<ul><li>level 2<ul><li>level 3</li></ul></li></ul></li></ul>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toContain('level 1')
    expect(content).toContain('level 2')
    expect(content).toContain('level 3')
    // At least 3 nested <ul> or <li> structures
    const ulCount = (content.match(/<ul/g) ?? []).length
    expect(ulCount).toBeGreaterThanOrEqual(3)
  })
})
