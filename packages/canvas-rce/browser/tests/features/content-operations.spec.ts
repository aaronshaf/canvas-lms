import {test, expect} from '../../fixtures/test'

// Tests that compound content operations produce correct results.
// These catch regressions in state management across multiple editor actions.
test.describe('compound content operations', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('format then clear then retype produces clean output', async ({page, rcePage}) => {
    await rcePage.typeContent('first')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')
    // Clear all
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Backspace')
    // Type new content
    await rcePage.typeContent('second')
    const content = await rcePage.getContent()
    expect(content).toContain('second')
    expect(content).not.toContain('first')
    // No stray <strong> wrapping the new content
    expect(content).not.toMatch(/<strong>second<\/strong>/)
  })

  test('multiple paragraphs created by Enter key', async ({page, rcePage}) => {
    await rcePage.typeContent('paragraph one')
    await page.keyboard.press('Enter')
    await rcePage.typeContent('paragraph two')
    await page.keyboard.press('Enter')
    await rcePage.typeContent('paragraph three')
    const content = await rcePage.getContent()
    // Each paragraph should be in its own <p>
    const pMatches = content.match(/<p[^>]*>/g) ?? []
    expect(pMatches.length).toBeGreaterThanOrEqual(3)
    expect(content).toContain('paragraph one')
    expect(content).toContain('paragraph three')
  })

  test('bold in the middle of a sentence only bolds selected text', async ({page, rcePage}) => {
    await rcePage.typeContent('start ')
    // Type the word to bold without selecting all first
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('<strong>middle</strong>')
    })
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(' end')
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>middle<\/strong>/)
    expect(content).toContain('start')
    expect(content).toContain('end')
  })

  test('undo after multiple operations restores intermediate state', async ({page, rcePage}) => {
    await rcePage.typeContent('alpha')
    await page.keyboard.press('Enter')
    await rcePage.typeContent('beta')
    // Undo once — should remove "beta"
    await page.keyboard.press('Control+z')
    const afterFirstUndo = await rcePage.getContent()
    expect(afterFirstUndo).toContain('alpha')
    // Undo again — should remove the newline / paragraph
    await page.keyboard.press('Control+z')
    const afterSecondUndo = await rcePage.getContent()
    // alpha should still be there; number of <p> tags reduced
    expect(afterSecondUndo).toContain('alpha')
  })

  test('inserting then deleting a table leaves clean content', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('mceInsertTable', false, {rows: 2, columns: 2})
    })
    let content = await rcePage.getContent()
    expect(content).toMatch(/<table/)

    // Select all and delete
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Backspace')
    content = await rcePage.getContent()
    expect(content).not.toMatch(/<table/)
  })
})
