import {test, expect} from '../../fixtures/test'

// Edge cases for content boundary conditions. These test what happens at the
// extremes of input — empty, whitespace-only, very long words, control characters.
// A robust refactor must handle all of these without crashing or corrupting state.
test.describe('content edge cases', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('getContent on empty editor returns predictable value', async ({page, rcePage}) => {
    const content = await rcePage.getContent()
    // TinyMCE returns either empty string or an empty paragraph
    expect(
      content === '' ||
        content === '<p></p>' ||
        content === '<p> </p>' ||
        /^<p[^>]*>(\s|&nbsp;)*<\/p>$/.test(content),
    ).toBe(true)
  })

  test('setContent with empty string leaves editor empty', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>something</p>')
    })
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('')
    })
    const content = await rcePage.getContent()
    // Should be empty or just an empty paragraph
    const text = content.replace(/<p[^>]*>(\s|&nbsp;)*<\/p>/g, '').trim()
    expect(text).toBe('')
  })

  test('content with only whitespace does not crash the editor', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>   </p>')
    })
    const content = await rcePage.getContent()
    // Editor should still be functional — just verify it doesn't throw
    expect(typeof content).toBe('string')
  })

  test('very long word without spaces does not crash', async ({page, rcePage}) => {
    const longWord = 'a'.repeat(5000)
    await page.evaluate((word: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(word)
    }, longWord)
    const content = await rcePage.getContent()
    expect(content).toContain('aaa')
  })

  test('content with newlines in source is normalized', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>line\none</p>')
    })
    const content = await rcePage.getContent()
    // TinyMCE normalizes whitespace in text nodes
    expect(content).toContain('line')
    expect(typeof content).toBe('string')
  })

  test('content with deeply nested HTML elements is preserved', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<p><strong><em><u>triple formatted</u></em></strong></p>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toContain('triple formatted')
    // All three formatting tags should be present
    expect(content).toMatch(/<strong/)
    expect(content).toMatch(/<em/)
    expect(content).toMatch(/<u/)
  })

  test('switching between content types does not leave stale state', async ({page, rcePage}) => {
    // Set a table, then replace with plain text, then set a list
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<table><tr><td>table</td></tr></table>')
      ed.setContent('<p>plain text</p>')
      ed.setContent('<ul><li>list item</li></ul>')
    })
    const content = await rcePage.getContent()
    expect(content).toContain('list item')
    expect(content).not.toContain('table')
    expect(content).not.toContain('plain text')
  })
})
