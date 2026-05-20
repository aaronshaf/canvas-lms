import {test, expect} from '../../fixtures/test'

// CSS multi-column layout (column-count, column-width, column-gap, column-rule)
// appears in course content for newspaper-style reading passages, side-by-side
// vocabulary lists, and two-column quiz formats. Text must be preserved
// regardless of how TinyMCE handles these block layout properties.
test.describe('CSS multi-column layout properties', () => {
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

  test('column-count: 2 — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="column-count: 2;">Two column layout text content here.</div>',
    )
    expect(content).toContain('Two column layout text content here')
  })

  test('column-count: 3 with multiple paragraphs — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="column-count: 3;"><p>Column paragraph one.</p><p>Column paragraph two.</p><p>Column paragraph three.</p></div>',
    )
    expect(content).toContain('Column paragraph one')
    expect(content).toContain('Column paragraph two')
    expect(content).toContain('Column paragraph three')
  })

  test('column-width: 200px — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="column-width: 200px;">Column width based layout text.</div>',
    )
    expect(content).toContain('Column width based layout text')
  })

  test('column-gap with column-rule — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="column-count: 2; column-gap: 30px; column-rule: 1px solid #ccc;">Content with column rule divider.</div>',
    )
    expect(content).toContain('Content with column rule divider')
  })

  test('columns shorthand property — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="columns: 2 auto;">Columns shorthand content text.</div>',
    )
    expect(content).toContain('Columns shorthand content text')
  })

  test('column-span: all for heading — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="column-count: 2;"><h2 style="column-span: all;">Spanning Heading</h2><p>First column text.</p><p>Second column text.</p></div>',
    )
    expect(content).toContain('Spanning Heading')
    expect(content).toContain('First column text')
  })
})
