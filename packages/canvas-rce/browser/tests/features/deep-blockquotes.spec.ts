import {test, expect} from '../../fixtures/test'

// Deeply nested blockquotes appear in email-style threading and in content
// copy-pasted from email clients or forum posts. Each level must preserve
// its text. This is separate from nested-blockquote.spec.ts which covers 2-3
// levels; these tests verify behavior at 4+ levels of nesting.
test.describe('deeply nested blockquotes (4+ levels)', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function setAndGet(page: any, html: string): Promise<string> {
    return page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(content)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)
  }

  test('4-level blockquote — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>Level 1</p><blockquote><p>Level 2</p><blockquote><p>Level 3</p><blockquote><p>Level 4 deepest</p></blockquote></blockquote></blockquote></blockquote>',
    )
    expect(content).toContain('Level 1')
    expect(content).toContain('Level 2')
    expect(content).toContain('Level 3')
    expect(content).toContain('Level 4 deepest')
  })

  test('5-level blockquote does not crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><blockquote><blockquote><blockquote><blockquote><p>Deepest level 5</p></blockquote></blockquote></blockquote></blockquote></blockquote>',
    )
    expect(content).toContain('Deepest level 5')
    expect(typeof content).toBe('string')
  })

  test('text above and below deep blockquote preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Preamble text.</p><blockquote><blockquote><blockquote><p>Deeply quoted.</p></blockquote></blockquote></blockquote><p>Conclusion text.</p>',
    )
    expect(content).toContain('Preamble text')
    expect(content).toContain('Deeply quoted')
    expect(content).toContain('Conclusion text')
  })

  test('sibling paragraphs at each nesting level preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>Outer A</p><p>Outer B</p><blockquote><p>Inner A</p><p>Inner B</p></blockquote></blockquote>',
    )
    expect(content).toContain('Outer A')
    expect(content).toContain('Outer B')
    expect(content).toContain('Inner A')
    expect(content).toContain('Inner B')
  })

  test('formatting inside deep blockquote preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><blockquote><blockquote><p><strong>Bold in deep quote</strong> and <em>italic</em></p></blockquote></blockquote></blockquote>',
    )
    expect(content).toContain('Bold in deep quote')
    expect(content).toContain('italic')
  })
})
