import {test, expect} from '../../fixtures/test'

// list-style-type CSS controls bullet/number style: disc, circle, square,
// decimal, lower-alpha, lower-roman, etc. Course content often customizes
// list styles for rubrics and course outlines. Tests verify text is preserved
// regardless of whether the style attribute survives.
test.describe('list-style-type CSS on lists', () => {
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

  test('list-style-type: circle — list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul style="list-style-type: circle;"><li>Circle bullet A</li><li>Circle bullet B</li></ul>',
    )
    expect(content).toContain('Circle bullet A')
    expect(content).toContain('Circle bullet B')
  })

  test('list-style-type: lower-alpha — items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol style="list-style-type: lower-alpha;"><li>Alpha a</li><li>Alpha b</li><li>Alpha c</li></ol>',
    )
    expect(content).toContain('Alpha a')
    expect(content).toContain('Alpha b')
    expect(content).toContain('Alpha c')
  })

  test('list-style-type: lower-roman — items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol style="list-style-type: lower-roman;"><li>Item i</li><li>Item ii</li><li>Item iii</li></ol>',
    )
    expect(content).toContain('Item i')
    expect(content).toContain('Item iii')
  })

  test('list-style-type: none — items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul style="list-style-type: none;"><li>No bullet item A</li><li>No bullet item B</li></ul>',
    )
    expect(content).toContain('No bullet item A')
    expect(content).toContain('No bullet item B')
  })

  test('list-style-type: square — items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul style="list-style-type: square;"><li>Square A</li><li>Square B</li></ul>',
    )
    expect(content).toContain('Square A')
    expect(content).toContain('Square B')
  })

  test('nested lists with different list-style-types — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol style="list-style-type: decimal;"><li>Outer 1<ul style="list-style-type: disc;"><li>Inner bullet</li></ul></li><li>Outer 2</li></ol>',
    )
    expect(content).toContain('Outer 1')
    expect(content).toContain('Inner bullet')
    expect(content).toContain('Outer 2')
  })
})
