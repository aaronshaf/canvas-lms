import {test, expect} from '../../fixtures/test'

// Deeply nested lists (4+ levels) appear in course outlines, legal documents,
// and structured syllabi imported from Word. Each nesting level must preserve
// its item text — silent truncation at any level breaks course structure.
test.describe('deeply nested lists (4+ levels)', () => {
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

  test('4-level deep unordered list — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Level 1<ul><li>Level 2<ul><li>Level 3<ul><li>Level 4 deepest</li></ul></li></ul></li></ul></li></ul>',
    )
    expect(content).toContain('Level 1')
    expect(content).toContain('Level 2')
    expect(content).toContain('Level 3')
    expect(content).toContain('Level 4 deepest')
  })

  test('4-level ordered list — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li>Chapter<ol><li>Section<ol><li>Subsection<ol><li>Clause</li></ol></li></ol></li></ol></li></ol>',
    )
    expect(content).toContain('Chapter')
    expect(content).toContain('Section')
    expect(content).toContain('Subsection')
    expect(content).toContain('Clause')
  })

  test('mixed ul/ol nesting 4 levels deep — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>UL-1<ol><li>OL-2<ul><li>UL-3<ol><li>OL-4 deepest</li></ol></li></ul></li></ol></li></ul>',
    )
    expect(content).toContain('UL-1')
    expect(content).toContain('OL-2')
    expect(content).toContain('UL-3')
    expect(content).toContain('OL-4 deepest')
  })

  test('sibling items at deep level all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Root<ul><li>Branch<ul><li>Leaf A</li><li>Leaf B</li><li>Leaf C</li></ul></li></ul></li></ul>',
    )
    expect(content).toContain('Leaf A')
    expect(content).toContain('Leaf B')
    expect(content).toContain('Leaf C')
  })

  test('5-level deep list does not crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>1<ul><li>2<ul><li>3<ul><li>4<ul><li>5th level item</li></ul></li></ul></li></ul></li></ul></li></ul>',
    )
    expect(content).toContain('5th level item')
    expect(typeof content).toBe('string')
  })
})
