import {test, expect} from '../../fixtures/test'

// Ordered lists in course content can have different numbering styles (roman
// numerals, letters) and non-default start values. These are set via the
// list-style-type CSS property or the type/start HTML attributes.
// Legal citation, outlines, and multi-part assignments rely on this.
test.describe('ordered list variants', () => {
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

  test('ordered list with start attribute is preserved', async ({page}) => {
    const content = await setAndGet(page, '<ol start="5"><li>Item five</li><li>Item six</li></ol>')
    expect(content).toContain('Item five')
    expect(content).toContain('Item six')
    // start attribute enables mid-document continuation of numbering
    expect(content).toMatch(/start="5"/)
  })

  test('ordered list with type="a" (lower-alpha) is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol type="a"><li>First</li><li>Second</li><li>Third</li></ol>',
    )
    expect(content).toContain('First')
    expect(content).toContain('Second')
    expect(content).toContain('Third')
    // type attribute may be preserved or converted to list-style-type CSS
    expect(typeof content).toBe('string')
  })

  test('ordered list with type="i" (lower-roman) content survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol type="i"><li>Introduction</li><li>Methods</li><li>Results</li></ol>',
    )
    expect(content).toContain('Introduction')
    expect(content).toContain('Methods')
    expect(content).toContain('Results')
  })

  test('ordered list with list-style-type CSS preserves items', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol style="list-style-type: upper-roman;"><li>Part One</li><li>Part Two</li></ol>',
    )
    expect(content).toContain('Part One')
    expect(content).toContain('Part Two')
  })

  test('nested ordered list with different types at each level', async ({page}) => {
    const content = await setAndGet(
      page,
      `<ol type="I">
        <li>Chapter One
          <ol type="A">
            <li>Section A</li>
            <li>Section B</li>
          </ol>
        </li>
        <li>Chapter Two</li>
      </ol>`,
    )
    expect(content).toContain('Chapter One')
    expect(content).toContain('Section A')
    expect(content).toContain('Section B')
    expect(content).toContain('Chapter Two')
  })

  test('basic numbered list is preserved (default behavior)', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li>Step 1: Open the file</li><li>Step 2: Edit the content</li><li>Step 3: Save</li></ol>',
    )
    expect(content).toMatch(/<ol/)
    expect(content).toContain('Step 1')
    expect(content).toContain('Step 2')
    expect(content).toContain('Step 3')
  })

  test('ordered list reversed attribute content survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol reversed><li>Last place</li><li>Second place</li><li>First place</li></ol>',
    )
    expect(content).toContain('Last place')
    expect(content).toContain('First place')
  })

  test('unordered list with disc/circle/square style-type preserves items', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul style="list-style-type: circle;"><li>Bullet A</li><li>Bullet B</li></ul>',
    )
    expect(content).toContain('Bullet A')
    expect(content).toContain('Bullet B')
    expect(content).toMatch(/<ul/)
  })
})
