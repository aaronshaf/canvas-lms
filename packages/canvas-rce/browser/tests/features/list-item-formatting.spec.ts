import {test, expect} from '../../fixtures/test'

// List items in course content commonly contain inline formatting — bold terms,
// italic emphasis, links, and code. canvas-rce must preserve formatting inside
// <li> elements; stripping it flattens semantically rich content.
test.describe('inline formatting inside list items', () => {
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

  test('bold text inside list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><strong>Key term</strong>: definition follows</li><li>Normal item</li></ul>',
    )
    expect(content).toMatch(/<strong>Key term<\/strong>/)
    expect(content).toContain('definition follows')
    expect(content).toContain('Normal item')
  })

  test('italic text inside list item is preserved', async ({page}) => {
    const content = await setAndGet(page, '<ul><li>Read <em>Chapter 3</em> before class</li></ul>')
    expect(content).toMatch(/<em>Chapter 3<\/em>/)
    expect(content).toContain('before class')
  })

  test('link inside list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Visit <a href="https://canvas.instructure.com">Canvas</a> to submit</li></ul>',
    )
    expect(content).toContain('Canvas')
    expect(content).toMatch(/href="https:\/\/canvas\.instructure\.com"/)
    expect(content).toContain('to submit')
  })

  test('code inline inside list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li>Run <code>npm install</code> first</li><li>Then run <code>npm test</code></li></ol>',
    )
    expect(content).toContain('npm install')
    expect(content).toContain('npm test')
    expect(content).toContain('first')
  })

  test('multiple formatting types in the same list item', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><strong>Important:</strong> review the <em>highlighted</em> sections and <a href="#section-3">section 3</a></li></ul>',
    )
    expect(content).toMatch(/<strong>Important:<\/strong>/)
    expect(content).toMatch(/<em>highlighted<\/em>/)
    expect(content).toContain('section 3')
  })

  test('ordered list items with numbered content preserve formatting', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li><strong>Step 1:</strong> Open the editor</li><li><strong>Step 2:</strong> Type content</li><li><strong>Step 3:</strong> Save</li></ol>',
    )
    expect(content).toMatch(/<strong>Step 1:<\/strong>/)
    expect(content).toMatch(/<strong>Step 2:<\/strong>/)
    expect(content).toMatch(/<strong>Step 3:<\/strong>/)
    expect(content).toMatch(/<ol/)
  })

  test('list item containing only a link is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><a href="https://example.com/resource-1">Resource 1</a></li><li><a href="https://example.com/resource-2">Resource 2</a></li></ul>',
    )
    expect(content).toContain('Resource 1')
    expect(content).toContain('Resource 2')
    expect(content).toMatch(/href="https:\/\/example\.com\/resource-1"/)
    expect(content).toMatch(/href="https:\/\/example\.com\/resource-2"/)
  })

  test('superscript inside list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Formula: E = mc<sup>2</sup></li><li>Area = πr<sup>2</sup></li></ul>',
    )
    expect(content).toContain('E = mc')
    expect(content).toContain('Area')
    expect(content).toMatch(/<sup>2<\/sup>/)
  })
})
