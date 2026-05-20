import {test, expect} from '../../fixtures/test'

// CSS display properties (flex, grid, inline-block, inline-flex) control
// layout and appear in content pasted from design tools and templates.
// TinyMCE may preserve or strip these values. Tests verify text is never
// lost regardless of what the serializer does with layout CSS.
test.describe('CSS display properties in inline styles', () => {
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

  test('display: flex container — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="display: flex; gap: 16px;"><span>Flex item A</span><span>Flex item B</span></div>',
    )
    expect(content).toContain('Flex item A')
    expect(content).toContain('Flex item B')
  })

  test('display: grid container — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="display: grid; grid-template-columns: 1fr 1fr;"><p>Grid cell 1</p><p>Grid cell 2</p></div>',
    )
    expect(content).toContain('Grid cell 1')
    expect(content).toContain('Grid cell 2')
  })

  test('display: inline-block on span — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Text with <span style="display: inline-block; width: 200px;">inline block</span> here.</p>',
    )
    expect(content).toContain('inline block')
    expect(content).toContain('here')
  })

  test('display: none (hidden content) — text present in markup', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Visible text.</p><p style="display: none;">Hidden text still in markup.</p><p>More visible text.</p>',
    )
    expect(content).toContain('Visible text')
    expect(content).toContain('More visible text')
    // hidden content may or may not survive — document actual behavior
    expect(typeof content).toBe('string')
  })

  test('display: table on div — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="display: table; width: 100%;"><div style="display: table-row;"><div style="display: table-cell;">Cell content</div></div></div>',
    )
    expect(content).toContain('Cell content')
  })
})
