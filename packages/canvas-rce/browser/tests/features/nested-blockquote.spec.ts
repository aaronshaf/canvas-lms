import {test, expect} from '../../fixtures/test'

// Nested blockquotes appear in academic course content for multi-level citation,
// dialogue representation, and thread-style quote replies. Each level of nesting
// must survive serialization without collapsing into a single level.
test.describe('nested blockquote elements', () => {
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

  test('two-level nested blockquote preserves both levels of text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>Outer quote.</p><blockquote><p>Inner quote.</p></blockquote></blockquote>',
    )
    expect(content).toContain('Outer quote')
    expect(content).toContain('Inner quote')
  })

  test('three-level nested blockquote preserves all text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>Level 1</p><blockquote><p>Level 2</p><blockquote><p>Level 3</p></blockquote></blockquote></blockquote>',
    )
    expect(content).toContain('Level 1')
    expect(content).toContain('Level 2')
    expect(content).toContain('Level 3')
  })

  test('blockquote containing list is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>Key points:</p><ul><li>First point</li><li>Second point</li></ul></blockquote>',
    )
    expect(content).toContain('Key points')
    expect(content).toContain('First point')
    expect(content).toContain('Second point')
    expect(content).toMatch(/<ul/)
  })

  test('blockquote containing a table preserves table content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><table><tr><td>Quoted data</td><td>Value</td></tr></table></blockquote>',
    )
    expect(content).toContain('Quoted data')
    expect(content).toContain('Value')
  })

  test('blockquote with formatted text inside is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p><em>Original authors</em> wrote: <strong>the key insight</strong> is...</p></blockquote>',
    )
    expect(content).toContain('Original authors')
    expect(content).toContain('the key insight')
    expect(content).toMatch(/<em>/)
    expect(content).toMatch(/<strong>/)
  })

  test('blockquote followed by regular paragraph is separated correctly', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>The quoted material.</p></blockquote><p>My commentary follows.</p>',
    )
    expect(content).toContain('The quoted material')
    expect(content).toContain('My commentary follows')
    expect(content).toMatch(/<blockquote/)
    expect(content).toMatch(/<p>My commentary follows/)
  })

  test('multiple sibling blockquotes at the same level', async ({page}) => {
    const content = await setAndGet(
      page,
      `<blockquote><p>First quote from source A.</p></blockquote>
       <blockquote><p>Second quote from source B.</p></blockquote>`,
    )
    expect(content).toContain('First quote from source A')
    expect(content).toContain('Second quote from source B')
    const quoteCount = (content.match(/<blockquote/g) ?? []).length
    expect(quoteCount).toBeGreaterThanOrEqual(2)
  })
})
