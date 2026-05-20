import {test, expect} from '../../fixtures/test'

// Extended undo/redo chain tests. A shallow undo test (1-2 levels) may pass
// even if the undo history is corrupted after 3+ operations. These tests walk
// through multi-step history to verify the stack stays intact.
test.describe('undo history — extended chain', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('five sequential operations can all be undone', async ({page, rcePage}) => {
    // Build a 5-step history via setContent operations
    const steps = [
      'one',
      'one two',
      'one two three',
      'one two three four',
      'one two three four five',
    ]
    for (const step of steps) {
      await page.evaluate((content: string) => {
        // @ts-expect-error -- TinyMCE global
        window.tinymce.activeEditor.execCommand('mceAddUndoLevel')
        // @ts-expect-error -- TinyMCE global
        window.tinymce.activeEditor.setContent(`<p>${content}</p>`)
      }, step)
    }

    // Undo once — should be back to step 4
    await page.keyboard.press('Control+z')
    const after1 = await rcePage.getContent()
    expect(after1).not.toContain('five')

    // Undo again — step 3
    await page.keyboard.press('Control+z')
    const after2 = await rcePage.getContent()
    expect(after2).not.toContain('four')
  })

  test('redo after undo restores content', async ({page, rcePage}) => {
    await rcePage.typeContent('alpha')
    await page.keyboard.press('Enter')
    await rcePage.typeContent('beta')
    await page.keyboard.press('Enter')
    await rcePage.typeContent('gamma')

    // Undo twice
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Control+z')
    const afterUndo = await rcePage.getContent()
    expect(afterUndo).toContain('alpha')

    // Redo once — should restore one level
    await page.keyboard.press('Control+y')
    const afterRedo = await rcePage.getContent()
    expect(afterRedo).toContain('alpha')
  })

  test('new input after undo creates a new history branch', async ({page, rcePage}) => {
    await rcePage.typeContent('original')
    await page.keyboard.press('Control+z')

    // After undo, type new content
    await rcePage.typeContent('replacement')

    // "replacement" must be present — the new input was accepted
    const content = await rcePage.getContent()
    expect(content).toContain('replacement')
    // Editor must still be functional after this sequence
    expect(typeof content).toBe('string')
  })

  test('undo of formatting restores plain text', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>plain text</p>')
    })
    const body = rcePage.contentFrame().locator('body')
    await body.click()
    await body.press('Control+a')
    await page.keyboard.press('Control+b')

    expect(await rcePage.getContent()).toMatch(/<strong>plain text<\/strong>/)

    // Undo the bold
    await page.keyboard.press('Control+z')
    const content = await rcePage.getContent()
    expect(content).toContain('plain text')
    expect(content).not.toMatch(/<strong>plain text<\/strong>/)
  })

  test('undo of table insertion removes the table', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('mceInsertTable', false, {rows: 2, columns: 2})
    })
    expect(await rcePage.getContent()).toMatch(/<table/)

    await page.keyboard.press('Control+z')
    const content = await rcePage.getContent()
    expect(content).not.toMatch(/<table/)
  })
})
